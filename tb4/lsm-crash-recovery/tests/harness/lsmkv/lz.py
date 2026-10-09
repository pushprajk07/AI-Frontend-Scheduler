"""Tiny LZ77-style block compressor ("lz1").

Stream := varint(uncompressed_length) op*
op     := tag:uint8 ...
    tag < 0x80   literal run: (tag + 1) bytes follow verbatim
    tag >= 0x80  back-reference: length = (tag & 0x7F) + 4,
                 followed by varint(distance), distance >= 1.
                 Copies may overlap the bytes they produce.
"""

from .coding import get_varint, put_varint

_MIN_MATCH = 4
_MAX_MATCH = 0x7F + _MIN_MATCH
_MAX_DIST = 1 << 16


def compress(src: bytes) -> bytes:
    out = bytearray(put_varint(len(src)))
    n = len(src)
    table = {}
    i = 0
    lit = 0

    def flush_literals(a, b):
        while a < b:
            k = min(128, b - a)
            out.append(k - 1)
            out.extend(src[a:a + k])
            a += k

    while i + _MIN_MATCH <= n:
        key = src[i:i + _MIN_MATCH]
        cand = table.get(key)
        table[key] = i
        if cand is not None and i - cand <= _MAX_DIST:
            length = _MIN_MATCH
            while i + length < n and length < _MAX_MATCH and src[cand + length] == src[i + length]:
                length += 1
            flush_literals(lit, i)
            out.append(0x80 | (length - _MIN_MATCH))
            out.extend(put_varint(i - cand))
            i += length
            lit = i
        else:
            i += 1
    flush_literals(lit, n)
    return bytes(out)


def decompress(buf: bytes) -> bytes:
    ulen, pos = get_varint(buf, 0)
    out = bytearray()
    while pos < len(buf):
        tag = buf[pos]
        pos += 1
        if tag < 0x80:
            k = tag + 1
            if pos + k > len(buf):
                raise ValueError("lz1: truncated literal")
            out += buf[pos:pos + k]
            pos += k
        else:
            length = (tag & 0x7F) + _MIN_MATCH
            dist, pos = get_varint(buf, pos)
            if dist == 0 or dist > len(out):
                raise ValueError("lz1: bad distance")
            s = len(out) - dist
            for j in range(length):
                out.append(out[s + j])
    if len(out) != ulen:
        raise ValueError("lz1: length mismatch")
    return bytes(out)
