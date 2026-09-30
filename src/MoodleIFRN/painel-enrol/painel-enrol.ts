import { Component, OnInit, inject } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { CoreAlerts } from '@services/overlays/alerts';
import { CorePlatform } from '@services/platform';
import { firstValueFrom } from 'rxjs';

interface PendingEnrol { courseId: number; ambienteId: number; }

@Component({
    selector: 'page-painel-enrol',
    templateUrl: './painel-enrol.html',
    styleUrls: ['./painel-enrol.scss'],
    imports: [CoreSharedModule],
})
export class PainelEnrolPage implements OnInit {
    private readonly painel = inject(PainelAvaService);
    message = 'Realizando inscrição…';

    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();
        const pending = this.readPending();
        if (!pending) {
            await this.finishWithError('Curso de autoinscrição não informado.');
            return;
        }

        try {
            const result = await firstValueFrom(this.painel.enrolCourse(pending.courseId, pending.ambienteId));
            const status = String(result['status'] || '');
            this.message = status === 'reactivated' ? 'Inscrição reativada.' : 'Inscrição realizada.';
            sessionStorage.removeItem('ifrn_painel_pending_enrol');
            this.backToPainel();
        } catch (error) {
            await this.finishWithError(error instanceof Error ? error.message : 'Não foi possível realizar a inscrição.');
        }
    }

    private readPending(): PendingEnrol | null {
        try {
            const raw = sessionStorage.getItem('ifrn_painel_pending_enrol');
            if (!raw) return null;
            const value = JSON.parse(raw) as Partial<PendingEnrol>;
            const courseId = Number(value.courseId);
            const ambienteId = Number(value.ambienteId || 2);
            return Number.isFinite(courseId) && courseId > 0 && Number.isFinite(ambienteId) && ambienteId > 0
                ? { courseId, ambienteId } : null;
        } catch {
            return null;
        }
    }

    private async finishWithError(message: string): Promise<void> {
        sessionStorage.removeItem('ifrn_painel_pending_enrol');
        await CoreAlerts.showError(message, { default: 'Não foi possível realizar a autoinscrição.' });
        this.backToPainel();
    }

    private backToPainel(): void {
        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;
        window.location.assign(`${root}mobilemoodle/index.html#/painel`);
    }
}
