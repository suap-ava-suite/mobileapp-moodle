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

type CourseOpeningTerminalState = 'cancelled' | 'timed-out';
type CourseOpeningLogOutcome = 'start' | 'ok' | 'error' | 'cancelled' | 'timeout';

let attemptSequence = 0;

/**
 * Identifies one IFRN course-open operation and keeps user cancellation distinct from failure/timeout.
 * This is a cooperative UI/navigation guard; it does not claim to cancel native or Moodle work already sent.
 */
export class CourseOpeningAttempt {

    readonly id = `course-open-${Date.now().toString(36)}-${(++attemptSequence).toString(36)}`;

    private readonly controller = new AbortController();
    private terminalState?: CourseOpeningTerminalState;
    private terminalError?: Error;

    get signal(): AbortSignal {
        return this.controller.signal;
    }

    get cancelled(): boolean {
        return this.terminalState === 'cancelled';
    }

    get active(): boolean {
        return !this.terminalState;
    }

    /** A user/back action is the only source of the cancelled state. */
    cancel(): void {
        this.stop('cancelled', new Error('A abertura foi cancelada. Você pode tentar novamente pelo Painel.'));
    }

    assertActive(): void {
        if (this.terminalError) {
            throw this.terminalError;
        }
    }

    /**
     * Emits only a safe operation id, a static stage name and a finite duration.
     *
     * @param stage Static, non-sensitive stage name.
     * @param outcome Result category.
     * @param ms Optional elapsed duration.
     */
    record(stage: string, outcome: CourseOpeningLogOutcome, ms?: number): void {
        if (!/^[a-z0-9-]{1,48}$/.test(stage)) {
            return;
        }

        const entry: { operationId: string; stage: string; outcome: CourseOpeningLogOutcome; ms?: number } = {
            operationId: this.id,
            stage,
            outcome,
        };
        if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0) {
            entry.ms = Math.round(ms);
        }

        // eslint-disable-next-line no-console
        console.info('[IFRN-COURSE-OPEN]', JSON.stringify(entry));
    }

    /**
     * Runs a stage with a bounded wait. Timeout stops later stages, but is reported as a timeout,
     * never as a user cancellation. A raced action may still finish; callers must guard its effects.
     *
     * @param stage Static, non-sensitive stage name.
     * @param action Asynchronous operation to run.
     * @param timeoutMs Maximum wait before reporting a timeout.
     * @param stopAttemptOnTimeout Whether a timeout prevents later stages.
     * @param timeoutMessage Safe user-facing timeout message.
     * @returns The operation result if it completes while the attempt is active.
     */
    async stage<T>(
        stage: string,
        action: () => Promise<T>,
        timeoutMs = 45000,
        stopAttemptOnTimeout = true,
        timeoutMessage = 'O ambiente Moodle demorou para responder. Verifique sua conexão e tente novamente.',
    ): Promise<T> {
        this.assertActive();
        const start = performance.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let onAbort = (): void => { /* registered before the action */ };
        let outcome: CourseOpeningLogOutcome = 'error';
        this.record(stage, 'start');

        const interrupted = new Promise<never>((_resolve, reject) => {
            onAbort = () => reject(this.terminalError || new Error('A abertura foi cancelada. Tente novamente pelo Painel.'));
            this.signal.addEventListener('abort', onAbort, { once: true });
            timer = setTimeout(() => {
                const error = new Error(timeoutMessage);
                if (stopAttemptOnTimeout) {
                    this.stop('timed-out', error);
                }
                reject(error);
            }, timeoutMs);
        });

        try {
            const value = await Promise.race([interrupted, Promise.resolve().then(() => {
                this.assertActive();

                return action();
            })]);
            this.assertActive();
            outcome = 'ok';

            return value;
        } catch (error) {
            outcome = this.terminalState === 'cancelled' ? 'cancelled'
                : this.terminalState === 'timed-out' ? 'timeout' : 'error';
            throw error;
        } finally {
            clearTimeout(timer);
            this.signal.removeEventListener('abort', onAbort);
            this.record(stage, outcome, performance.now() - start);
        }
    }

    /**
     * Awaits an operation that cannot be physically cancelled and may mutate native/router state.
     * The caller keeps its single-flight lock until this operation settles, then the active check
     * prevents any subsequent stage from publishing or navigating with a stale attempt.
     *
     * @param stage Static, non-sensitive stage name.
     * @param action Asynchronous operation that must settle before releasing the attempt lock.
     * @returns The operation result if the attempt remains active.
     */
    async stageUntilSettled<T>(stage: string, action: () => Promise<T>): Promise<T> {
        this.assertActive();
        const start = performance.now();
        let outcome: CourseOpeningLogOutcome = 'error';
        this.record(stage, 'start');

        try {
            const value = await action();
            this.assertActive();
            outcome = 'ok';

            return value;
        } catch (error) {
            outcome = this.terminalState === 'cancelled' ? 'cancelled'
                : this.terminalState === 'timed-out' ? 'timeout' : 'error';
            throw error;
        } finally {
            this.record(stage, outcome, performance.now() - start);
        }
    }

    private stop(state: CourseOpeningTerminalState, error: Error): void {
        if (this.terminalState) {
            return;
        }

        this.terminalState = state;
        this.terminalError = error;
        this.controller.abort();

    }

}
