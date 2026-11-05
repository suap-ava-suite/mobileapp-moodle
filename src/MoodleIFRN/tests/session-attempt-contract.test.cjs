const assert = require('node:assert/strict');
const test = require('node:test');
const {AtomicAuthority, STATES, SITE, payloadFor, infoFor} = require('./fixtures/core-session-attempt.cjs');

function world() {
    const a = new AtomicAuthority();
    a.setSuap('synthetic-A');
    return a;
}
function accept(a, attempt, overrides) {
    return attempt.accept(payloadFor(a, attempt), infoFor(attempt, overrides));
}
async function prepare(a, attempt, options = {}) {
    const pending = accept(a, attempt, options.info);
    await a.io.run(`${attempt.id}:fetch`);
    await a.io.run(`${attempt.id}:db`, options.dbFailure);
    await a.io.run(`${attempt.id}:secure`, options.secureFailure);
    return pending;
}
async function commit(a, attempt, options = {}) {
    const pending = attempt.commit();
    await a.io.run(`${attempt.id}:commit-apply`, options.applyFailure);
    if (!options.applyFailure) await a.io.run(`${attempt.id}:commit-ack`, options.ackFailure);
    return pending;
}
async function deliver(a, attempt) {
    const pending = attempt.deliver();
    for (const kind of ['activation', 'LOGIN', 'navigation']) await a.io.run(`${attempt.id}:${kind}`);
    return pending;
}
async function complete(a, attempt) {
    assert.equal(await prepare(a, attempt), true);
    assert.equal(await commit(a, attempt), true);
    assert.equal(await deliver(a, attempt), true);
}
function noEffects(a) {
    assert.equal(a.visible(), null);
    assert.equal(a.active, null);
    assert.deepEqual(a.effects, []);
}

test('contract: seven formal states; normal A confirms once before activation, LOGIN and navigation', async () => {
    assert.equal(STATES.length, 7);
    const a = world(), A = a.begin();
    assert.equal(A.state, 'created');
    const pending = accept(a, A);
    assert.equal(A.state, 'validating');
    await a.io.run(`${A.id}:fetch`);
    await a.io.run(`${A.id}:secure`);
    assert.equal(a.secure.size, 1);
    noEffects(a);
    await a.io.run(`${A.id}:db`);
    assert.equal(await pending, true);
    assert.equal(A.state, 'prepared');
    noEffects(a);
    assert.equal(await commit(a, A), true);
    assert.equal(A.state, 'confirmed');
    assert.equal(a.active, null);
    assert.equal(await deliver(a, A), true);
    assert.deepEqual(a.effects.map(e => e.kind), ['activation', 'LOGIN', 'navigation']);
    assert.equal(a.active, A.id);
    assert.deepEqual(a.journal.map(e => e.to), ['validating', 'prepared', 'confirmed']);
    assert.equal(A.cancel(), 'confirmed');
    assert.equal(A.expire(), 'confirmed');
});

for (const stage of ['created', 'fetch', 'db', 'secure', 'prepared', 'commit-queued']) {
    for (const reason of ['cancel', 'timeout']) {
        test(`contract: ${reason} at ${stage} cannot publish or emit effects`, async () => {
            const a = world(), A = a.begin();
            let pending;
            if (stage !== 'created') {
                pending = accept(a, A);
                await a.io.wait(`${A.id}:fetch`);
                if (stage !== 'fetch') {
                    await a.io.run(`${A.id}:fetch`);
                    await a.io.wait(`${A.id}:db`);
                    if (stage === 'secure') await a.io.run(`${A.id}:db`);
                    if (['prepared', 'commit-queued'].includes(stage)) {
                        await a.io.run(`${A.id}:db`);
                        await a.io.run(`${A.id}:secure`);
                        assert.equal(await pending, true);
                    }
                }
            }
            const publishing = stage === 'commit-queued' ? A.commit() : undefined;
            if (reason === 'cancel') assert.equal(A.cancel(), 'cancelled');
            else { a.now = A.record.deadline; A.expire(); }
            if (stage === 'fetch') await a.io.run(`${A.id}:fetch`);
            if (stage === 'db') {
                await a.io.run(`${A.id}:secure`);
                await a.io.run(`${A.id}:db`);
            }
            if (stage === 'secure') await a.io.run(`${A.id}:secure`);
            if (pending && !['prepared', 'commit-queued'].includes(stage)) assert.equal(await pending, false);
            if (publishing) {
                await a.io.run(`${A.id}:commit-apply`);
                assert.equal(await publishing, false);
            }
            assert.equal(A.state, reason === 'cancel' ? 'cancelled' : 'expired');
            noEffects(a);
        });
    }
}

