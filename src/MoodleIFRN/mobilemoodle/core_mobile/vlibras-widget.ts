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

const SCRIPT_ID = 'vlibras-script';
const SCRIPT_URL = 'https://vlibras.gov.br/app/vlibras-plugin.js';

interface SharedVlibrasLoader {
    status: 'idle' | 'loading' | 'loaded' | 'error';
    promise?: Promise<void>;
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        VLibras?: { Widget: new (url: string) => unknown };
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __ifrnVlibrasLoader?: SharedVlibrasLoader;
    }
}

/**
 * Loads the official widget once per WebView and allows a later retry after network failure.
 * The official script initializes itself when the documented root markup is present.
 *
 * @returns A promise fulfilled when the official script has loaded.
 */
export function loadVlibrasWidget(): Promise<void> {
    const root = getOrCreateRoot();
    root.classList.add('enabled', 'ifrn-vlibras-compact');
    root.querySelector<HTMLElement>('[vw-plugin-wrapper]')?.style.removeProperty('display');

    const shared = window.__ifrnVlibrasLoader ??= { status: 'idle' };
    if (shared.status === 'loaded') {
        return Promise.resolve();
    }

    if (shared.promise) {
        return shared.promise;
    }

    if (window.VLibras?.Widget) {
        shared.status = 'loaded';

        return Promise.resolve();
    }

    // A failed element from an older loader must not block another attempt.
    document.getElementById(SCRIPT_ID)?.remove();

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;

    const promise = new Promise<void>((resolve, reject) => {
        script.addEventListener('load', () => {
            if (!window.VLibras?.Widget) {
                shared.status = 'error';
                script.remove();
                root.classList.remove('enabled');
                reject(new Error('O script oficial do VLibras não disponibilizou o widget.'));

                return;
            }

            shared.status = 'loaded';
            resolve();
        }, { once: true });

        script.addEventListener('error', () => {
            shared.status = 'error';
            script.remove();
            root.classList.remove('enabled');
            reject(new Error('Não foi possível carregar o serviço oficial do VLibras.'));
        }, { once: true });
    });

    shared.status = 'loading';
    shared.promise = promise;
    document.body.appendChild(script);

    return promise.finally(() => {
        if (shared.promise === promise) {
            shared.promise = undefined;
        }
    });
}

/**
 * Finds or creates the documented VLibras widget mount point.
 *
 * @returns The root element used by the official widget.
 */
function getOrCreateRoot(): HTMLElement {
    let root = document.querySelector<HTMLElement>('div[vw]');
    if (!root) {
        root = document.createElement('div');
        root.setAttribute('vw', '');
        root.className = 'enabled ifrn-vlibras-compact';
        root.innerHTML = '<div vw-access-button class="active"></div>'
            + '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
        document.body.appendChild(root);
    }

    if (!root.querySelector('[vw-access-button]') || !root.querySelector('[vw-plugin-wrapper]')) {
        root.innerHTML = '<div vw-access-button class="active"></div>'
            + '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
    }

    return root;
}
