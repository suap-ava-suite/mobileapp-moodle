// TEST-ONLY protocol model. AtomicAuthority is a required NEW port, not an existing core API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

const STATES = Object.freeze(['created', 'validating', 'prepared', 'confirmed', 'cancelled', 'expired', 'rejected']);
const TERMINAL = new Set(STATES.slice(3));
const SITE = 'https://academic.synthetic.invalid';

// No timer, sleep, network, native plugin or uncontrolled completion order.
class ControlledIO {
    pending = new Map();
    arrivals = new Map();
    schedule(key, operation) {
        assert(!this.pending.has(key), `duplicate operation ${key}`);
        const promise = new Promise((resolve, reject) => this.pending.set(key, {operation, resolve, reject}));
        this.arrivals.get(key)?.();
        this.arrivals.delete(key);
        return promise;
    }
    async wait(key) {
        if (!this.pending.has(key)) await new Promise(resolve => this.arrivals.set(key, resolve));
    }
    async run(key, failure) {
        await this.wait(key);
        const task = this.pending.get(key);
        this.pending.delete(key);
        try {
            if (failure) throw new Error(failure);
            task.resolve(task.operation());
        } catch (error) {
            task.reject(error);
        }
    }
}

// Extract the official method, unchanged; do not duplicate its signature algorithm.
const sourcePath = 'src/core/features/login/services/login-helper.ts';
const source = fs.readFileSync(sourcePath, 'utf8');
const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
let validator;
for (const statement of ast.statements) {
    if (!ts.isClassDeclaration(statement)) continue;
    for (const member of statement.members) {
        if (ts.isMethodDeclaration(member) && member.name.getText(ast) === 'validateBrowserSSOLogin') {
            assert.equal(validator, undefined);
            validator = member.getText(ast);
        }
    }
}
assert(validator, 'official passport validator not found');

function officialPassport(launch, consume) {
    const context = {
        CoreConfig: {get: async () => JSON.stringify(launch), delete: () => consume()},
        LOGIN_SSO_LAUNCH_DATA: 'synthetic-launch',
        CoreText: {parseJSON: (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } }},
        Md5: {hashAsciiStr: value => crypto.createHash('md5').update(value, 'ascii').digest('hex')},
        CoreError: Error, Translate: {instant: () => 'invalid synthetic signature'},
    };
    vm.runInNewContext(ts.transpileModule(`class Validator {${validator}}; this.Validator = Validator;`, {
        compilerOptions: {target: ts.ScriptTarget.ES2022},
    }).outputText, context);
    const instance = new context.Validator();
    instance.logger = {debug() {}}; // Never retain the official validator's sensitive error logs.
    return value => instance.validateBrowserSSOLogin(value);
}

class CoreSessionAttempt {
    constructor(authority, record, runtime) {
        this.authority = authority;
        this.id = record.id;
        this.runtime = runtime;
    }
    get record() { return this.authority.records.get(this.id); }
    get state() { return this.record.state; }
    cancel() { return this.authority.terminate(this, 'cancelled'); }
    expire() {
        assert(TERMINAL.has(this.state) || this.authority.now >= this.record.deadline, 'deadline not reached');
        return this.authority.terminate(this, 'expired');
    }
    accept(payload, info) {
        // A duplicate callback joins exactly the same work, including a rejected/terminal attempt.
        return this.work ||= this.prepare(payload, info);
    }
    async prepare(payload, info) {
        const a = this.authority;
        try {
            a.guard(this);
            a.transition(this.record, 'validating');
            const launch = a.launches.get(this.id);
            const data = await officialPassport(launch, () => a.launches.delete(this.id))(payload);
            a.guard(this);
            if (data.siteUrl !== this.record.site || !data.token) throw new Error('environment rejected');
            const profile = await a.io.schedule(`${this.id}:fetch`, () => ({...info}));
            a.guard(this);
            if (profile.username !== this.record.owner || profile.siteUrl !== this.record.site || !profile.enrolled) {
                throw new Error('SUAP owner / course mismatch');
            }
            // Immutable candidate namespaces; neither store's completion publishes a session.
            const metadata = {attempt: this.id, owner: this.record.owner, epoch: this.record.epoch,
                site: this.record.site, course: this.record.course, secureKey: this.id};
            const writes = await Promise.allSettled([
                a.io.schedule(`${this.id}:db`, () => a.candidates.set(this.id, Object.freeze(metadata))),
                a.io.schedule(`${this.id}:secure`, () => a.secure.set(this.id,
                    Object.freeze({token: data.token, privateToken: data.privateToken}))),
            ]);
            a.guard(this);
            if (writes.some(result => result.status === 'rejected')) throw new Error('partial persistence');
            a.transition(this.record, 'prepared');
            return true;
        } catch {
            a.terminate(this, 'rejected');
            return false;
        }
    }
    commit() { return this.commitWork ||= this.publish(); }
    async publish() {
        const a = this.authority;
        try {
            a.guard(this);
            assert.equal(this.state, 'prepared');
            const receipt = await a.io.schedule(`${this.id}:commit-apply`, () => a.confirm(this));
            // Deliberately separate durability from acknowledgement (lost/late ACK).
            await a.io.schedule(`${this.id}:commit-ack`, () => receipt);
            if (!a.isLeaseCurrent(this)) return false;
            return true;
        } catch {
            // Never roll back a possibly durable confirmation on an ACK error.
            a.terminate(this, 'rejected');
            return false;
        }
    }
    deliver() { return this.delivery ||= this.deliverEffects(); }
    runLoginObserver() {
        return this.authority.io.schedule(`${this.id}:LOGIN-observer`, () => this.authority.effect(this, 'LOGIN-observer'));
    }
    async deliverEffects() {
        const a = this.authority;
        for (const kind of ['activation', 'LOGIN', 'navigation']) {
            const applied = await a.io.schedule(`${this.id}:${kind}`, () => a.effect(this, kind));
            if (!applied) return false;
        }
        return true;
    }
}

