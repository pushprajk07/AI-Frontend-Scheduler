"""CRC-32C (Castagnoli) plus the storage-format checksum mask."""

_POLY = 0x82F63B78


def _make_table():
    table = []
    for i in range(256):
        c = i
        for _ in range(8):
            c = (c >> 1) ^ _POLY if c & 1 else c >> 1
        table.append(c)
    return table


_TABLE = _make_table()


def crc32c(data, crc: int = 0) -> int:
    """Extend `crc` with `data` (crc=0 starts a fresh checksum)."""
    t = _TABLE
    c = crc ^ 0xFFFFFFFF
    for b in data:
        c = t[(c ^ b) & 0xFF] ^ (c >> 8)
    return c ^ 0xFFFFFFFF


_MASK_DELTA = 0xA282EAD8


def mask(crc: int) -> int:
    """Checksums are stored masked so that a CRC of data containing
    embedded CRCs does not degenerate."""
    return ((((crc >> 15) | (crc << 17)) & 0xFFFFFFFF) + _MASK_DELTA) & 0xFFFFFFFF


def unmask(masked: int) -> int:
    rot = (masked - _MASK_DELTA) & 0xFFFFFFFF
    return ((rot >> 17) | (rot << 15)) & 0xFFFFFFFF
