import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { CoreAlerts } from '@services/overlays/alerts';
import { CorePlatform } from '@services/platform';
import { CoreNavigator } from '@services/navigator';
import { firstValueFrom } from 'rxjs';

interface PendingEnrol {
    courseId: number;
    ambienteId: number;
}

@Component({
    selector: 'page-painel-enrol',
    templateUrl: './painel-enrol.html',
    styleUrls: ['./painel-enrol.scss'],
    imports: [CoreSharedModule],
})
export class PainelEnrolPage implements OnInit, OnDestroy {

    private readonly painel = inject(PainelAvaService);
    private enrolment?: ReturnType<PainelAvaService['prepareCourseEnrolment']>;
    private left = false;
    message = 'Realizando inscrição…';

    async ngOnInit(): Promise<void> {
        await this.startEnrolment();
    }

    ionViewWillEnter(): void {
        // Uma página cacheada só repete o fluxo se o Painel registrar novo pedido.
        if (this.left && sessionStorage.getItem('ifrn_painel_pending_enrol')) {
            this.left = false;
            void this.startEnrolment();
        }
    }

    private async startEnrolment(): Promise<void> {
        this.message = 'Realizando inscrição…';
        const pending = this.readPending();
        let attempt: typeof this.enrolment;

        try {
            // Consome o pedido aqui. Uma tela antiga não pode apagar o pedido da próxima.
            sessionStorage.removeItem('ifrn_painel_pending_enrol');
            if (!pending) {
                throw new Error('Curso de autoinscrição não informado.');
            }
            attempt = this.painel.prepareCourseEnrolment(pending.courseId, pending.ambienteId);
            this.enrolment = attempt;
            await CorePlatform.ready();
            if (this.left || !attempt.isCurrent()) {
                return;
            }
            const result = await firstValueFrom(attempt.result, { defaultValue: null });
            if (!result || this.left || !attempt.isCurrent()) {
                return;
            }
            const status = String(result['status'] || '');
            this.message = status === 'reactivated' ? 'Inscrição reativada.' : 'Inscrição realizada.';
            await CoreNavigator.navigate('/login/painel');
        } catch (error) {
            if (this.left || (attempt && !attempt.isCurrent())) {
                return;
            }
            const message = error instanceof Error ? error.message : 'Não foi possível realizar a inscrição.';
            await CoreAlerts.showError(message, { default: 'Não foi possível realizar a autoinscrição.' });
            if (!this.left && (!attempt || attempt.isCurrent())) {
                await CoreNavigator.navigate('/login/painel');
            }
        } finally {
            attempt?.cancel();
        }
    }

    ionViewWillLeave(): void {
        this.left = true;
        this.enrolment?.cancel();
    }

    ngOnDestroy(): void {
        this.ionViewWillLeave();
    }

    private readPending(): PendingEnrol | null {
        const routeCourseId = Number(CoreNavigator.getRouteNumberParam('courseId') || 0);
        const routeAmbienteId = Number(CoreNavigator.getRouteNumberParam('ambienteId') || 2);
        if (Number.isSafeInteger(routeCourseId) && routeCourseId > 0
            && Number.isSafeInteger(routeAmbienteId) && routeAmbienteId > 0) {
            return { courseId: routeCourseId, ambienteId: routeAmbienteId };
        }

        try {
            const raw = sessionStorage.getItem('ifrn_painel_pending_enrol');
            if (!raw) {
                return null;
            }
            const value = JSON.parse(raw) as Partial<PendingEnrol>;
            const courseId = Number(value.courseId);
            const ambienteId = Number(value.ambienteId || 2);

            return Number.isSafeInteger(courseId) && courseId > 0 && Number.isSafeInteger(ambienteId) && ambienteId > 0
                ? { courseId, ambienteId } : null;
        } catch {
            return null;
        }
    }

}