test('contract: deadline is checked inside atomic commit even without a timer callback', async () => {
    const a = world(), A = a.begin();
    await prepare(a, A);
    const pending = A.commit();
    a.now = A.record.deadline;
    await a.io.run(`${A.id}:commit-apply`);
    assert.equal(await pending, false);
    assert.equal(A.state, 'expired');
    noEffects(a);
});

test('contract: durable commit wins cancellation even if its ACK is pending', async () => {
    const a = world(), A = a.begin();
    await prepare(a, A);
    const pending = A.commit();
    await a.io.run(`${A.id}:commit-apply`);
    assert.equal(A.cancel(), 'confirmed');
    assert.equal(a.visible(), A.id);
    await a.io.run(`${A.id}:commit-ack`);
    assert.equal(await pending, true);
    await deliver(a, A);
});

test('contract: a new attempt after commit invalidates the old ACK and queued effects', async () => {
    const a = world(), A = a.begin();
    await prepare(a, A);
    const pending = A.commit();
    await a.io.run(`${A.id}:commit-apply`);
    const B = a.begin();
    await a.io.run(`${A.id}:commit-ack`);
    assert.equal(await pending, false);
    const effects = A.deliver();
    await a.io.run(`${A.id}:activation`);
    assert.equal(await effects, false);
    await complete(a, B);
    assert.equal(a.active, B.id);
    assert(a.effects.every(e => e.id === B.id));
});

for (const stage of ['fetch', 'db', 'secure', 'commit', 'activation', 'LOGIN', 'navigation']) {
    test(`contract: A -> B succeeds while old A is pending at ${stage}`, async () => {
        const a = world(), A = a.begin();
        let pending;
        if (['fetch', 'db', 'secure'].includes(stage)) {
            pending = accept(a, A);
            await a.io.wait(`${A.id}:fetch`);
            if (stage !== 'fetch') {
                await a.io.run(`${A.id}:fetch`);
                await a.io.wait(`${A.id}:db`);
                if (stage === 'secure') await a.io.run(`${A.id}:db`);
            }
        } else {
            await prepare(a, A);
            if (stage === 'commit') pending = A.commit();
            else {
                await commit(a, A);
                pending = A.deliver();
                if (stage !== 'activation') await a.io.run(`${A.id}:activation`);
                if (stage === 'navigation') await a.io.run(`${A.id}:LOGIN`);
            }
        }
        A.cancel();
        a.setSuap('synthetic-B');
        const B = a.begin({site: 'https://presential.synthetic.invalid', course: 'synthetic-B-course'});
        await complete(a, B);
        const effectsAtB = a.effects.length;
        if (stage === 'fetch') await a.io.run(`${A.id}:fetch`);
        if (stage === 'db') {
            await a.io.run(`${A.id}:secure`);
            await a.io.run(`${A.id}:db`);
        }
        if (stage === 'secure') await a.io.run(`${A.id}:secure`);
        if (stage === 'commit') await a.io.run(`${A.id}:commit-apply`);
        if (['activation', 'LOGIN', 'navigation'].includes(stage)) await a.io.run(`${A.id}:${stage}`);
        assert.equal(await pending, false);
        assert.equal(a.active, B.id);
        assert.equal(a.visible(), B.id);
        assert.equal(a.effects.length, effectsAtB);
        assert.equal(a.candidates.get(B.id).course, 'synthetic-B-course');
        const navigation = a.effects.find(e => e.id === B.id && e.kind === 'navigation');
        assert.equal(navigation.site, 'https://presential.synthetic.invalid');
        assert.equal(navigation.course, 'synthetic-B-course');
        assert.equal(a.secure.get(B.id).token, `synthetic-token-${B.id}`);
        a.collect(A.id);
        assert(a.secure.has(B.id));
    });
}