class AtomicAuthority {
    io = new ControlledIO();
    records = new Map();
    handles = new Map();
    usedLaunches = new Set();
    launches = new Map();
    candidates = new Map();
    secure = new Map();
    journal = [];
    effects = [];
    owner = null;
    epoch = 0;
    generation = 0;
    latest = null;
    published = null;
    active = null;
    observerState = null;
    now = 0;
    runtime = 1;

    // Synchronous methods stand for LINEARIZABLE durable transactions, including cancellation.
    // A real adapter must serialize SUAP revocation, confirmation and recovery with this authority.
    transition(record, state) {
        assert(STATES.includes(state));
        const allowed = {created: ['validating', 'cancelled', 'expired', 'rejected'],
            validating: ['prepared', 'cancelled', 'expired', 'rejected'],
            prepared: ['confirmed', 'cancelled', 'expired', 'rejected']};
        assert(allowed[record.state]?.includes(state), `${record.state} -> ${state}`);
        this.journal.push({id: record.id, from: record.state, to: state});
        record.state = state;
    }
    setSuap(owner) {
        this.epoch++;
        this.owner = owner;
        this.latest = null;
        this.published = null;
        this.active = null;
        this.observerState = null;
        for (const record of this.records.values()) {
            if (!TERMINAL.has(record.state)) this.transition(record, 'cancelled');
        }
    }
    begin({site = SITE, course = 'synthetic-course', ttl = 100, passport} = {}) {
        assert(this.owner, 'SUAP identity required');
        assert(site.startsWith('https://') && new URL(site).origin === site, 'exact HTTPS environment required');
        const launchPassport = passport ?? this.generation + 101;
        assert(Number.isSafeInteger(launchPassport), 'safe integer passport required in this model');
        const launchKey = `${site}|${launchPassport}`;
        assert(!this.usedLaunches.has(launchKey), 'passport reuse would make callbacks ambiguous');
        if (this.latest) {
            const old = this.records.get(this.latest);
            if (!TERMINAL.has(old.state)) this.transition(old, 'cancelled');
        }
        const id = `attempt-${++this.generation}`;
        const record = {id, owner: this.owner, epoch: this.epoch, generation: this.generation, site, course,
            state: 'created', deadline: this.now + ttl, delivered: new Set()};
        this.records.set(id, record);
        this.latest = id;
        this.launches.set(id, {siteUrl: site, passport: launchPassport});
        this.usedLaunches.add(launchKey);
        const attempt = new CoreSessionAttempt(this, record, this.runtime);
        this.handles.set(id, attempt);
        return attempt;
    }
    async routeCallback(payload, info) {
        // Unbound/global callbacks must NOT be assigned destructively to whichever account is latest.
        // Probe the real validator with an isolated snapshot and a no-op consume first.
        const attempt = this.handles.get(this.latest);
        if (!attempt) return false;
        try {
            this.guard(attempt);
            await officialPassport(this.launches.get(attempt.id), () => {})(payload);
            this.guard(attempt);
            return attempt.accept(payload, info);
        } catch {
            return false; // Unknown/stale payload leaves the current launch and attempt intact.
        }
    }
    terminate(attempt, state) {
        const record = attempt.record;
        if (!TERMINAL.has(record.state)) this.transition(record, state);
        return record.state; // confirmed is irrevocable; do NOT report successful cancellation after commit.
    }
    guard(attempt) {
        const record = attempt.record;
        if (!TERMINAL.has(record.state) && this.now >= record.deadline) this.transition(record, 'expired');
        if (attempt.runtime !== this.runtime || record.epoch !== this.epoch || record.owner !== this.owner
            || this.latest !== attempt.id || TERMINAL.has(record.state)) throw new Error('obsolete attempt');
    }
    confirm(attempt) {
        this.guard(attempt);
        const record = attempt.record;
        assert.equal(record.state, 'prepared');
        assert(this.candidates.has(record.id) && this.secure.has(record.id), 'both immutable writes required');
        // LINEARIZATION: state + published pointer + fencing metadata in ONE durable transaction.
        this.transition(record, 'confirmed');
        this.published = {id: record.id, owner: record.owner, epoch: record.epoch, generation: record.generation};
        return {...this.published};
    }
    isLeaseCurrent(attempt) {
        const r = attempt.record;
        return attempt.runtime === this.runtime && r.state === 'confirmed' && this.latest === r.id
            && r.owner === this.owner && r.epoch === this.epoch && this.visible() === r.id;
    }
    effect(attempt, kind) {
        // Checked at the actual mutation/delivery, NOT when an async navigation is enqueued.
        if (!this.isLeaseCurrent(attempt)) return false;
        const r = attempt.record;
        if (r.delivered.has(kind)) return true;
        const previous = {LOGIN: 'activation', navigation: 'LOGIN', 'LOGIN-observer': 'LOGIN'}[kind];
        if (previous && !r.delivered.has(previous)) return false;
        r.delivered.add(kind);
        if (kind === 'activation') this.active = r.id;
        if (kind === 'LOGIN-observer') this.observerState = r.id;
        this.effects.push({id: r.id, kind, owner: r.owner, epoch: r.epoch, generation: r.generation,
            site: r.site, course: r.course});
        return true;
    }
    recover() {
        // Model process interruption: old JS completions retain the previous runtime fence.
        this.runtime++;
        this.active = null;
        for (const r of this.records.values()) {
            if (!TERMINAL.has(r.state)) this.transition(r, 'cancelled');
        }
        const r = this.records.get(this.published?.id);
        if (r?.state === 'confirmed' && r.owner === this.owner && r.epoch === this.epoch
            && this.candidates.has(r.id) && this.secure.has(r.id)) this.active = r.id;
        // No LOGIN/navigation replay: at-most-once, not exactly-once across crashes.
        return this.active;
    }
    collect(id) {
        const r = this.records.get(id);
        if (!r || !TERMINAL.has(r.state) || r.state === 'confirmed') return false;
        // Retain record/tombstone. An uncancellable late writer can recreate ONLY its own orphan.
        this.candidates.delete(id);
        this.secure.delete(id);
        this.launches.delete(id);
        return true;
    }
    visible() {
        const r = this.records.get(this.published?.id);
        if (r?.state !== 'confirmed' || r.owner !== this.owner || r.epoch !== this.epoch) return null;
        if (!this.candidates.has(r.id) || !this.secure.has(r.id)) return null;
        return r.id;
    }
    checkpoint() {
        // Synthetic disk image, INCLUDING synthetic secrets: never use this adapter on real data.
        return JSON.stringify({owner: this.owner, epoch: this.epoch, generation: this.generation,
            latest: this.latest, published: this.published, now: this.now,
            records: [...this.records].map(([id, r]) => [id, {...r, delivered: [...r.delivered]}]),
            candidates: [...this.candidates], secure: [...this.secure], launches: [...this.launches],
            usedLaunches: [...this.usedLaunches]});
    }
    static fromCheckpoint(image, trustedSuap) {
        const disk = JSON.parse(image);
        const a = new AtomicAuthority();
        for (const key of ['owner', 'epoch', 'generation', 'latest', 'published', 'now']) a[key] = disk[key];
        a.records = new Map(disk.records.map(([id, r]) => [id, {...r, delivered: new Set(r.delivered)}]));
        for (const key of ['candidates', 'secure', 'launches']) a[key] = new Map(disk[key]);
        a.usedLaunches = new Set(disk.usedLaunches);
        if (a.owner !== trustedSuap.owner || a.epoch !== trustedSuap.epoch) {
            // A disk Moodle record cannot establish the primary identity on its own.
            a.setSuap(trustedSuap.owner);
            a.epoch = trustedSuap.epoch;
        }
        a.recover();
        return a;
    }
}

function payloadFor(authority, attempt, token = `synthetic-token-${attempt.id}`) {
    const launch = authority.launches.get(attempt.id);
    const signature = crypto.createHash('md5').update(launch.siteUrl + launch.passport, 'ascii').digest('hex');
    return `${signature}:::${token}:::synthetic-private`;
}
function infoFor(attempt, overrides = {}) {
    return {username: attempt.record.owner, siteUrl: attempt.record.site, enrolled: true, ...overrides};
}

module.exports = {AtomicAuthority, CoreSessionAttempt, ControlledIO, STATES, SITE, payloadFor, infoFor,
    validatorHash: crypto.createHash('sha256').update(validator).digest('hex')};
