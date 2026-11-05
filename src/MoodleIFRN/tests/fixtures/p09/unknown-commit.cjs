'use strict';

/**
 * Fail-closed guard for an unknown SQLite commit ACK. This is test-only and
 * intentionally cannot reconcile against the current Cordova plugin API.
 */
class RecoveryUnavailable extends Error {
    constructor() {
        super('A native committed-receipt barrier is required to reconcile this operation.');
        this.name = 'RecoveryUnavailable';
    }
}

class UnknownCommitGuard {
    constructor() {
        this.latest = null;
        this.pending = new Map();
        this.published = new Set();
        this.sequence = 0;
    }

    begin({id, owner, epoch, generation}) {
        if (this.pending.size) throw new Error('session ledger quarantined by an unknown commit');
        if (![id, owner].every(value => typeof value === 'string' && value.length > 0) ||
            !Number.isSafeInteger(epoch) || epoch < 1 || !Number.isSafeInteger(generation) || generation < 1) {
            throw new TypeError('invalid synthetic attempt fence');
        }
        const fence = Object.freeze({id, owner, epoch, generation});
        if (this.latest && (epoch < this.latest.epoch ||
            (epoch === this.latest.epoch && generation <= this.latest.generation))) {
            throw new Error('attempt fence is stale');
        }
        this.latest = fence;
        return fence;
    }

    commitSubmitted(fence) {
        this.assertCurrent(fence);
        this.pending.set(fence.id, {fence, state: 'commit-pending', sequence: ++this.sequence});
        return this.pending.get(fence.id);
    }

    ackUnknown(id) {
        const pending = this.pending.get(id);
        if (!pending || pending.state !== 'commit-pending') throw new Error('no pending commit ACK');
        pending.state = 'ack-unknown';
        return Object.freeze({state: pending.state, operationId: id, sequence: pending.sequence});
    }

    advanceIdentityFence({id, owner, epoch, generation}) {
        if (typeof id !== 'string' || typeof owner !== 'string' ||
            !Number.isSafeInteger(epoch) || !Number.isSafeInteger(generation) ||
            (this.latest && (epoch < this.latest.epoch || generation <= this.latest.generation))) {
            throw new Error('identity fence must advance monotonically');
        }
        this.latest = Object.freeze({id, owner, epoch, generation});
    }

    async reconcile(id, nativeApi) {
        const pending = this.pending.get(id);
        if (!pending || pending.state !== 'ack-unknown') throw new Error('operation is not awaiting reconciliation');
        if (nativeApi?.capability !== 'committed-receipt-barrier-v1' ||
            typeof nativeApi.reconcileAfterConnectionBarrier !== 'function') {
            throw new RecoveryUnavailable();
        }

        const receipt = await nativeApi.reconcileAfterConnectionBarrier({
            operationId: id,
            submittedSequence: pending.sequence,
            fence: pending.fence,
        });
        if (!receipt || receipt.operationId !== id || receipt.barrierSatisfied !== true ||
            receipt.sequence < pending.sequence || !['committed', 'aborted'].includes(receipt.outcome)) {
            throw new Error('native reconciliation result is not authoritative');
        }

        pending.state = receipt.outcome === 'committed' ? 'reconciled-committed' : 'reconciled-aborted';
        this.pending.delete(id);
        const current = this.isCurrent(pending.fence);
        const canPublish = receipt.outcome === 'committed' && receipt.matchesDurablePointer === true && current;
        if (canPublish) this.published.add(id);
        return Object.freeze({state: pending.state, operationId: id, publish: canPublish});
    }

    canStartAnotherAttempt() {
        return this.pending.size === 0;
    }

    isPublished(id) {
        return this.published.has(id);
    }

    isCurrent(fence) {
        return this.latest?.owner === fence.owner && this.latest?.epoch === fence.epoch &&
            this.latest?.generation === fence.generation && this.latest?.id === fence.id;
    }

    assertCurrent(fence) {
        if (!this.isCurrent(fence)) throw new Error('attempt fence is stale');
    }
}

module.exports = {UnknownCommitGuard, RecoveryUnavailable};
