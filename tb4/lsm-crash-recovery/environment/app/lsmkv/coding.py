import struct


def put_varint(n: int) -> bytes:
    if n < 0:
        raise ValueError("varint must be non-negative")
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def get_varint(buf, pos: int):
    result = 0
    shift = 0
    while True:
        if pos >= len(buf):
            raise ValueError("truncated varint")
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, pos
        shift += 7
        if shift > 63:
            raise ValueError("varint too long")


def put_length_prefixed(b: bytes) -> bytes:
    return put_varint(len(b)) + bytes(b)


def get_length_prefixed(buf, pos: int):
    n, pos = get_varint(buf, pos)
    if pos + n > len(buf):
        raise ValueError("truncated length-prefixed slice")
    return bytes(buf[pos:pos + n]), pos + n


def put_fixed32(n: int) -> bytes:
    return struct.pack("<I", n)


def put_fixed64(n: int) -> bytes:
    return struct.pack("<Q", n)


def get_fixed32(buf, pos: int) -> int:
    return struct.unpack_from("<I", buf, pos)[0]


def get_fixed64(buf, pos: int) -> int:
    return struct.unpack_from("<Q", buf, pos)[0]
