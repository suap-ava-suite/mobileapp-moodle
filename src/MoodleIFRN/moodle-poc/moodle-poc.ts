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

import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CoreSharedModule } from '@/core/shared.module';
import { PAINEL_AVA_CONFIG } from '@/MoodleIFRN/services_mobile/painel-ava.config';
import {
    PainelAvaService,
    PainelAvaV1PocResult,
} from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreLoadings } from '@services/overlays/loadings';
import { CorePlatform } from '@services/platform';
import { firstValueFrom } from 'rxjs';

/**
 * PoC temporário: Painel AVA API v1 (produção)
 *   POST /api/v1/authenticate/
 *   GET  /api/v1/diarios/?situacao=inprogress
 *
 * Só inspeciona a resposta real. Não abre curso, não usa OAuth Moodle,
 * não chama CoreSites / CoreCourseHelper.
 *
 * Rota: /login/moodle-poc
 */
@Component({
    selector: 'page-moodle-poc',
    templateUrl: './moodle-poc.html',
    styleUrls: ['./moodle-poc.scss'],
    imports: [
        CoreSharedModule,
    ],
})
export class MoodlePocPage implements OnInit {

    private readonly painelAva = inject(PainelAvaService);
    private readonly router = inject(Router);

    readonly baseUrl = PAINEL_AVA_CONFIG.baseUrl;
    readonly authenticatePath = PAINEL_AVA_CONFIG.authenticatePath;
    readonly diariosPath = PAINEL_AVA_CONFIG.diariosPath;
    readonly diariosQuery = PAINEL_AVA_CONFIG.diariosQuery;

    username = '';
    password = '';
    showPassword = false;

    loading = false;
    statusMessage = '';
    formError = '';
    result: PainelAvaV1PocResult | null = null;

    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();

        if (this.painelAva.hasValidToken()) {
            this.statusMessage =
                'JWT do Painel (v1) já está no sessionStorage. '
                + 'Rode o PoC de novo ou limpe a sessão.';
        }
    }

    goBack(): void {
        if (this.loading) {
            return;
        }

        void this.router.navigate(['/login/marketplace-ifrn']);
    }

    togglePassword(): void {
        this.showPassword = !this.showPassword;
    }

    /**
     * Executa authenticate + GET diarios e loga a estrutura real no console.
     */
    async runPoc(): Promise<void> {
        if (this.loading) {
            return;
        }

        const username = this.username.trim();
        const password = this.password;

        if (!username || !password) {
            this.formError = 'Informe IFRN-id e senha SUAP.';

            return;
        }

        this.formError = '';
        this.result = null;
        this.loading = true;
        this.statusMessage = 'POST /api/v1/authenticate/ …';

        const modal = await CoreLoadings.show('Testando API v1…');

        try {
            this.result = await firstValueFrom(
                this.painelAva.runApiV1Poc({ username, password }),
            );

            this.password = '';
            this.statusMessage =
                `OK — ${this.result.diariosCount} diário(s). `
                + 'Veja o console: chaves reais + id/courseid/fullname/viewurl/…';
        } catch (error) {
            this.statusMessage = '';
            this.formError = error instanceof Error
                ? error.message
                : 'Falha no PoC da API v1.';
            void CoreAlerts.showError(error, {
                default: 'Falha no PoC da API v1 do Painel AVA.',
            });
        } finally {
            modal.dismiss();
            this.loading = false;
        }
    }

    clearSession(): void {
        this.painelAva.clearSession();
        this.result = null;
        this.statusMessage = 'Sessão Painel AVA (token/perfil) limpa.';
        this.formError = '';
    }

    displayValue(value: unknown): string {
        if (value === undefined) {
            return '(ausente)';
        }

        if (value === null) {
            return 'null';
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

}
