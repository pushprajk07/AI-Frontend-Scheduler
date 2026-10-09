"""Record-oriented log file format shared by the WAL and the MANIFEST.

A log file is a sequence of BLOCK_SIZE blocks.  Each logical record is
split into one or more physical fragments; a fragment never crosses a
block boundary.  When fewer than a header's worth of bytes remain in a
block, the remainder is filled with zero bytes and the next fragment
starts at the next block.

Legacy fragment header (MANIFEST), 7 bytes:
    checksum : fixed32   masked crc32c over [type byte][payload]
    length   : fixed16   payload length
    type     : uint8     FULL=1 FIRST=2 MIDDLE=3 LAST=4

Recyclable fragment header (WAL), 11 bytes:
    checksum : fixed32   masked crc32c over [type byte][log number][payload]
    length   : fixed16
    type     : uint8     FULL=5 FIRST=6 MIDDLE=7 LAST=8
    log_no   : fixed32   number of the log file the fragment was written to
"""

import struct

from .crc32c import crc32c, mask

BLOCK_SIZE = 4096

ZERO_TYPE = 0
FULL, FIRST, MIDDLE, LAST = 1, 2, 3, 4
RECYCLABLE_FULL, RECYCLABLE_FIRST, RECYCLABLE_MIDDLE, RECYCLABLE_LAST = 5, 6, 7, 8

LEGACY_HEADER_SIZE = 7
RECYCLABLE_HEADER_SIZE = 11


class LogWriter:
    def __init__(self, fh, log_number=None):
        """`log_number` given => recyclable format (WAL)."""
        self.fh = fh
        self.log_number = log_number
        self.recyclable = log_number is not None
        self.header_size = RECYCLABLE_HEADER_SIZE if self.recyclable else LEGACY_HEADER_SIZE
        self.block_offset = 0
        self.offset = 0  # file offset of the next byte we will write

    def _fragment(self, rtype: int, payload: bytes) -> bytes:
        if self.recyclable:
            rtype += 4
            ln = struct.pack("<I", self.log_number)
            crc = crc32c(bytes([rtype]) + ln + payload)
            return struct.pack("<IHB", mask(crc), len(payload), rtype) + ln + payload
        crc = crc32c(bytes([rtype]) + payload)
        return struct.pack("<IHB", mask(crc), len(payload), rtype) + payload

    def add_record(self, payload: bytes):
        """Append one logical record.  Returns (start, end): the file
        offsets of the first fragment header and of the end of the last
        fragment (block-trailer padding written before the first fragment
        is not included)."""
        out = bytearray()
        left = len(payload)
        pos = 0
        begin = True
        start = None
        hs = self.header_size
        while True:
            leftover = BLOCK_SIZE - self.block_offset
            if leftover < hs:
                if leftover > 0:
                    out += b"\x00" * leftover
                self.block_offset = 0
            if start is None:
                start = self.offset + len(out)
            avail = BLOCK_SIZE - self.block_offset - hs
            n = min(left, avail)
            end = n == left
            if begin and end:
                t = FULL
            elif begin:
                t = FIRST
            elif end:
                t = LAST
            else:
                t = MIDDLE
            out += self._fragment(t, payload[pos:pos + n])
            self.block_offset += hs + n
            pos += n
            left -= n
            begin = False
            if end:
                break
        self.fh.write(bytes(out))
        self.offset += len(out)
        return start, self.offset

    def sync(self):
        self.fh.sync()
