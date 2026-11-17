/**
 * Cerca operações assíncronas do OAuth mobile por tentativa, nunca pela conta.
 * Uma nova tentativa da mesma identidade também invalida callbacks anteriores.
 */
export class MobileAuthAttemptCoordinator {

    private generation = 0;
    private activeState?: string;

    begin(): number {
        this.generation++;
        this.activeState = undefined;

        return this.generation;
    }

    bind(generation: number, state: string): boolean {
        if (!this.isCurrent(generation) || !state) {
            return false;
        }

        this.activeState = state;

        return true;
    }

    /** Adota apenas um callback pendente após recriação do serviço/app. */
    adopt(state: string): number | undefined {
        if (!state) {
            return undefined;
        }
        if (this.activeState === state) {
            return this.generation;
        }
        if (this.activeState !== undefined) {
            return undefined;
        }

        this.generation++;
        this.activeState = state;

        return this.generation;
    }

    isCurrent(generation: number, state?: string): boolean {
        return generation === this.generation
            && (state === undefined || state === this.activeState);
    }

    invalidate(generation?: number): boolean {
        if (generation !== undefined && generation !== this.generation) {
            return false;
        }

        this.generation++;
        this.activeState = undefined;

        return true;
    }
}
