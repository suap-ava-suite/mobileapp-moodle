'use strict';

// Desktop experiment for the P0.10 protocol. Uses real node:sqlite; it is not
// the Cordova plugin implementation and must never be wired to Moodle data.
const { DatabaseSync } = require('node:sqlite');

class SessionLedger {
    constructor(filename) {
        this.db = new DatabaseSync(filename);
        this.db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = FULL;
            CREATE TABLE IF NOT EXISTS ledger_control (
                id INTEGER PRIMARY KEY CHECK (id = 1), sequence INTEGER NOT NULL DEFAULT 0,
                attempt_id TEXT, owner TEXT, epoch INTEGER, generation INTEGER
            );
            INSERT OR IGNORE INTO ledger_control(id) VALUES (1);
            CREATE TABLE IF NOT EXISTS session_pointer (
                id INTEGER PRIMARY KEY CHECK (id = 1), operation_id TEXT NOT NULL,
                sequence INTEGER NOT NULL, attempt_id TEXT NOT NULL, owner TEXT NOT NULL,
                epoch INTEGER NOT NULL, generation INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS session_intent (
                operation_id TEXT PRIMARY KEY, sequence INTEGER NOT NULL UNIQUE,
                attempt_id TEXT NOT NULL, owner TEXT NOT NULL, epoch INTEGER NOT NULL,
                generation INTEGER NOT NULL, state TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS session_receipt (
                operation_id TEXT PRIMARY KEY, sequence INTEGER NOT NULL UNIQUE,
                attempt_id TEXT NOT NULL, owner TEXT NOT NULL, epoch INTEGER NOT NULL,
                generation INTEGER NOT NULL, publication_result TEXT NOT NULL,
                confirmation_state TEXT NOT NULL
            );
        `);
        this.terminal = new Map();
    }

    close() { this.db.close(); }

    reserve(meta) {
        const existing = this.db.prepare('SELECT * FROM session_intent WHERE operation_id = ?').get(meta.operationId);
        if (existing) {
            const same = existing.attempt_id === meta.attemptId && existing.owner === meta.owner &&
                existing.epoch === meta.epoch && existing.generation === meta.generation;
            if (!same) throw new Error('operationId is already bound to different attempt metadata');
            return { ...meta, sequence: existing.sequence };
        }
        this.db.exec('BEGIN IMMEDIATE');
        try {
            const current = this.db.prepare('SELECT sequence FROM ledger_control WHERE id=1').get();
            const sequence = current.sequence + 1;
            this.db.prepare(`UPDATE ledger_control SET sequence=?, attempt_id=?, owner=?, epoch=?, generation=? WHERE id=1`)
                .run(sequence, meta.attemptId, meta.owner, meta.epoch, meta.generation);
            this.db.prepare(`INSERT INTO session_intent(operation_id, sequence, attempt_id, owner, epoch, generation, state)
                VALUES(?, ?, ?, ?, ?, ?, 'prepared')`)
                .run(meta.operationId, sequence, meta.attemptId, meta.owner, meta.epoch, meta.generation);
            this.db.exec('COMMIT');
            return { ...meta, sequence };
        } catch (error) {
            try { this.db.exec('ROLLBACK'); } catch { /* a failed rollback remains unknown to caller */ }
            throw error;
        }
    }

    publish(reserved, { beforeCommit, afterCommit } = {}) {
        const previous = this.db.prepare('SELECT * FROM session_receipt WHERE operation_id=?').get(reserved.operationId);
        if (previous) return this.#checkReceipt(previous, reserved);
        this.db.exec('BEGIN IMMEDIATE');
        try {
            const fence = this.db.prepare('SELECT * FROM ledger_control WHERE id=1').get();
            if (fence.sequence !== reserved.sequence || fence.attempt_id !== reserved.attemptId ||
                fence.owner !== reserved.owner || fence.epoch !== reserved.epoch || fence.generation !== reserved.generation) {
                this.db.exec('ROLLBACK');
                this.terminal.set(reserved.operationId, 'rejected');
                return { status: 'rejected-stale' };
            }
            beforeCommit?.(this.db, reserved);
            this.db.prepare(`INSERT INTO session_pointer(id, operation_id, sequence, attempt_id, owner, epoch, generation)
                VALUES(1, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET operation_id=excluded.operation_id, sequence=excluded.sequence,
                attempt_id=excluded.attempt_id, owner=excluded.owner, epoch=excluded.epoch, generation=excluded.generation`)
                .run(reserved.operationId, reserved.sequence, reserved.attemptId, reserved.owner, reserved.epoch, reserved.generation);
            this.db.prepare(`INSERT INTO session_receipt(operation_id, sequence, attempt_id, owner, epoch, generation,
                publication_result, confirmation_state) VALUES(?, ?, ?, ?, ?, ?, 'published', 'committed')`)
                .run(reserved.operationId, reserved.sequence, reserved.attemptId, reserved.owner, reserved.epoch, reserved.generation);
            this.db.prepare(`UPDATE session_intent SET state='confirmed' WHERE operation_id=?`).run(reserved.operationId);
            this.db.exec('COMMIT');
            this.terminal.set(reserved.operationId, 'committed');
            afterCommit?.(reserved); // Models a lost/delayed ACK only after SQLite returned from COMMIT.
            return { status: 'committed', receipt: this.receipt(reserved.operationId) };
        } catch (error) {
            let terminal = false;
            try { this.db.exec('ROLLBACK'); terminal = true; } catch { /* unknown; caller must quarantine */ }
            if (terminal) this.terminal.set(reserved.operationId, 'rolled-back');
            else this.terminal.set(reserved.operationId, 'unknown');
            throw error;
        }
    }

    reconcile(reserved, barrier) {
        try {
        const terminal = this.terminal.get(reserved.operationId);
        const barrierMatches = barrier?.kind === 'p10-ledger-close-reopen-v1' &&
            barrier.operationId === reserved.operationId && barrier.sequence === reserved.sequence;
        if ((terminal === 'unknown' && !barrierMatches) || (!this.terminal.has(reserved.operationId) && !barrierMatches)) {
            return { status: 'unknown', reason: 'transaction-terminality-unproven' };
        }
        const row = this.db.prepare('SELECT * FROM session_receipt WHERE operation_id=?').get(reserved.operationId);
        if (!row) {
            const intent = this.db.prepare('SELECT * FROM session_intent WHERE operation_id=?').get(reserved.operationId);
            if (!intent || intent.sequence !== reserved.sequence || intent.attempt_id !== reserved.attemptId ||
                intent.owner !== reserved.owner || intent.epoch !== reserved.epoch || intent.generation !== reserved.generation) {
                return { status: 'rejected-invalid-intent' };
            }
            return terminal === 'rolled-back' || barrierMatches ? { status: 'rolled-back' }
                : { status: 'unknown', reason: 'receipt-absent-without-rollback-proof' };
        }
        const checked = this.#checkReceipt(row, reserved);
        if (checked.status !== 'committed') return checked;
        const fence = this.db.prepare('SELECT * FROM ledger_control WHERE id=1').get();
        const pointer = this.db.prepare('SELECT * FROM session_pointer WHERE id=1').get();
        if (fence.sequence !== reserved.sequence || fence.attempt_id !== reserved.attemptId || fence.owner !== reserved.owner ||
            fence.epoch !== reserved.epoch || fence.generation !== reserved.generation ||
            !pointer || pointer.operation_id !== reserved.operationId || pointer.sequence !== reserved.sequence ||
            pointer.owner !== reserved.owner || pointer.epoch !== reserved.epoch || pointer.generation !== reserved.generation) {
            return { status: 'rejected-stale' };
        }
        return checked;
        } catch (error) {
            return { status: 'unknown', reason: 'reconciliation-io-failure' };
        }
    }

    receipt(operationId) { return this.db.prepare('SELECT * FROM session_receipt WHERE operation_id=?').get(operationId); }
    pointer() { return this.db.prepare('SELECT * FROM session_pointer WHERE id=1').get(); }

    #checkReceipt(row, expected) {
        const matches = row.operation_id === expected.operationId && row.sequence === expected.sequence &&
            row.attempt_id === expected.attemptId && row.owner === expected.owner && row.epoch === expected.epoch &&
            row.generation === expected.generation && row.publication_result === 'published' &&
            row.confirmation_state === 'committed';
        return matches ? { status: 'committed', receipt: row } : { status: 'rejected-invalid-receipt' };
    }
}

module.exports = { SessionLedger };