test('contract: same-account logout/reentry uses epoch, not username alone', async () => {
    const a = world(), old = a.begin();
    const pending = accept(a, old);
    await a.io.run(`${old.id}:fetch`);
    await a.io.wait(`${old.id}:secure`);
    a.setSuap(null);
    assert.throws(() => a.begin(), /SUAP/);
    a.setSuap('synthetic-A');
    const fresh = a.begin();
    assert.notEqual(old.record.epoch, fresh.record.epoch);
    await complete(a, fresh);
    await a.io.run(`${old.id}:secure`);
    await a.io.run(`${old.id}:db`);
    assert.equal(await pending, false);
    assert.equal(a.active, fresh.id);
    assert.equal(a.secure.get(fresh.id).token, `synthetic-token-${fresh.id}`);
});

test('contract: duplicate callback, confirmation and delivery join single work', async () => {
    const a = world(), A = a.begin();
    const payload = payloadFor(a, A), info = infoFor(A);
    const pending = A.accept(payload, info);
    assert.strictEqual(A.accept(payload, info), pending);
    await a.io.run(`${A.id}:fetch`);
    await a.io.run(`${A.id}:db`);
    await a.io.run(`${A.id}:secure`);
    await pending;
    const publication = A.commit();
    assert.strictEqual(A.commit(), publication);
    await a.io.run(`${A.id}:commit-apply`);
    await a.io.run(`${A.id}:commit-ack`);
    await publication;
    await deliver(a, A);
    assert.equal(await A.deliver(), true);
    assert.equal(a.effects.length, 3);
    assert.equal(a.journal.filter(e => e.to === 'confirmed').length, 1);
});

for (const store of ['db', 'secure']) {
    test(`contract: ${store} failure leaves no published partial session`, async () => {
        const a = world(), A = a.begin();
        assert.equal(await prepare(a, A, {[`${store}Failure`]: 'synthetic write failure'}), false);
        assert.equal(A.state, 'rejected');
        noEffects(a);
        const restored = AtomicAuthority.fromCheckpoint(a.checkpoint(), {owner: a.owner, epoch: a.epoch});
        noEffects(restored);
        assert.equal(a.collect(A.id), true);
        assert.equal(a.candidates.size + a.secure.size, 0);
    });
}

test('contract: cleanup before an uncancellable late write retains tombstone and never deletes B', async () => {
    const a = world(), A = a.begin();
    const pending = accept(a, A);
    await a.io.run(`${A.id}:fetch`);
    await a.io.run(`${A.id}:db`);
    A.cancel();
    a.collect(A.id);
    const B = a.begin();
    await complete(a, B);
    await a.io.run(`${A.id}:secure`);
    assert.equal(await pending, false);
    assert(a.secure.has(A.id), 'late physical orphan is explicitly modeled');
    assert.equal(a.visible(), B.id);
    assert.equal(a.collect(A.id), true);
    assert(!a.secure.has(A.id));
    assert(a.secure.has(B.id));
    assert.equal(a.collect(B.id), false);
    assert.equal(a.records.get(A.id).state, 'cancelled');
});

