"""VersionEdit: one MANIFEST record.

A MANIFEST is a log file (legacy record format, see log_format.py) whose
records are VersionEdits.  The first record of every MANIFEST is a full
snapshot of the database's file set; later records are deltas.  Applying
all records in order yields the current version.

Encoding: a sequence of (varint tag, value) fields:

    1  COMPARATOR       varstring
    2  LOG_NUMBER       varint   WAL files numbered < this are obsolete
    3  NEXT_FILE_NUMBER varint
    4  LAST_SEQUENCE    varint
    5  DELETED_FILE     varint level, varint file number
    6  NEW_FILE         varint level, varint file number, varint file size,
                        varstring smallest internal key,
                        varstring largest internal key
    7  MIN_LOG_TO_KEEP  varint   WAL files numbered < this are not needed
                                 at all (see db.py: _flush)
    8  FLUSHED_LSN      varint   WAL records with lsn <= this are reflected
                                 in tables
"""

from .coding import put_length_prefixed, put_varint

TAG_COMPARATOR = 1
TAG_LOG_NUMBER = 2
TAG_NEXT_FILE_NUMBER = 3
TAG_LAST_SEQUENCE = 4
TAG_DELETED_FILE = 5
TAG_NEW_FILE = 6
TAG_MIN_LOG_TO_KEEP = 7
TAG_FLUSHED_LSN = 8

COMPARATOR_NAME = b"lsmkv.BytewiseComparator"


class FileMeta:
    def __init__(self, number, size, smallest, largest):
        self.number = number
        self.size = size
        self.smallest = smallest
        self.largest = largest


class VersionEdit:
    def __init__(self):
        self.comparator = None
        self.log_number = None
        self.next_file_number = None
        self.last_sequence = None
        self.min_log_to_keep = None
        self.flushed_lsn = None
        self.deleted_files = []  # (level, number)
        self.new_files = []      # (level, FileMeta)

    def encode(self) -> bytes:
        out = bytearray()
        if self.comparator is not None:
            out += put_varint(TAG_COMPARATOR) + put_length_prefixed(self.comparator)
        if self.log_number is not None:
            out += put_varint(TAG_LOG_NUMBER) + put_varint(self.log_number)
        if self.next_file_number is not None:
            out += put_varint(TAG_NEXT_FILE_NUMBER) + put_varint(self.next_file_number)
        if self.last_sequence is not None:
            out += put_varint(TAG_LAST_SEQUENCE) + put_varint(self.last_sequence)
        if self.min_log_to_keep is not None:
            out += put_varint(TAG_MIN_LOG_TO_KEEP) + put_varint(self.min_log_to_keep)
        if self.flushed_lsn is not None:
            out += put_varint(TAG_FLUSHED_LSN) + put_varint(self.flushed_lsn)
        for level, number in self.deleted_files:
            out += put_varint(TAG_DELETED_FILE) + put_varint(level) + put_varint(number)
        for level, f in self.new_files:
            out += put_varint(TAG_NEW_FILE) + put_varint(level) + put_varint(f.number)
            out += put_varint(f.size)
            out += put_length_prefixed(f.smallest) + put_length_prefixed(f.largest)
        return bytes(out)
