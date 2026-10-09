"""Sorted string table (.sst) format.

    [data block 0] ... [data block N-1]
    [range-deletion block]
    [index block]
    [footer]

Every block is stored as  contents | type:uint8 | crc:fixed32  where
type 0 = uncompressed, 1 = lz1 (see lz.py) and crc is the masked crc32c
of contents followed by the type byte.

Block contents (after decompression):
    entry*  restart:fixed32 * num_restarts  num_restarts:fixed32
    entry := varint shared, varint non_shared, varint value_len,
             key_delta[non_shared], value[value_len]
    (`shared` bytes of the key are taken from the previous entry's key;
    at every restart point shared == 0.)

Data block keys are internal keys (see dbformat.py) in internal-key
order; values are the user values (empty for deletions).

Range-deletion block: key = internal key (begin, seq, 0x0F), value = end.
Index block: one entry per data block, key = last internal key in that
block, value = varint offset, varint size (size excludes the 5-byte
block trailer).

Footer (48 bytes): varint index_offset, varint index_size,
varint rangedel_offset, varint rangedel_size, zero padding to 40 bytes,
fixed64 magic.
"""

import struct

from . import lz
from .coding import get_varint, put_varint
from .crc32c import crc32c, mask, unmask
from .dbformat import TYPE_RANGE_DELETION, internal_key_sort_key, pack_internal_key, unpack_internal_key

TABLE_MAGIC = 0xF7CFF485B741E288
FOOTER_SIZE = 48
BLOCK_TRAILER_SIZE = 5
NO_COMPRESSION = 0
LZ1_COMPRESSION = 1

DATA_BLOCK_TARGET = 1024
RESTART_INTERVAL = 4


class BlockBuilder:
    def __init__(self, restart_interval=RESTART_INTERVAL):
        self.restart_interval = restart_interval
        self.reset()

    def reset(self):
        self.buf = bytearray()
        self.restarts = [0]
        self.counter = 0
        self.last_key = b""
        self.entries = 0

    def empty(self):
        return self.entries == 0

    def size_estimate(self):
        return len(self.buf) + 4 * len(self.restarts) + 4

    def add(self, key: bytes, value: bytes):
        shared = 0
        if self.counter < self.restart_interval:
            m = min(len(key), len(self.last_key))
            while shared < m and key[shared] == self.last_key[shared]:
                shared += 1
        else:
            self.restarts.append(len(self.buf))
            self.counter = 0
        non_shared = len(key) - shared
        self.buf += put_varint(shared) + put_varint(non_shared) + put_varint(len(value))
        self.buf += key[shared:] + value
        self.last_key = bytes(key)
        self.counter += 1
        self.entries += 1

    def finish(self) -> bytes:
        out = bytearray(self.buf)
        for r in self.restarts:
            out += struct.pack("<I", r)
        out += struct.pack("<I", len(self.restarts))
        return bytes(out)


