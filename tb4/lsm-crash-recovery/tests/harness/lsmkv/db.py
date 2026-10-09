"""lsmkv database: striped write-ahead log, value separation, two-phase
commit, checkpoint flushes, compactions and MANIFEST maintenance.

On-disk layout of a database directory:

    CURRENT              name of the live MANIFEST followed by "\\n"
    MANIFEST-NNNNNN      version edits (log_format.py legacy records)
    NNNNNN.log           write-ahead logs (log_format.py recyclable records,
                         one encoded record per logical record,
                         write_batch.py).  `wal_stripes` logs are active at
                         a time; record lsn goes to stripe lsn % wal_stripes.
    NNNNNN.blob          values of at least `blob_threshold` bytes
    NNNNNN.sst           sorted tables (table.py)

All files share one number space (next_file_number).

Opening an existing database requires crash recovery, provided by an
external program:  recover(dbpath) -> (state, last_sequence).
"""

from . import dbformat as F
from .crc32c import crc32c, mask
from .dbformat import TYPE_BLOB, TYPE_DELETION, TYPE_MERGE, TYPE_RANGE_DELETION, TYPE_VALUE, merge_apply
from .fs import RealFS
from .log_format import LogWriter
from .table import TableBuilder, TableReader
from .version_edit import COMPARATOR_NAME, FileMeta, VersionEdit
from .write_batch import (WriteBatch, encode_blob_pointer, encode_commit, encode_plain,  # noqa: F401
                          encode_prepare, encode_rollback)


class Options:
    def __init__(self, **kw):
        self.write_buffer_size = 8 * 1024       # flush after this many WAL bytes
        self.l0_compaction_trigger = 3          # full compaction when L0 has this many files
        self.recycle_log_file_num = 2           # obsolete WALs kept around for reuse
        self.max_manifest_file_size = 16 * 1024 # roll over to a fresh MANIFEST beyond this
        self.target_file_size = 16 * 1024       # compaction output file size
        self.purge_obsolete_every = 4           # delete obsolete files every N flushes
        self.compression = True
        self.wal_stripes = 2                    # WAL records are striped round-robin by lsn
        self.log_rotate_every = 2               # switch to a fresh WAL set every N flushes
        self.blob_threshold = 1024              # values at least this long go to blob files
        self.blob_file_size = 64 * 1024         # start a new blob file beyond this
        for k, v in kw.items():
            if not hasattr(self, k):
                raise TypeError("unknown option %r" % k)
            setattr(self, k, v)


