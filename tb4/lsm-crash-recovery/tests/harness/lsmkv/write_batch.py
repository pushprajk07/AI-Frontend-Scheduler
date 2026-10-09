"""WriteBatch and WAL record encoding.

WAL record (one per logical log record):
    lsn      : fixed64   log sequence number: position of the record in the
                         global WAL history (all record kinds, all stripes)
    sequence : fixed64   sequence number assigned to the first data op
    count    : fixed32   number of sequence numbers the record consumes
    op*      :
        0x01 PUT            varstring key, varstring value
        0x02 PUT_BLOB       varstring key, varint blob file, varint offset,
                            varint length, fixed32 masked crc32c(value)
        0x03 MERGE          varstring key, varstring delta (fixed64, int64 add)
        0x00 DELETE         varstring key
        0x0F DELETE_RANGE   varstring begin_key, varstring end_key
        0x10 BEGIN_PREPARE  -
        0x11 END_PREPARE    varstring xid
        0x12 COMMIT         varstring xid
        0x13 ROLLBACK       varstring xid
"""

import struct

from .coding import put_fixed32, put_length_prefixed, put_varint
import struct as _struct

from .dbformat import TYPE_BLOB, TYPE_DELETION, TYPE_MERGE, TYPE_RANGE_DELETION, TYPE_VALUE  # noqa: F401

OP_BEGIN_PREPARE = 0x10
OP_END_PREPARE = 0x11
OP_COMMIT = 0x12
OP_ROLLBACK = 0x13


class WriteBatch:
    def __init__(self):
        self.ops = []  # (type, key, value_or_end)

    def put(self, key: bytes, value: bytes):
        self.ops.append((TYPE_VALUE, bytes(key), bytes(value)))
        return self

    def merge(self, key: bytes, delta: int):
        self.ops.append((TYPE_MERGE, bytes(key), _struct.pack("<q", delta)))
        return self

    def delete(self, key: bytes):
        self.ops.append((TYPE_DELETION, bytes(key), b""))
        return self

    def delete_range(self, begin: bytes, end: bytes):
        if not begin < end:
            raise ValueError("delete_range requires begin < end")
        self.ops.append((TYPE_RANGE_DELETION, bytes(begin), bytes(end)))
        return self

    def count(self):
        return len(self.ops)


def encode_blob_pointer(file_no, offset, length, crc):
    return put_varint(file_no) + put_varint(offset) + put_varint(length) + put_fixed32(crc)


def encode_ops(wire_ops):
    """wire_ops: (type, key, value) where TYPE_BLOB values are encoded
    blob pointers."""
    out = bytearray()
    for t, k, v in wire_ops:
        out.append(t)
        out += put_length_prefixed(k)
        if t == TYPE_BLOB:
            out += v
        elif t != TYPE_DELETION:
            out += put_length_prefixed(v)
    return bytes(out)


def header(lsn, seq, count):
    return struct.pack("<QQI", lsn, seq, count)


def encode_plain(lsn, seq, wire_ops):
    return header(lsn, seq, len(wire_ops)) + encode_ops(wire_ops)


def encode_prepare(lsn, xid, wire_ops):
    return (header(lsn, 0, 0) + bytes([OP_BEGIN_PREPARE]) + encode_ops(wire_ops)
            + bytes([OP_END_PREPARE]) + put_length_prefixed(xid))


def encode_commit(lsn, xid, sequence, count):
    return header(lsn, sequence, count) + bytes([OP_COMMIT]) + put_length_prefixed(xid)


def encode_rollback(lsn, xid):
    return header(lsn, 0, 0) + bytes([OP_ROLLBACK]) + put_length_prefixed(xid)