for (const point of ['db-only', 'secure-only', 'prepared', 'commit-queued', 'confirmed', 'activated', 'LOGIN', 'navigation']) {
    test(`contract: serialized recovery after interruption at ${point}`, async () => {
        const a = world(), A = a.begin();
        let pending;
        if (['db-only', 'secure-only'].includes(point)) {
            pending = accept(a, A);
            await a.io.run(`${A.id}:fetch`);
            await a.io.run(`${A.id}:${point === 'db-only' ? 'db' : 'secure'}`);
        } else {
            await prepare(a, A);
            if (point !== 'prepared') {
                pending = A.commit();
                if (point !== 'commit-queued') await a.io.run(`${A.id}:commit-apply`);
                if (!['commit-queued', 'confirmed'].includes(point)) {
                    await a.io.run(`${A.id}:commit-ack`);
                    await pending;
                    pending = A.deliver();
                    await a.io.run(`${A.id}:activation`);
                    if (point !== 'activated') await a.io.run(`${A.id}:LOGIN`);
                    if (point === 'navigation') { await a.io.run(`${A.id}:navigation`); await pending; }
                }
            }
        }
        const restored = AtomicAuthority.fromCheckpoint(a.checkpoint(), {owner: a.owner, epoch: a.epoch});
        const confirmed = !['db-only', 'secure-only', 'prepared', 'commit-queued'].includes(point);
        assert.equal(restored.active, confirmed ? A.id : null);
        assert.equal(restored.visible(), confirmed ? A.id : null);
        assert.deepEqual(restored.effects, [], 'no LOGIN / navigation replay on restart');
        assert.equal(restored.records.get(A.id).state, confirmed ? 'confirmed' : 'cancelled');
        // Drain physical operations in the interrupted runtime too; they must not affect the recovered model.
        a.recover();
        if (['db-only', 'secure-only'].includes(point)) {
            await a.io.run(`${A.id}:${point === 'db-only' ? 'secure' : 'db'}`);
            assert.equal(await pending, false);
        }
        if (point === 'confirmed') { await a.io.run(`${A.id}:commit-ack`); assert.equal(await pending, false); }
        if (point === 'commit-queued') { await a.io.run(`${A.id}:commit-apply`); assert.equal(await pending, false); }
        if (point === 'activated') { await a.io.run(`${A.id}:LOGIN`); assert.equal(await pending, false); }
        if (point === 'LOGIN') { await a.io.run(`${A.id}:navigation`); assert.equal(await pending, false); }
        assert.equal(restored.visible(), confirmed ? A.id : null);
    });
}

test('contract: commit failure before durable apply is rejected', async () => {
    const a = world(), A = a.begin();
    await prepare(a, A);
    assert.equal(await commit(a, A, {applyFailure: 'synthetic transaction failure'}), false);
    assert.equal(A.state, 'rejected');
    noEffects(a);
});

test('contract: lost ACK does not roll back durable confirmation; recovery finds it', async () => {
    const a = world(), A = a.begin();
    await prepare(a, A);
    assert.equal(await commit(a, A, {ackFailure: 'synthetic lost acknowledgement'}), false);
    assert.equal(A.state, 'confirmed');
    assert.equal(a.active, null);
    const restored = AtomicAuthority.fromCheckpoint(a.checkpoint(), {owner: a.owner, epoch: a.epoch});
    assert.equal(restored.active, A.id);
    assert.deepEqual(restored.effects, []);
});

test('contract: recovery fails closed for a missing secure record or a different trusted SUAP epoch', async () => {
    const a = world(), A = a.begin();
    await complete(a, A);
    const image = a.checkpoint();
    for (const identity of [{owner: 'synthetic-B', epoch: a.epoch + 1},
        {owner: 'synthetic-A', epoch: a.epoch + 1}, {owner: null, epoch: a.epoch + 1}]) {
        noEffects(AtomicAuthority.fromCheckpoint(image, identity));
    }
    a.secure.delete(A.id);
    noEffects(AtomicAuthority.fromCheckpoint(a.checkpoint(), {owner: a.owner, epoch: a.epoch}));
});

test('contract: pending newer attempt does not destroy an already confirmed same-owner session', async () => {
    const a = world(), A = a.begin();
    await complete(a, A);
    const B = a.begin();
    assert.equal(a.visible(), A.id);
    const restored = AtomicAuthority.fromCheckpoint(a.checkpoint(), {owner: a.owner, epoch: a.epoch});
    assert.equal(restored.active, A.id);
    assert.equal(restored.records.get(B.id).state, 'cancelled');
    assert.deepEqual(restored.effects, []);
});

test('contract: official passport validation rejects invalid signature and does not consume B launch', async () => {
    const a = world(), A = a.begin();
    const pending = A.accept('synthetic-invalid-signature:::synthetic-token', infoFor(A));
    const B = a.begin();
    assert.equal(await pending, false);
    assert(a.launches.has(B.id));
    assert.equal(a.io.pending.size, 0);
    await complete(a, B);
    assert(a.effects.every(e => e.id === B.id));
});

test('contract: valid passport alone cannot override SUAP owner or exact environment or enrolment', async () => {
    for (const mismatch of [{username: 'synthetic-other'}, {siteUrl: 'https://other.synthetic.invalid'}, {enrolled: false}]) {
        const a = world(), A = a.begin();
        const pending = accept(a, A, mismatch);
        await a.io.run(`${A.id}:fetch`);
        assert.equal(await pending, false);
        assert.equal(A.state, 'rejected');
        assert.equal(a.candidates.size + a.secure.size, 0);
        noEffects(a);
    }
});

