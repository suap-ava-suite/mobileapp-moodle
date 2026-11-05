'use strict';

/** Opt-in JS contract for a future versioned Cordova plugin action. */
class SQLiteSessionLedgerBridge {
    constructor(exec) {
        if (typeof exec !== 'function') throw new TypeError('Cordova exec function required');
        this.exec = exec;
    }

    async prepare(attempt) {
        const result = await this.#call('sessionLedgerPublish', { ...attempt, phase: 'reserve' });
        return result.state === 'prepared' ? { ...attempt, sequence: result.sequence } : result;
    }

    async publish(attempt) {
        const prepared = attempt.sequence ? attempt : await this.prepare(attempt);
        if (prepared.state) return prepared;
        return this.#call('sessionLedgerPublish', { ...prepared, phase: 'commit' });
    }

    reconcile(attempt) { return this.#call('sessionLedgerReconcile', attempt); }

    #call(action, attempt) {
        const required = ['operationId', 'attemptId', 'owner', 'epoch', 'generation'];
        if (!attempt || required.some(key => attempt[key] === undefined || attempt[key] === null || attempt[key] === '')) {
            return Promise.reject(new TypeError('complete session attempt metadata required'));
        }
        if ((action === 'sessionLedgerReconcile' || attempt.phase !== 'reserve') && !Number.isSafeInteger(attempt.sequence)) {
            return Promise.reject(new TypeError('native sequence required for this ledger operation'));
        }
        return new Promise((resolve, reject) => {
            this.exec(result => {
                if (!result || typeof result.state !== 'string') return reject(new Error('invalid native ledger response'));
                if (result.state === 'unknown') return resolve({ state: 'unknown', quarantined: true });
                resolve(result);
            }, error => reject(error instanceof Error ? error : new Error(String(error))),
            'SQLitePlugin', action, [attempt]);
        });
    }
}

module.exports = { SQLiteSessionLedgerBridge };
