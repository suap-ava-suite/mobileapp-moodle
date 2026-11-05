package br.edu.ifrn.experimental.p10;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteException;
import java.io.File;
import java.util.HashMap;
import java.util.Map;

/**
 * Isolated Android-side experiment. It owns a dedicated DB file and must not be
 * pointed at Moodle's database. The Cordova action/queue wiring is deliberately
 * left for a reviewed plugin patch; callers must serialize access per instance.
 */
public final class ExperimentalSessionLedger implements AutoCloseable {
    public static final class Attempt {
        public final String operationId, attemptId, owner;
        public final long epoch, generation;
        public long sequence;
        public Attempt(String operationId, String attemptId, String owner, long epoch, long generation) {
            this.operationId = required(operationId); this.attemptId = required(attemptId);
            this.owner = required(owner); this.epoch = epoch; this.generation = generation;
        }
    }
    public static final class Result {
        public final String state;
        public final String receipt;
        Result(String state, String receipt) { this.state = state; this.receipt = receipt; }
    }

    private final File file;
    private SQLiteDatabase db;
    private final Map<String, String> terminal = new HashMap<>();

    public ExperimentalSessionLedger(File privateDirectory, String isolatedFilename) {
        if (isolatedFilename == null || !isolatedFilename.matches("ifrn-p10-[a-zA-Z0-9_-]+\\.sqlite"))
            throw new IllegalArgumentException("experimental ledger filename required");
        if (!privateDirectory.isDirectory() && !privateDirectory.mkdirs())
            throw new IllegalStateException("cannot create private experimental ledger directory");
        file = new File(privateDirectory, isolatedFilename);
        open();
        db.execSQL("CREATE TABLE IF NOT EXISTS control (id INTEGER PRIMARY KEY CHECK(id=1), seq INTEGER NOT NULL, operation_id TEXT, attempt_id TEXT, owner TEXT, epoch INTEGER, generation INTEGER)");
        db.execSQL("INSERT OR IGNORE INTO control(id,seq) VALUES(1,0)");
        db.execSQL("CREATE TABLE IF NOT EXISTS intent (operation_id TEXT PRIMARY KEY, seq INTEGER UNIQUE NOT NULL, attempt_id TEXT NOT NULL, owner TEXT NOT NULL, epoch INTEGER NOT NULL, generation INTEGER NOT NULL, state TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS pointer (id INTEGER PRIMARY KEY CHECK(id=1), operation_id TEXT NOT NULL, seq INTEGER NOT NULL, attempt_id TEXT NOT NULL, owner TEXT NOT NULL, epoch INTEGER NOT NULL, generation INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS receipt (operation_id TEXT PRIMARY KEY, seq INTEGER UNIQUE NOT NULL, attempt_id TEXT NOT NULL, owner TEXT NOT NULL, epoch INTEGER NOT NULL, generation INTEGER NOT NULL, result TEXT NOT NULL, confirmation TEXT NOT NULL)");
    }

    /** Durable intent reserves the monotonic sequence before publication. */
    public synchronized Attempt reserve(Attempt a) {
        db.beginTransaction();
        try {
            long current = scalar("SELECT seq FROM control WHERE id=1");
            a.sequence = current + 1;
            ContentValues control = new ContentValues();
            control.put("seq", a.sequence); control.put("operation_id", a.operationId);
            control.put("attempt_id", a.attemptId); control.put("owner", a.owner);
            control.put("epoch", a.epoch); control.put("generation", a.generation);
            db.update("control", control, "id=1", null);
            ContentValues intent = values(a); intent.put("state", "prepared");
            db.insertOrThrow("intent", null, intent);
            db.setTransactionSuccessful();
            return a;
        } finally { db.endTransaction(); }
    }

    /** Pointer + receipt + confirmed intent are one SQLite transaction. Never retries COMMIT. */
    public synchronized Result publish(Attempt a) {
        if (receiptMatches(a)) return isCurrent(a) && pointerMatches(a)
            ? new Result("committed", a.operationId + ":" + a.sequence) : new Result("rejected-stale", null);
        boolean began = false, commitStarted = false;
        try {
            db.beginTransaction(); began = true;
            if (!isCurrent(a)) {
                db.setTransactionSuccessful(); db.endTransaction(); began = false;
                terminal.put(a.operationId, "rejected");
                return new Result("rejected-stale", null);
            }
            ContentValues pointer = values(a);
            if (db.update("pointer", pointer, "id=1", null) == 0) {
                pointer.put("id", 1); db.insertOrThrow("pointer", null, pointer);
            }
            ContentValues receipt = values(a); receipt.put("result", "published"); receipt.put("confirmation", "committed");
            db.insertOrThrow("receipt", null, receipt);
            ContentValues confirmed = new ContentValues(); confirmed.put("state", "confirmed");
            db.update("intent", confirmed, "operation_id=? AND seq=?", new String[]{a.operationId, Long.toString(a.sequence)});
            db.setTransactionSuccessful();
            commitStarted = true;
            db.endTransaction(); began = false;
            terminal.put(a.operationId, "committed");
            return new Result("committed", a.operationId + ":" + a.sequence);
        } catch (RuntimeException e) {
            if (commitStarted) terminal.put(a.operationId, "unknown");
            else if (began) {
                try { db.endTransaction(); terminal.put(a.operationId, "rolled-back"); }
                catch (RuntimeException endFailure) { terminal.put(a.operationId, "unknown"); }
            }
            return new Result("unknown", null);
        }
    }