test('contract: official HTTP signature fallback is not accepted as the expected HTTPS environment', async () => {
    const crypto = require('node:crypto');
    const a = world(), A = a.begin();
    const launch = a.launches.get(A.id);
    const signature = crypto.createHash('md5').update(SITE.replace('https:', 'http:') + launch.passport).digest('hex');
    assert.equal(await A.accept(`${signature}:::synthetic-token`, infoFor(A)), false);
    assert.equal(A.state, 'rejected');
    noEffects(a);
});

test('contract: only confirmed attempts may deliver; navigation cannot precede LOGIN', async () => {
    const a = world(), A = a.begin();
    assert.equal(a.effect(A, 'activation'), false);
    await prepare(a, A);
    assert.equal(a.effect(A, 'LOGIN'), false);
    await commit(a, A);
    assert.equal(a.effect(A, 'navigation'), false);
    assert.deepEqual(a.effects, []);
});

function permutations(items) {
    if (!items.length) return [[]];
    return items.flatMap((item, i) => permutations(items.filter((_, j) => j !== i)).map(tail => [item, ...tail]));
}

test('contract: all 80 write/publication interleavings preserve B, for same and different accounts', async () => {
    const schedules = permutations(['A-db', 'A-secure', 'B-db', 'B-secure', 'publish-B'])
        .filter(order => order.indexOf('publish-B') > Math.max(order.indexOf('B-db'), order.indexOf('B-secure')));
    assert.equal(schedules.length, 40);
    let explored = 0;
    for (const differentAccount of [false, true]) {
        for (const order of schedules) {
            const a = world(), A = a.begin();
            const old = accept(a, A);
            await a.io.run(`${A.id}:fetch`);
            await a.io.wait(`${A.id}:db`);
            A.cancel();
            if (differentAccount) a.setSuap('synthetic-B');
            const B = a.begin();
            const fresh = accept(a, B);
            await a.io.run(`${B.id}:fetch`);
            for (const operation of order) {
                if (operation === 'publish-B') {
                    assert.equal(await fresh, true);
                    await commit(a, B);
                    await deliver(a, B);
                } else {
                    const [owner, store] = operation.split('-');
                    await a.io.run(`${owner === 'A' ? A.id : B.id}:${store}`);
                }
                if (a.visible()) assert.equal(a.visible(), B.id, order.join(','));
                assert(a.effects.every(effect => effect.id === B.id));
            }
            assert.equal(await old, false);
            assert.equal(a.visible(), B.id);
            assert.equal(a.active, B.id);
            assert.equal(a.effects.length, 3);
            assert.equal(a.secure.get(B.id).token, `synthetic-token-${B.id}`);
            assert.equal(a.io.pending.size, 0);
            explored++;
        }
    }
    assert.equal(explored, 80);
});

test('contract: all 12 cancel / A commit / B begin / B commit serializations honor the linearization point', async () => {
    const schedules = permutations(['cancel-A', 'commit-A', 'begin-B', 'commit-B'])
        .filter(order => order.indexOf('begin-B') < order.indexOf('commit-B'));
    assert.equal(schedules.length, 12);
    for (const order of schedules) {
        const a = world(), A = a.begin();
        await prepare(a, A);
        let B;
        for (const operation of order) {
            if (operation === 'cancel-A') {
                const result = A.cancel();
                assert.equal(result, A.state);
            } else if (operation === 'begin-B') {
                B = a.begin();
                await prepare(a, B);
            } else if (operation === 'commit-B') {
                assert.equal(await commit(a, B), true);
            } else {
                const canCommit = A.state === 'prepared' && a.latest === A.id;
                if (canCommit) assert.equal(await commit(a, A), true);
                else assert.equal(await A.commit(), false);
            }
        }
        assert.equal(a.visible(), B.id, order.join(','));
        const staleEffects = A.deliver();
        await a.io.run(`${A.id}:activation`);
        assert.equal(await staleEffects, false);
        await deliver(a, B);
        assert(a.effects.every(effect => effect.id === B.id));
    }
});

