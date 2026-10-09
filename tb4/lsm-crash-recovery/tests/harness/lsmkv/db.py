"""lsmkv database: write path, two-phase commit, flushes, compactions and
MANIFEST maintenance.

On-disk layout of a database directory:

    CURRENT              name of the live MANIFEST followed by "\\n"
    MANIFEST-NNNNNN      version edits (log_format.py legacy records)
    NNNNNN.log           write-ahead logs (log_format.py recyclable records,
                         one encoded batch per logical record, write_batch.py)
    NNNNNN.sst           sorted tables (table.py)

All files share one number space (next_file_number).

Opening an existing database requires crash recovery, implemented in
lsmkv/recovery.py:  recover(dbpath) -> (state, last_sequence)  where
state is a dict user_key -> value.
"""

from . import dbformat as F
from .dbformat import TYPE_RANGE_DELETION, TYPE_VALUE
from .fs import RealFS
from .log_format import LogWriter
from .table import TableBuilder, TableReader
from .version_edit import COMPARATOR_NAME, FileMeta, VersionEdit
from .write_batch import WriteBatch, encode_commit, encode_rollback


class Options:
    def __init__(self, **kw):
        self.write_buffer_size = 8 * 1024       # rotate the WAL / flush after this many WAL bytes
        self.l0_compaction_trigger = 3          # full compaction when L0 has this many files
        self.recycle_log_file_num = 2           # obsolete WALs kept around for reuse
        self.max_manifest_file_size = 16 * 1024 # roll over to a fresh MANIFEST beyond this
        self.target_file_size = 16 * 1024       # compaction output file size
        self.purge_obsolete_every = 4           # delete obsolete files every N flushes
        self.compression = True
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
        self.log_number = 0       # WALs < this hold no data that is not in a table
        self.min_log_to_keep = 0  # WALs < this are not needed at all
        self.last_sequence = 0
        self.levels = {0: [], 1: []}
        self.mem = []             # (user_key, seq, type, value)
        self.mem_rdels = []       # (begin, end, seq)
        self.log_bytes = 0
        self.log_no = None
        self.log_fh = None
        self.logw = None
        self.recycle = []         # names of obsolete WAL files available for reuse
        self.prepared = {}        # xid -> (ops, number of the WAL holding the prepare section)
        self.flush_count = 0
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
                from . import recovery  # deleted module, see the task instructions

                _recovered = recovery.recover(path)
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
        self._new_log()
        self.log_number = self.min_log_to_keep = self.log_no
        self._write_new_manifest(manifest_no)

    def _open_existing(self, state, last_sequence):
        # Recovered state (prepared-but-uncommitted transactions are rolled
        # back by recovery) is written out as a fresh bottommost table set;
        # every older file becomes obsolete.
        numbers = [p[1] for p in map(F.parse_file_name, self.fs.listdir()) if p]
        self.next_file = max(numbers + [0]) + 1
        self.last_sequence = last_sequence
        entries = [(k, 0, TYPE_VALUE, v) for k, v in sorted(state.items())]
        self.levels = {0: [], 1: self._write_tables(entries, [], split=True)}
        self._new_log()
        self.log_number = self.min_log_to_keep = self.log_no
        self._write_new_manifest(self._new_file_number())
        self._purge_obsolete_files()

    # ------------------------------------------------------------ files

    def _new_log(self):
        """Switch to a fresh WAL, recycling an obsolete one if possible."""
        n = self._new_file_number()
        name = F.log_file_name(n)
        if self.recycle:
            fh = self.fs.reuse(self.recycle.pop(0), name)
        else:
            fh = self.fs.create(name)
        self.log_no = n
        self.log_fh = fh
        self.logw = LogWriter(fh, log_number=n)
        self.log_bytes = 0

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
        if self.manifestw.offset > self.opts.max_manifest_file_size:
            self._write_new_manifest(self._new_file_number())

    def _needed_logs(self):
        """WALs that recovery may need: those not yet fully flushed, plus
        those holding the prepare section of an unresolved transaction.
        (Logs in between are not needed and may be deleted.)"""
        needed = set(range(self.log_number, self.log_no + 1))
        needed |= {n for _, n in self.prepared.values()}
        return needed

    def _live_files(self):
        live = {F.CURRENT, F.manifest_file_name(self.manifest_no)}
        live |= {F.log_file_name(n) for n in self._needed_logs()}
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

    def _append(self, payload, sync, event):
        start, end = self.logw.add_record(payload)
        if self.listener is not None:
            self.listener.on_wal_record(self.log_fh, start, end, payload, event)
        if sync:
            self.logw.sync()
        self.log_bytes += len(payload)

    def _apply_to_memtable(self, ops, seq):
        for i, (t, k, v) in enumerate(ops):
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
        self._append(batch.encode(seq), sync, ("batch", seq, list(batch.ops)))
        self._apply_to_memtable(batch.ops, seq)
        self.last_sequence = seq + batch.count() - 1
        self._maybe_flush()

    def put(self, key, value, sync=False):
        self.write(WriteBatch().put(key, value), sync)

    def delete(self, key, sync=False):
        self.write(WriteBatch().delete(key), sync)

    def delete_range(self, begin, end, sync=False):
        self.write(WriteBatch().delete_range(begin, end), sync)

    # two-phase commit
    def prepare(self, xid: bytes, batch: WriteBatch, sync=True):
        if xid in self.prepared or batch.count() == 0:
            raise ValueError("bad prepare")
        self._append(batch.encode_prepare(xid), sync, ("prepare", xid, list(batch.ops)))
        self.prepared[xid] = (list(batch.ops), self.log_no)
        self._maybe_flush()

    def commit(self, xid: bytes, sync=False):
        ops, _ = self.prepared.pop(xid)
        seq = self.last_sequence + 1
        self._append(encode_commit(xid, seq, len(ops)), sync, ("commit", xid, seq))
        self._apply_to_memtable(ops, seq)
        self.last_sequence = seq + len(ops) - 1
        self._maybe_flush()

    def rollback(self, xid: bytes, sync=False):
        self.prepared.pop(xid)
        self._append(encode_rollback(xid), sync, ("rollback", xid))
        self._maybe_flush()

    # ------------------------------------------------------------ background work

    def _flush(self):
        # The old WAL must be durable before anything refers to the new one.
        self.logw.sync()
        self.log_fh.close()
        was_needed = self._needed_logs()
        self._new_log()
        entries = sorted(self.mem, key=lambda e: (e[0], -e[1], -e[2]))
        metas = self._write_tables(entries, self.mem_rdels, split=False)
        edit = VersionEdit()
        # Everything committed so far is in a table now.  Prepare sections
        # of still-uncommitted transactions exist only in the WAL they were
        # written to, so those WALs must survive until the transaction
        # resolves.
        edit.log_number = self.log_no
        edit.min_log_to_keep = min([self.log_no] + [n for _, n in self.prepared.values()])
        for m in metas:
            edit.new_files.append((0, m))
        self._log_and_apply(edit)
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

    def _compact(self):
        inputs = [(0, f) for f in self.levels[0]] + [(1, f) for f in self.levels[1]]
        newest = {}
        rdels = []
        for _, f in inputs:
            r = TableReader(self.fs.read(F.table_file_name(f.number)))
            for uk, seq, t, v in r.entries():
                cur = newest.get(uk)
                if cur is None or seq > cur[0]:
                    newest[uk] = (seq, t, v)
            rdels.extend(r.range_deletions())
        out = []
        for uk in sorted(newest):
            seq, t, v = newest[uk]
            if t != TYPE_VALUE:
                continue
            if any(b <= uk < e and s > seq for b, e, s in rdels):
                continue
            # Bottommost level: no older versions can exist below, so the
            # sequence number carries no information any more.
            out.append((uk, 0, TYPE_VALUE, v))
        metas = self._write_tables(out, [], split=True)
        edit = VersionEdit()
        for level, f in inputs:
            edit.deleted_files.append((level, f.number))
        for m in metas:
            edit.new_files.append((1, m))
        self._log_and_apply(edit)

    def close(self):
        self.logw.sync()
        self.log_fh.close()
        if self.manifest_fh is not None:
            self.manifest_fh.close()