    /**
     * Reconciliation closes and reopens only this dedicated ledger connection before
     * reading. A failed close/open/query returns unknown; absence is never enough
     * without the close/reopen recovery barrier.
     */
    public synchronized Result reconcile(Attempt a) {
        try {
            // Close only this private ledger DB. Android's SQLite close releases its
            // connection and rolls back an uncommitted transaction before reopen.
            if (db != null && db.isOpen()) db.close();
            db = null;
            open(); // Android SQLite recovery runs before the new connection can read.
            try (Cursor receipt = db.rawQuery("SELECT seq,attempt_id,owner,epoch,generation,result,confirmation FROM receipt WHERE operation_id=?", new String[]{a.operationId})) {
                if (receipt.moveToFirst()) {
                    if (receipt.getLong(0) != a.sequence || !receipt.getString(1).equals(a.attemptId) ||
                        !receipt.getString(2).equals(a.owner) || receipt.getLong(3) != a.epoch ||
                        receipt.getLong(4) != a.generation || !receipt.getString(5).equals("published") ||
                        !receipt.getString(6).equals("committed") || !isCurrent(a) || !pointerMatches(a)) return new Result("rejected-stale", null);
                    return new Result("committed", a.operationId + ":" + a.sequence);
                }
            }
            if (!intentMatches(a)) return new Result("rejected-invalid-receipt", null);
            return new Result("rolled-back", null);
        } catch (RuntimeException e) { return new Result("unknown", null); }
    }

    private boolean isCurrent(Attempt a) {
        try (Cursor c = db.rawQuery("SELECT seq,operation_id,attempt_id,owner,epoch,generation FROM control WHERE id=1", null)) {
            return c.moveToFirst() && c.getLong(0) == a.sequence && c.getString(1).equals(a.operationId) &&
                c.getString(2).equals(a.attemptId) && c.getString(3).equals(a.owner) &&
                c.getLong(4) == a.epoch && c.getLong(5) == a.generation;
        }
    }
    private boolean pointerMatches(Attempt a) { return matches("pointer", a); }
    private boolean intentMatches(Attempt a) { return matches("intent", a); }
    private boolean receiptMatches(Attempt a) {
        try (Cursor c = db.rawQuery("SELECT seq,attempt_id,owner,epoch,generation,result,confirmation FROM receipt WHERE operation_id=?", new String[]{a.operationId})) {
            return c.moveToFirst() && c.getLong(0) == a.sequence && c.getString(1).equals(a.attemptId) &&
                c.getString(2).equals(a.owner) && c.getLong(3) == a.epoch && c.getLong(4) == a.generation &&
                c.getString(5).equals("published") && c.getString(6).equals("committed");
        }
    }
    private boolean matches(String table, Attempt a) {
        try (Cursor c = db.rawQuery("SELECT seq,attempt_id,owner,epoch,generation FROM " + table + " WHERE operation_id=?", new String[]{a.operationId})) {
            return c.moveToFirst() && c.getLong(0) == a.sequence && c.getString(1).equals(a.attemptId) &&
                c.getString(2).equals(a.owner) && c.getLong(3) == a.epoch && c.getLong(4) == a.generation;
        }
    }
    private long scalar(String sql) { try (Cursor c = db.rawQuery(sql, null)) { if (!c.moveToFirst()) throw new SQLiteException("missing control row"); return c.getLong(0); } }
    private static ContentValues values(Attempt a) {
        ContentValues v = new ContentValues(); v.put("operation_id", a.operationId); v.put("seq", a.sequence);
        v.put("attempt_id", a.attemptId); v.put("owner", a.owner); v.put("epoch", a.epoch); v.put("generation", a.generation); return v;
    }
    private void open() { db = SQLiteDatabase.openOrCreateDatabase(file, null); }
    private static String required(String value) { if (value == null || value.isEmpty()) throw new IllegalArgumentException("missing identifier"); return value; }
    @Override public synchronized void close() { if (db != null && db.isOpen()) db.close(); db = null; }
}
