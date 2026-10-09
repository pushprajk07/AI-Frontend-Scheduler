"""Filesystem abstraction used by the engine.

Durability contract assumed by the engine (it matches ext4/xfs with
default mount options closely enough for our purposes):

  * create / rename / remove are atomic and durable once they return
    (the engine fsyncs the directory after each of them).
  * file *contents* written with write() are only guaranteed to be on
    stable storage after sync() returns.  On power loss, any data written
    since the last sync() of that file may be missing, partially present,
    or present out of order at 512-byte sector granularity.  The file may
    also appear extended (sectors that never made it read back as zeros).
"""

import os


class RealFile:
    def __init__(self, f, name):
        self._f = f
        self.name = name

    def tell(self) -> int:
        return self._f.tell()

    def write(self, data: bytes) -> None:
        self._f.write(data)

    def sync(self) -> None:
        self._f.flush()
        os.fsync(self._f.fileno())

    def close(self) -> None:
        self._f.close()


class RealFS:
    def __init__(self, root: str):
        self.root = root
        os.makedirs(root, exist_ok=True)

    def _p(self, name):
        return os.path.join(self.root, name)

    def _sync_dir(self):
        fd = os.open(self.root, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)

    def listdir(self):
        return os.listdir(self.root)  # filesystem (not sorted) order

    def exists(self, name):
        return os.path.exists(self._p(name))

    def read(self, name) -> bytes:
        with open(self._p(name), "rb") as f:
            return f.read()

    def create(self, name) -> RealFile:
        """Create (or truncate) `name` and open it for appending."""
        f = open(self._p(name), "wb")
        self._sync_dir()
        return RealFile(f, name)

    def reuse(self, old, new) -> RealFile:
        """Rename `old` to `new` and open it for writing at offset 0
        WITHOUT truncating it (used for WAL recycling: avoids the cost of
        allocating fresh blocks)."""
        os.rename(self._p(old), self._p(new))
        self._sync_dir()
        f = open(self._p(new), "r+b")
        f.seek(0)
        return RealFile(f, new)

    def rename(self, old, new) -> None:
        os.replace(self._p(old), self._p(new))
        self._sync_dir()

    def remove(self, name) -> None:
        os.remove(self._p(name))
        self._sync_dir()
