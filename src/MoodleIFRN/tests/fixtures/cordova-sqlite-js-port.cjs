// Actual cordova-sqlite-storage JS transactions; native cordova.exec is simulated with desktop SQLite.
const fs = require('node:fs');
const vm = require('node:vm');
const {DatabaseSync} = require('node:sqlite');
class CordovaJsPort {
    constructor(filename) {
        this.native = new DatabaseSync(filename);
        this.native.exec('PRAGMA synchronous=FULL');
        this.trace = [];
        this.atomicBatch = true; // THIS desktop test host; not runtime capability detection for production.
        this.commitAck = undefined;
        this.context = vm.createContext({window: {setImmediate: queueMicrotask}, console: {log() {}},
            cordova: {exec: (ok, fail, service, action, args) => this.dispatch(ok, fail, action, args)}});
        vm.runInContext(fs.readFileSync('node_modules/cordova-sqlite-storage/www/SQLitePlugin.js', 'utf8'), this.context);
        this.core = {execute: (sql, values) => this.execute(sql, values)};
    }
    async open() {
        await new Promise((resolve, reject) => {
            Object.assign(this.context, {ok: resolve, fail: reject});
            vm.runInContext("this.db = sqlitePlugin.openDatabase({name:'p08-isolated.sqlite',location:'default'},ok,fail)", this.context);
        });
    }
    dispatch(ok, fail, action, args) {
        queueMicrotask(() => {
            if (action === 'open') return ok();
            if (action === 'close') return ok(); // Host connection closed explicitly by test teardown.
            if (action !== 'backgroundExecuteSqlBatch') throw new Error(`unsupported synthetic bridge action ${action}`);
            const results = args[0].executes.map(({sql, params}) => {
                this.trace.push(sql.trim().split(/\s+/)[0].toUpperCase());
                try {
                    const statement = this.native.prepare(sql);
                    let result;
                    if (statement.columns().length) result = {rows: statement.all(...params).map(row => ({...row})), rowsAffected: 0};
                    else { const r = statement.run(...params); result = {rows: [], rowsAffected: Number(r.changes), insertId: Number(r.lastInsertRowid)}; }
                    return {type: 'success', result};
                } catch { return {type: 'error', result: {message: 'synthetic SQL failure', code: 6}}; }
            });
            if (this.holdCommit && args[0].executes.some(q => q.sql === 'COMMIT')) {
                this.holdCommit = false;
                this.commitAck = () => ok(results);
                this.ackReady?.();
            } else ok(results);
        });
    }
    async batch(label, statements) {
        await new Promise((resolve, reject) => {
            Object.assign(this.context, {payload: JSON.stringify(statements), ok: resolve, fail: reject});
            vm.runInContext('db.sqlBatch(JSON.parse(payload),ok,fail)', this.context);
        });
    }
    async execute(sql, params = []) {
        return new Promise((resolve, reject) => {
            Object.assign(this.context, {sql, payload: JSON.stringify(params), ok: resolve, fail: reject});
            vm.runInContext('db.executeSql(sql,JSON.parse(payload),ok,fail)', this.context);
        });
    }
    async rows(sql, params) {
        const result = await this.execute(sql, params);
        return Array.from({length: result.rows.length}, (_, i) => ({...result.rows.item(i)}));
    }
    close() { this.native.close(); }
}
function protocolAvailable({enabled, platform, atomicBatch, durableCredentials}) {
    // Experimental policy only: evaluate BEFORE protocol starts. Do not fallback after an unknown commit.
    return enabled === true && platform === 'android' && atomicBatch === true && durableCredentials === true;
}
module.exports = {CordovaJsPort, protocolAvailable};
