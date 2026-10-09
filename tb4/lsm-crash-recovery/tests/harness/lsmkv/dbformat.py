"""Internal keys, file naming."""

import struct

TYPE_DELETION = 0x00
TYPE_VALUE = 0x01
TYPE_BLOB = 0x02        # value is a blob pointer (see write_batch.py)
TYPE_MERGE = 0x03       # value is a signed 64-bit little-endian delta
TYPE_RANGE_DELETION = 0x0F

MAX_SEQUENCE = (1 << 56) - 1


def pack_internal_key(user_key: bytes, seq: int, vtype: int) -> bytes:
    """user_key followed by fixed64((seq << 8) | type)."""
    return bytes(user_key) + struct.pack("<Q", (seq << 8) | vtype)


def unpack_internal_key(ikey: bytes):
    if len(ikey) < 8:
        raise ValueError("internal key too short")
    tag = struct.unpack_from("<Q", ikey, len(ikey) - 8)[0]
    return bytes(ikey[:-8]), tag >> 8, tag & 0xFF


def merge_base(value):
    """Integer interpretation of a value for MERGE: an 8-byte value is a
    signed little-endian int64, anything else counts as 0."""
    if value is not None and len(value) == 8:
        return struct.unpack("<q", value)[0]
    return 0


def merge_apply(value, delta_bytes):
    r = merge_base(value) + struct.unpack("<q", delta_bytes)[0]
    r = (r + (1 << 63)) % (1 << 64) - (1 << 63)  # wraps like int64
    return struct.pack("<q", r)


def internal_key_sort_key(ikey: bytes):
    """Order: user key ascending, then sequence descending, then type
    descending."""
    uk, seq, t = unpack_internal_key(ikey)
    return (uk, -seq, -t)


def log_file_name(n: int) -> str:
    return "%06d.log" % n


def blob_file_name(n: int) -> str:
    return "%06d.blob" % n


def table_file_name(n: int) -> str:
    return "%06d.sst" % n


def manifest_file_name(n: int) -> str:
    return "MANIFEST-%06d" % n


CURRENT = "CURRENT"
CURRENT_TMP = "CURRENT.dbtmp"


def parse_file_name(name: str):
    """Returns (kind, number) or None.  kind in {"log","table","manifest","current"}."""
    if name == CURRENT:
        return ("current", 0)
    if name.startswith("MANIFEST-"):
        rest = name[len("MANIFEST-"):]
        if rest.isdigit():
            return ("manifest", int(rest))
        return None
    for suffix, kind in ((".log", "log"), (".sst", "table"), (".blob", "blob")):
        if name.endswith(suffix):
            stem = name[: -len(suffix)]
            if stem.isdigit():
                return (kind, int(stem))
    return None