class TableBuilder:
    def __init__(self, fh, compression=True):
        self.fh = fh
        self.compression = compression
        self.offset = 0
        self.data_block = BlockBuilder()
        self.index_block = BlockBuilder(restart_interval=1)
        self.range_dels = []
        self.last_key = None
        self.smallest = None
        self.largest = None
        self.num_entries = 0

    def _write_block(self, raw: bytes):
        btype = NO_COMPRESSION
        contents = raw
        if self.compression:
            c = lz.compress(raw)
            if len(c) < len(raw) - len(raw) // 8:
                contents = c
                btype = LZ1_COMPRESSION
        trailer = bytes([btype]) + struct.pack("<I", mask(crc32c(contents + bytes([btype]))))
        handle = (self.offset, len(contents))
        self.fh.write(contents + trailer)
        self.offset += len(contents) + len(trailer)
        return handle

    def _flush_data_block(self):
        if self.data_block.empty():
            return
        off, size = self._write_block(self.data_block.finish())
        self.index_block.add(self.last_key, put_varint(off) + put_varint(size))
        self.data_block.reset()

    def _note_bounds(self, ikey):
        if self.smallest is None or internal_key_sort_key(ikey) < internal_key_sort_key(self.smallest):
            self.smallest = ikey
        if self.largest is None or internal_key_sort_key(ikey) > internal_key_sort_key(self.largest):
            self.largest = ikey

    def add(self, ikey: bytes, value: bytes):
        if self.last_key is not None and internal_key_sort_key(ikey) <= internal_key_sort_key(self.last_key):
            raise ValueError("keys must be added in strictly increasing order")
        self.data_block.add(ikey, value)
        self.last_key = ikey
        self.num_entries += 1
        self._note_bounds(ikey)
        if self.data_block.size_estimate() >= DATA_BLOCK_TARGET:
            self._flush_data_block()

    def add_range_deletion(self, begin: bytes, end: bytes, seq: int):
        self.range_dels.append((pack_internal_key(begin, seq, TYPE_RANGE_DELETION), end))
        self._note_bounds(pack_internal_key(begin, seq, TYPE_RANGE_DELETION))

    def file_size_estimate(self):
        return self.offset + self.data_block.size_estimate()

    def finish(self) -> int:
        self._flush_data_block()
        rd = BlockBuilder()
        for ikey, end in sorted(self.range_dels, key=lambda e: internal_key_sort_key(e[0])):
            rd.add(ikey, end)
        rd_off, rd_size = self._write_block(rd.finish())
        idx_off, idx_size = self._write_block(self.index_block.finish())
        footer = put_varint(idx_off) + put_varint(idx_size) + put_varint(rd_off) + put_varint(rd_size)
        footer += b"\x00" * (FOOTER_SIZE - 8 - len(footer))
        footer += struct.pack("<Q", TABLE_MAGIC)
        self.fh.write(footer)
        self.offset += len(footer)
        return self.offset


# ---------------------------------------------------------------- reading

def read_block(data: bytes, offset: int, size: int) -> bytes:
    if offset + size + BLOCK_TRAILER_SIZE > len(data):
        raise ValueError("block extends past end of table")
    contents = data[offset:offset + size]
    btype = data[offset + size]
    stored = struct.unpack_from("<I", data, offset + size + 1)[0]
    if unmask(stored) != crc32c(contents + bytes([btype])):
        raise ValueError("block checksum mismatch")
    if btype == NO_COMPRESSION:
        return bytes(contents)
    if btype == LZ1_COMPRESSION:
        return lz.decompress(contents)
    raise ValueError("unknown block compression %d" % btype)


def iter_block(block: bytes):
    if len(block) < 4:
        raise ValueError("block too short")
    num_restarts = struct.unpack_from("<I", block, len(block) - 4)[0]
    limit = len(block) - 4 - 4 * num_restarts
    pos = 0
    key = b""
    while pos < limit:
        shared, pos = get_varint(block, pos)
        non_shared, pos = get_varint(block, pos)
        vlen, pos = get_varint(block, pos)
        key = key[:shared] + block[pos:pos + non_shared]
        pos += non_shared
        value = block[pos:pos + vlen]
        pos += vlen
        yield bytes(key), bytes(value)


class TableReader:
    def __init__(self, data: bytes):
        if len(data) < FOOTER_SIZE:
            raise ValueError("table too short")
        footer = data[-FOOTER_SIZE:]
        if struct.unpack_from("<Q", footer, FOOTER_SIZE - 8)[0] != TABLE_MAGIC:
            raise ValueError("bad table magic")
        pos = 0
        idx_off, pos = get_varint(footer, pos)
        idx_size, pos = get_varint(footer, pos)
        rd_off, pos = get_varint(footer, pos)
        rd_size, pos = get_varint(footer, pos)
        self.data = data
        self.index = list(iter_block(read_block(data, idx_off, idx_size)))
        self.range_del_block = read_block(data, rd_off, rd_size)

    def entries(self):
        """Yields (user_key, seq, type, value) in internal-key order."""
        for _, handle in self.index:
            off, p = get_varint(handle, 0)
            size, _ = get_varint(handle, p)
            for ikey, value in iter_block(read_block(self.data, off, size)):
                uk, seq, t = unpack_internal_key(ikey)
                yield uk, seq, t, value

    def range_deletions(self):
        """Yields (begin, end, seq)."""
        for ikey, end in iter_block(self.range_del_block):
            uk, seq, _ = unpack_internal_key(ikey)
            yield uk, end, seq
