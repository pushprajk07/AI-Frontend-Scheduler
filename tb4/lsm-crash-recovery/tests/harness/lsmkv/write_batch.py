"""WriteBatch: the unit of atomicity.  Every WAL record is one encoded
batch.

Encoding:
    sequence : fixed64   sequence number assigned to the first data op
    count    : fixed32   number of sequence numbers the batch consumes
    op*      :           (until the end of the record)
        0x01 PUT            varstring key, varstring value
        0x00 DELETE         varstring key
        0x0F DELETE_RANGE   varstring begin_key, varstring end_key
                            (removes keys k with begin_key <= k < end_key)
        0x10 BEGIN_PREPARE  -
        0x11 END_PREPARE    varstring xid
        0x12 COMMIT         varstring xid
        0x13 ROLLBACK       varstring xid

Three kinds of batches are written to the WAL:

  plain      sequence=S, count=N, N data ops.  Op i gets sequence S+i.

  prepare    (two-phase commit, phase 1)  sequence=0, count=0,
             BEGIN_PREPARE, data ops..., END_PREPARE(xid).
             The data ops are NOT visible yet and consume no sequence
             numbers.

  commit     sequence=S, count=N, COMMIT(xid).  Makes the N data ops of
             the prepare section `xid` visible; op i of that section gets
             sequence S+i.

  rollback   sequence=0, count=0, ROLLBACK(xid).  Discards `xid`.

A prepare section whose transaction never commits is never visible.
"""

import struct

from .coding import put_length_prefixed
from .dbformat import TYPE_DELETION, TYPE_RANGE_DELETION, TYPE_VALUE

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

    def _encode_ops(self):
        out = bytearray()
        for t, k, v in self.ops:
            out.append(t)
            out += put_length_prefixed(k)
            if t != TYPE_DELETION:
                out += put_length_prefixed(v)
        return out

    def encode(self, sequence: int) -> bytes:
        return struct.pack("<QI", sequence, len(self.ops)) + bytes(self._encode_ops())

    def encode_prepare(self, xid: bytes) -> bytes:
        out = bytearray(struct.pack("<QI", 0, 0))
        out.append(OP_BEGIN_PREPARE)
        out += self._encode_ops()
        out.append(OP_END_PREPARE)
        out += put_length_prefixed(xid)
        return bytes(out)


def encode_commit(xid: bytes, sequence: int, count: int) -> bytes:
    return struct.pack("<QI", sequence, count) + bytes([OP_COMMIT]) + put_length_prefixed(xid)


def encode_rollback(xid: bytes) -> bytes:
    return struct.pack("<QI", 0, 0) + bytes([OP_ROLLBACK]) + put_length_prefixed(xid)
