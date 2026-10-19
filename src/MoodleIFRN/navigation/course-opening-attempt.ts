/** Tempos monotônicos por etapa, sem URL, identidade, courseId ou mensagens de erro. */
export class CourseOpeningAttempt {
    private readonly controller = new AbortController();

    cancel(): void {
        this.controller.abort();
    }

    get cancelled(): boolean {
        return this.controller.signal.aborted;
    }

    assertActive(): void {
        if (this.controller.signal.aborted) {
            throw new Error('A abertura foi cancelada. Você pode tentar novamente pelo Painel.');
        }
    }

    async stage<T>(stage: string, action: () => Promise<T>, timeoutMs = 45000, cancelOnTimeout = true): Promise<T> {
        this.assertActive();
        const start = performance.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let onAbort = (): void => { /* registrado antes da ação */ };
        let outcome = 'error';
        const interrupted = new Promise<never>((_resolve, reject) => {
            onAbort = () => reject(new Error('A abertura foi cancelada. Tente novamente pelo Painel.'));
            this.controller.signal.addEventListener('abort', onAbort, { once: true });
            timer = setTimeout(() => {
                reject(new Error('O ambiente Moodle demorou para responder. Verifique sua conexão e tente novamente.'));
                if (cancelOnTimeout) {
                    this.cancel();
                }
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
        } finally {
            clearTimeout(timer);
            this.controller.signal.removeEventListener('abort', onAbort);
            // eslint-disable-next-line no-console
            console.info('[IFRN-TIMING]', JSON.stringify({ stage, ms: Math.round(performance.now() - start), outcome }));
        }
    }
}
