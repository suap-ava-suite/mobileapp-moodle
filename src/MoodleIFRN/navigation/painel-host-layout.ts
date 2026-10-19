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

export interface PainelHostLayout {
    insets: { top: number; right: number; bottom: number; left: number };
    keyboardHeight: number;
}

/**
 * Resolve env()/calc() no documento que possui os insets, antes de atravessar o iframe.
 *
 * @param host Janela que contém o ion-app responsável pelo layout nativo.
 * @returns Medidas em pixels, ou null se a janela não puder ser acessada.
 */
export function readPainelHostLayout(host: Window): PainelHostLayout | null {
    let probe: HTMLElement | undefined;

    try {
        probe = host.document.createElement('div');
        probe.style.cssText = [
            'position:fixed',
            'visibility:hidden',
            'pointer-events:none',
            'height:var(--keyboard-height, 0px)',
            'padding-top:var(--ion-safe-area-top, env(safe-area-inset-top, 0px))',
            'padding-right:var(--ion-safe-area-right, env(safe-area-inset-right, 0px))',
            'padding-bottom:var(--ion-safe-area-bottom, env(safe-area-inset-bottom, 0px))',
            'padding-left:var(--ion-safe-area-left, env(safe-area-inset-left, 0px))',
        ].join(';');
        host.document.documentElement.appendChild(probe);

        const style = host.getComputedStyle(probe);
        const pixels = (value: string): number => Math.max(0, Number.parseFloat(value) || 0);

        return {
            insets: {
                top: pixels(style.paddingTop), right: pixels(style.paddingRight),
                bottom: pixels(style.paddingBottom), left: pixels(style.paddingLeft),
            },
            keyboardHeight: pixels(style.height),
        };
    } catch {
        // Um iframe de outra origem não pode ler a janela que o contém.
        return null;
    } finally {
        probe?.remove();
    }
}