test('contract: official validator requires launch data; unsafe environment / early expiry are rejected', async () => {
    const a = world(), A = a.begin();
    a.launches.delete(A.id);
    assert.equal(await A.accept('synthetic-signature:::synthetic-token', infoFor(A)), false);
    assert.equal(A.state, 'rejected');
    noEffects(a);
    assert.throws(() => a.begin({site: 'http://academic.synthetic.invalid'}), /HTTPS/);
    assert.throws(() => a.begin({site: `${SITE}/unexpected/path`}), /HTTPS/);
    const B = a.begin();
    assert.throws(() => B.expire(), /deadline/);
    assert.throws(() => a.transition(B.record, 'confirmed'), /created -> confirmed/);
    assert.equal(B.cancel(), 'cancelled');
    assert.throws(() => a.transition(B.record, 'validating'), /cancelled -> validating/);
});

test('contract: unbound late A callback cannot consume or reject the current B launch', async () => {
    const a = world(), A = a.begin();
    const oldPayload = payloadFor(a, A);
    a.setSuap('synthetic-B');
    const B = a.begin();
    assert.equal(await a.routeCallback(oldPayload, infoFor(A)), false);
    assert.equal(B.state, 'created');
    assert(a.launches.has(B.id));
    const pending = a.routeCallback(payloadFor(a, B), infoFor(B));
    await a.io.run(`${B.id}:fetch`);
    await a.io.run(`${B.id}:db`);
    await a.io.run(`${B.id}:secure`);
    assert.equal(await pending, true);
    await commit(a, B);
    await deliver(a, B);
    assert(a.effects.every(e => e.id === B.id));
});

test('contract: nonce reuse is refused, including after recovery on the same account', async () => {
    const a = world(), A = a.begin({passport: 700});
    const oldPayload = payloadFor(a, A);
    A.cancel();
    assert.throws(() => a.begin({passport: 700}), /ambiguous/);
    const restored = AtomicAuthority.fromCheckpoint(a.checkpoint(), {owner: a.owner, epoch: a.epoch});
    assert.throws(() => restored.begin({passport: 700}), /ambiguous/);
    const B = restored.begin();
    assert.equal(await restored.routeCallback(oldPayload, infoFor(A)), false);
    assert(restored.launches.has(B.id));
});

test('contract: invalid signature rejects a bound attempt, with no persistence or activation', async () => {
    const a = world(), A = a.begin();
    assert.equal(await A.accept('synthetic-wrong-signature:::synthetic-token', infoFor(A)), false);
    assert.equal(A.state, 'rejected');
    assert.equal(a.io.pending.size, 0);
    noEffects(a);
});

test('contract: cancellation while official validation awaits cannot reach fetch or consume a newer launch', async () => {
    const a = world(), A = a.begin();
    const pending = accept(a, A);
    A.cancel();
    const B = a.begin();
    assert.equal(await pending, false);
    assert(a.launches.has(B.id));
    assert.equal(a.io.pending.size, 0);
    noEffects(a);
});

test('contract: asynchronous LOGIN observer checks the lease at its later shared mutation', async () => {
    const a = world(), A = a.begin();
    await complete(a, A);
    const observer = A.runLoginObserver();
    const B = a.begin();
    await complete(a, B);
    const before = a.effects.length;
    await a.io.run(`${A.id}:LOGIN-observer`);
    assert.equal(await observer, false);
    assert.equal(a.effects.length, before);
    assert.equal(a.observerState, null);
    const validObserver = B.runLoginObserver();
    await a.io.run(`${B.id}:LOGIN-observer`);
    assert.equal(await validObserver, true);
    assert.equal(a.observerState, B.id);
});

test('contract: recovery with a surviving physical secure write cannot corrupt a new session', async () => {
    const a = world(), A = a.begin();
    const pending = accept(a, A);
    await a.io.run(`${A.id}:fetch`);
    await a.io.run(`${A.id}:db`);
    await a.io.wait(`${A.id}:secure`);
    a.recover();
    const B = a.begin();
    await complete(a, B);
    await a.io.run(`${A.id}:secure`);
    assert.equal(await pending, false);
    assert.equal(a.visible(), B.id);
    assert.equal(a.active, B.id);
    assert(a.effects.every(effect => effect.id === B.id));
    assert.equal(a.collect(A.id), true);
    assert(a.secure.has(B.id));
});