class DB:
    def __init__(self, path, fs, options, listener):
        self.path = path
        self.fs = fs
        self.opts = options
        self.listener = listener
        self.next_file = 1
        self.log_number = 0       # first WAL of the current set
        self.min_log_to_keep = 0  # WALs < this are not needed at all
        self.last_sequence = 0
        self.levels = {0: [], 1: []}
        self.mem = []             # (user_key, seq, type, value)
        self.mem_rdels = []       # (begin, end, seq)
        self.log_bytes = 0
        self.log_nos = []         # current WAL set, one file per stripe
        self.log_fhs = []
        self.logws = []
        self.next_lsn = 1
        self.flushed_lsn = 0      # records with lsn <= this are reflected in tables
        self.blob_no = None
        self.blob_fh = None
        self.blob_size = 0
        self.blob_files = []      # blob files created since open (all live)
        self.recycle = []         # names of obsolete WAL files available for reuse
        self.prepared = {}        # xid -> (wire ops, number of the WAL holding the prepare)
        self.flush_count = 0
        self.rotate_count = 0
        self.manifest_no = None
        self.manifest_fh = None
        self.manifestw = None

    # ------------------------------------------------------------ open

    @classmethod
    def open(cls, path, fs=None, options=None, listener=None, _recovered=None):
        fs = fs if fs is not None else RealFS(path)
        db = cls(path, fs, options or Options(), listener)
        if not fs.exists(F.CURRENT):
            db._create_new()
        else:
            if _recovered is None:
                raise RuntimeError("recovery result required")
            state, last_sequence = _recovered
            db._open_existing(state, last_sequence)
        return db

    def _new_file_number(self):
        n = self.next_file
        self.next_file += 1
        return n

    def _create_new(self):
        for name in self.fs.listdir():
            if F.parse_file_name(name) or name == F.CURRENT_TMP:
                self.fs.remove(name)
        self.next_file = 1
        manifest_no = self._new_file_number()
        self._new_log_set()
        self.log_number = self.min_log_to_keep = self.log_nos[0]
        self._write_new_manifest(manifest_no)

    def _open_existing(self, state, last_sequence):
        # Recovered state (prepared-but-uncommitted transactions are rolled
        # back by recovery) is written out as a fresh bottommost table set
        # with all values inline; every older file becomes obsolete.
        numbers = [p[1] for p in map(F.parse_file_name, self.fs.listdir()) if p]
        self.next_file = max(numbers + [0]) + 1
        self.last_sequence = last_sequence
        entries = [(k, 0, TYPE_VALUE, v) for k, v in sorted(state.items())]
        self.levels = {0: [], 1: self._write_tables(entries, [], split=True)}
        self._new_log_set()
        self.log_number = self.min_log_to_keep = self.log_nos[0]
        self._write_new_manifest(self._new_file_number())
        self._purge_obsolete_files()

    # ------------------------------------------------------------ files

    def _new_log_set(self):
        """Switch to a fresh set of WALs, recycling obsolete ones if possible."""
        self.log_nos, self.log_fhs, self.logws = [], [], []
        for _ in range(self.opts.wal_stripes):
            n = self._new_file_number()
            name = F.log_file_name(n)
            if self.recycle:
                fh = self.fs.reuse(self.recycle.pop(0), name)
            else:
                fh = self.fs.create(name)
            self.log_nos.append(n)
            self.log_fhs.append(fh)
            self.logws.append(LogWriter(fh, log_number=n))
        self.log_bytes = 0

    def _sync_wal(self):
        if self.blob_fh is not None:
            self.blob_fh.sync()
        for w in self.logws:
            w.sync()

    def _write_blob(self, value):
        if self.blob_fh is None or self.blob_size >= self.opts.blob_file_size:
            if self.blob_fh is not None:
                self.blob_fh.sync()
                self.blob_fh.close()
            self.blob_no = self._new_file_number()
            self.blob_fh = self.fs.create(F.blob_file_name(self.blob_no))
            self.blob_files.append(self.blob_no)
            self.blob_size = 0
        off = self.blob_size
        self.blob_fh.write(value)
        self.blob_size += len(value)
        return self.blob_fh, off, encode_blob_pointer(self.blob_no, off, len(value), mask(crc32c(value)))

    def _to_wire(self, ops):
        """Moves large values to the blob file; returns (wire ops, blob ranges)."""
        wire, blobs = [], []
        for t, k, v in ops:
            if t == TYPE_VALUE and len(v) >= self.opts.blob_threshold:
                fh, off, ptr = self._write_blob(v)
                blobs.append((fh, off, len(v)))
                wire.append((TYPE_BLOB, k, ptr))
            else:
                wire.append((t, k, v))
        return wire, blobs

    def _write_tables(self, entries, rdels, split):
        """entries: (user_key, seq, type, value) in internal-key order."""
        metas = []
        builder = fh = None
        number = None

        def finish():
            size = builder.finish()
            fh.sync()
            fh.close()
            metas.append(FileMeta(number, size, builder.smallest, builder.largest))

        for uk, seq, t, v in entries:
            if builder is None:
                number = self._new_file_number()
                fh = self.fs.create(F.table_file_name(number))
                builder = TableBuilder(fh, compression=self.opts.compression)
            builder.add(F.pack_internal_key(uk, seq, t), v)
            if split and builder.file_size_estimate() >= self.opts.target_file_size:
                finish()
                builder = None
        if rdels and builder is None:
            number = self._new_file_number()
            fh = self.fs.create(F.table_file_name(number))
            builder = TableBuilder(fh, compression=self.opts.compression)
        if builder is not None:
            for b, e, s in rdels:
                builder.add_range_deletion(b, e, s)
            finish()
        return metas

    def _snapshot_edit(self):
        e = VersionEdit()
        e.comparator = COMPARATOR_NAME
        e.log_number = self.log_number
        e.min_log_to_keep = self.min_log_to_keep
        e.flushed_lsn = self.flushed_lsn
        e.next_file_number = self.next_file
        e.last_sequence = self.last_sequence
        for level in (0, 1):
            for f in self.levels[level]:
                e.new_files.append((level, f))
        return e

    def _set_current(self, manifest_no):
        fh = self.fs.create(F.CURRENT_TMP)
        fh.write((F.manifest_file_name(manifest_no) + "\n").encode())
        fh.sync()
        fh.close()
        self.fs.rename(F.CURRENT_TMP, F.CURRENT)

    def _write_new_manifest(self, number):
        fh = self.fs.create(F.manifest_file_name(number))
        w = LogWriter(fh)
        w.add_record(self._snapshot_edit().encode())
        w.sync()
        self._set_current(number)
        old = self.manifest_no
        if self.manifest_fh is not None:
            self.manifest_fh.close()
        self.manifest_no, self.manifest_fh, self.manifestw = number, fh, w
        if old is not None:
            self.fs.remove(F.manifest_file_name(old))

    def _log_and_apply(self, edit):
        edit.next_file_number = self.next_file
        edit.last_sequence = self.last_sequence
        self.manifestw.add_record(edit.encode())
        self.manifestw.sync()
        for level, number in edit.deleted_files:
            self.levels[level] = [f for f in self.levels[level] if f.number != number]
        for level, f in edit.new_files:
            self.levels[level].append(f)
        if edit.log_number is not None:
            self.log_number = edit.log_number
        if edit.min_log_to_keep is not None:
            self.min_log_to_keep = edit.min_log_to_keep
        if edit.flushed_lsn is not None:
            self.flushed_lsn = edit.flushed_lsn
        if self.manifestw.offset > self.opts.max_manifest_file_size:
            self._write_new_manifest(self._new_file_number())

    def _needed_logs(self):
        """WALs that recovery may need: the current set, plus those holding
        the prepare section of an unresolved transaction.  (Logs in between
        are not needed and may be deleted.)"""
        needed = set(range(self.log_number, max(self.log_nos) + 1))
        needed |= {n for _, n in self.prepared.values()}
        return needed

    def _live_files(self):
        live = {F.CURRENT, F.manifest_file_name(self.manifest_no)}
        live |= {F.log_file_name(n) for n in self._needed_logs()}
        live |= {F.blob_file_name(n) for n in self.blob_files}
        live |= set(self.recycle)
        for level in (0, 1):
            live |= {F.table_file_name(f.number) for f in self.levels[level]}
        return live

    def _purge_obsolete_files(self):
        # Deletion is lazy (batched) to keep flushes cheap; until purged,
        # obsolete files simply sit in the directory.  Files are removed in
        # directory order.
        live = self._live_files()
        for name in self.fs.listdir():
            if name not in live and (F.parse_file_name(name) or name == F.CURRENT_TMP):
                self.fs.remove(name)

    # ------------------------------------------------------------ writes

    def _append(self, build, sync, event, blobs=()):
        lsn = self.next_lsn
        self.next_lsn += 1
        payload = build(lsn)
        stripe = lsn % self.opts.wal_stripes
        start, end = self.logws[stripe].add_record(payload)
        if self.listener is not None:
            self.listener.on_wal_record(self.log_fhs[stripe], start, end, payload, event, list(blobs))
        if sync:
            self._sync_wal()
        self.log_bytes += len(payload)
        return stripe

    def _apply_to_memtable(self, wire_ops, seq):
        for i, (t, k, v) in enumerate(wire_ops):
            if t == TYPE_RANGE_DELETION:
                self.mem_rdels.append((k, v, seq + i))
            else:
                self.mem.append((k, seq + i, t, v))

    def _maybe_flush(self):
        if self.log_bytes >= self.opts.write_buffer_size:
            self._flush()

    def write(self, batch: WriteBatch, sync=False):
        if batch.count() == 0:
            return
        seq = self.last_sequence + 1
        wire, blobs = self._to_wire(batch.ops)
        self._append(lambda lsn: encode_plain(lsn, seq, wire), sync, ("batch", seq, list(batch.ops)), blobs)
        self._apply_to_memtable(wire, seq)
        self.last_sequence = seq + batch.count() - 1
        self._maybe_flush()

    def put(self, key, value, sync=False):
        self.write(WriteBatch().put(key, value), sync)

    def merge(self, key, delta, sync=False):
        self.write(WriteBatch().merge(key, delta), sync)

    def delete(self, key, sync=False):
        self.write(WriteBatch().delete(key), sync)

    def delete_range(self, begin, end, sync=False):
        self.write(WriteBatch().delete_range(begin, end), sync)

    # two-phase commit
    def prepare(self, xid: bytes, batch: WriteBatch, sync=True):
        if xid in self.prepared or batch.count() == 0:
            raise ValueError("bad prepare")
        wire, blobs = self._to_wire(batch.ops)
        stripe = self._append(lambda lsn: encode_prepare(lsn, xid, wire), sync,
                              ("prepare", xid, list(batch.ops)), blobs)
        self.prepared[xid] = (wire, self.log_nos[stripe])
        self._maybe_flush()

    def commit(self, xid: bytes, sync=False):
        wire, _ = self.prepared.pop(xid)
        seq = self.last_sequence + 1
        self._append(lambda lsn: encode_commit(lsn, xid, seq, len(wire)), sync, ("commit", xid, seq))
        self._apply_to_memtable(wire, seq)
        self.last_sequence = seq + len(wire) - 1
        self._maybe_flush()

    def rollback(self, xid: bytes, sync=False):
        self.prepared.pop(xid)
        self._append(lambda lsn: encode_rollback(lsn, xid), sync, ("rollback", xid))
        self._maybe_flush()

    # ------------------------------------------------------------ background work

    def _flush(self):
        # Everything written so far must be durable before a table claims it.
        self._sync_wal()
        self.rotate_count += 1
        rotate = self.rotate_count >= self.opts.log_rotate_every
        was_needed = self._needed_logs()
        if rotate:
            self.rotate_count = 0
            for fh in self.log_fhs:
                fh.close()
            self._new_log_set()
        self.log_bytes = 0
        entries = sorted(self.mem, key=lambda e: (e[0], -e[1], -e[2]))
        metas = self._write_tables(entries, self.mem_rdels, split=False)
        edit = VersionEdit()
        # Records up to flushed_lsn are now in a table.  Prepare sections of
        # still-uncommitted transactions exist only in the WAL they were
        # written to, so those WALs must survive until the transaction
        # resolves.
        edit.flushed_lsn = self.next_lsn - 1
        if rotate:
            edit.log_number = self.log_nos[0]
        edit.min_log_to_keep = min([edit.log_number or self.log_number]
                                   + [n for _, n in self.prepared.values()])
        for m in metas:
            edit.new_files.append((0, m))
        self._log_and_apply(edit)
        if rotate:
            for n in sorted(was_needed - self._needed_logs()):
                name = F.log_file_name(n)
                if self.fs.exists(name) and len(self.recycle) < self.opts.recycle_log_file_num:
                    self.recycle.append(name)
        self.mem, self.mem_rdels = [], []
        if len(self.levels[0]) >= self.opts.l0_compaction_trigger:
            self._compact()
        self.flush_count += 1
        if self.flush_count % self.opts.purge_obsolete_every == 0:
            self._purge_obsolete_files()

    def _blob_value(self, ptr):
        from .coding import get_varint
        p = 0
        fno, p = get_varint(ptr, p)
        off, p = get_varint(ptr, p)
        ln, p = get_varint(ptr, p)
        return self.fs.read(F.blob_file_name(fno))[off:off + ln]

    def _compact(self):
        inputs = [(0, f) for f in self.levels[0]] + [(1, f) for f in self.levels[1]]
        versions = {}
        rdels = []
        for _, f in inputs:
            r = TableReader(self.fs.read(F.table_file_name(f.number)))
            for uk, seq, t, v in r.entries():
                versions.setdefault(uk, []).append((seq, t, v))
            rdels.extend(r.range_deletions())
        out = []
        for uk in sorted(versions):
            # Replay this key's history in sequence order.
            events = [(seq, t, v) for seq, t, v in versions[uk]]
            events += [(s, TYPE_RANGE_DELETION, None) for b, e, s in rdels if b <= uk < e]
            events.sort(key=lambda x: x[0])
            cur = None  # (type, value) or None
            for seq, t, v in events:
                if t in (TYPE_DELETION, TYPE_RANGE_DELETION):
                    cur = None
                elif t == TYPE_MERGE:
                    base = None
                    if cur is not None:
                        base = cur[1] if cur[0] == TYPE_VALUE else self._blob_value(cur[1])
                    cur = (TYPE_VALUE, merge_apply(base, v))
                else:
                    cur = (t, v)
            if cur is None:
                continue
            # Bottommost level: no older versions can exist below, so the
            # sequence number carries no information any more.
            out.append((uk, 0, cur[0], cur[1]))
        metas = self._write_tables(out, [], split=True)
        edit = VersionEdit()
        for level, f in inputs:
            edit.deleted_files.append((level, f.number))
        for m in metas:
            edit.new_files.append((1, m))
        self._log_and_apply(edit)

    def close(self):
        self._sync_wal()
        for fh in self.log_fhs:
            fh.close()
        if self.blob_fh is not None:
            self.blob_fh.close()
        if self.manifest_fh is not None:
            self.manifest_fh.close()
