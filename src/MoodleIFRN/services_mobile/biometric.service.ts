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

import { FingerprintAIO } from '@awesome-cordova-plugins/fingerprint-aio/ngx';
import { inject, Injectable } from '@angular/core';

const BIOMETRIC_ENABLED_KEY = 'ifrn_biometric_login_enabled';

@Injectable({ providedIn: 'root' })
export class BiometricService {

    private readonly fingerprint = inject(FingerprintAIO);

    isEnabled(): boolean {
        return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
    }

    async isAvailable(): Promise<boolean> {
        try {
            await this.fingerprint.isAvailable({
                requireStrongBiometrics: true,
                allowBackup: false,
            });

            return true;
        } catch {
            return false;
        }
    }

    async enable(refreshToken: string): Promise<void> {
        await this.fingerprint.registerBiometricSecret({
            title: 'Ativar entrada biométrica',
            description: 'Confirme sua identidade para ativar a entrada biométrica.',
            cancelButtonTitle: 'Cancelar',
            disableBackup: true,
            invalidateOnEnrollment: true,
            secret: this.encodeSecret(refreshToken),
        });

        localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    }

    async authenticate(): Promise<string> {
        const encodedToken = await this.fingerprint.loadBiometricSecret({
            title: 'Entrar com biometria',
            description: 'Confirme sua identidade para entrar.',
            cancelButtonTitle: 'Cancelar',
            disableBackup: true,
        });

        return this.decodeSecret(encodedToken);
    }

    disable(): void {
        localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    }

    private encodeSecret(value: string): string {
        return Array.from(new TextEncoder().encode(value))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    private decodeSecret(value: string): string {
        if (!/^(?:[0-9a-f]{2})+$/i.test(value)) {
            throw new Error('Credencial biométrica inválida.');
        }

        const bytes = value.match(/.{2}/g)?.map(byte => Number.parseInt(byte, 16)) ?? [];

        return new TextDecoder().decode(new Uint8Array(bytes));
    }

}
