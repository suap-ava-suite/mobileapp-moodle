// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { contextKey, summarizeProgress, unavailableProgress,
    type ProgressContext, type ProgressPayload, type ProgressSnapshot } from './progress-model';

interface PendingProgress {
    promise: Promise<ProgressSnapshot>;
    cancel: () => void;
}

/** Cache transitório: nenhuma gravação própria em storage e nenhuma operação acadêmica de escrita. */
export class AcademicProgressStore {

    private readonly snapshots = new Map<string, ProgressSnapshot>();
    private readonly pending = new Map<string, PendingProgress>();

    peek(context: ProgressContext): ProgressSnapshot | undefined {
        return this.snapshots.get(contextKey(context));
    }

    load(
        context: ProgressContext,
        read: () => Promise<ProgressPayload>,
        isCurrent: () => boolean,
        timeoutMs = 15000,
    ): Promise<ProgressSnapshot> {
        const key = contextKey(context);
        const running = this.pending.get(key);
        if (running) { return running.promise; }
        if (!isCurrent()) { return Promise.resolve(unavailableProgress()); }
        const pending = this.createPending(key, read, isCurrent, timeoutMs);
        this.pending.set(key, pending);

        return pending.promise;
    }

    clear(): void {
        this.snapshots.clear();
        for (const pending of this.pending.values()) { pending.cancel(); }
        this.pending.clear();
    }

    private createPending(
        key: string,
        read: () => Promise<ProgressPayload>,
        isCurrent: () => boolean,
        timeoutMs: number,
    ): PendingProgress {
        let finish: (value: ProgressSnapshot) => void;
        const promise = new Promise<ProgressSnapshot>(resolve => { finish = resolve; });
        let settled = false;
        const done = (value: ProgressSnapshot): void => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            this.pending.delete(key);
            finish(value);
        };
        const cancel = (): void => done(unavailableProgress());
        const timer = setTimeout(() => done(this.fallback(key, isCurrent)), timeoutMs);
        const run = async (): Promise<void> => {
            // A entrada pending precisa existir antes de ler um adaptador que falhe sincronamente.
            await Promise.resolve();
            try {
                const payload = await read();
                if (settled) { return; }
                if (!isCurrent()) {
                    cancel();

                    return;
                }
                const value = summarizeProgress(payload, Date.now());
                this.snapshots.set(key, value);
                done(value);
            } catch (error) {
                if (settled) { return; }
                const code = error && typeof error === 'object' && 'errorcode' in error ? error.errorcode : '';
                if (['invalidtoken', 'accessexception', 'requireloginerror', 'nopermissions'].includes(String(code))) {
                    this.snapshots.delete(key);
                    cancel();
                } else {
                    done(this.fallback(key, isCurrent));
                }
            }
        };
        void run();

        return { promise, cancel };
    }

    private fallback(key: string, isCurrent: () => boolean): ProgressSnapshot {
        const cached = isCurrent() ? this.snapshots.get(key) : undefined;

        return cached ? { ...cached, status: 'stale' } : unavailableProgress();
    }

}
