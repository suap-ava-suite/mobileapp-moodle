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

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { createCourseFavourites } from '../mobilemoodle/core_mobile/course-favourites';
import { loadVlibrasWidget } from '../mobilemoodle/core_mobile/vlibras-widget';
import { PAINEL_HELP_LINKS, type PainelHelpLinkId } from '../services_mobile/painel-help-links';
import { type NativePainelCourse, type NativePainelGroup, type NativePainelModel } from './painel-native-model';

@Component({
    selector: 'ifrn-painel-native',
    templateUrl: './painel-native.html',
    styleUrls: ['./painel-native.scss'],
    imports: [CoreSharedModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelNativeComponent {

    readonly data = input<NativePainelModel | null>(null);
    readonly busy = input(false);
    readonly openCourse = output<NativePainelCourse>();
    readonly openHelp = output<PainelHelpLinkId>();
    readonly openProfile = output<void>();
    readonly marketplace = output<void>();
    readonly logout = output<void>();
    readonly refresh = output<void>();
    readonly section = signal<'courses' | 'profile' | 'help' | 'accessibility'>('courses');
    readonly group = signal<NativePainelGroup>('diarios');
    readonly search = signal('');
    readonly onlyFavourites = signal(false);
    readonly favouriteRevision = signal(0);
    readonly preferenceError = signal('');
    readonly highContrast = signal(false);
    readonly fontScale = signal(100);
    readonly photoFailed = signal(false);
    readonly helpLinks = Object.entries(PAINEL_HELP_LINKS).map(([id, page]) => ({ id: id as PainelHelpLinkId, title: page.title }));
    readonly tabs = [
        { id: 'diarios' as const, label: 'Diários' },
        { id: 'coordenacoes' as const, label: 'Coordenação' },
        { id: 'autoinscricoes' as const, label: 'Autoinscrição' },
    ];

    private readonly favourites = computed(() => {
        this.data();

        return createCourseFavourites();
    });

    readonly courses = computed(() => {
        this.favouriteRevision();
        const query = this.search().trim().toLocaleLowerCase('pt-BR');

        return (this.data()?.groups[this.group()] || []).filter(course =>
            (!this.onlyFavourites() || this.favourites().isFavourite(course)) &&
            (!query || `${course.name} ${course.shortname} ${course.environment}`.toLocaleLowerCase('pt-BR').includes(query)));
    });

    setGroup(value: unknown): void {
        if (this.tabs.some(tab => tab.id === value)) {
            this.group.set(value as NativePainelGroup);
        }
    }

    canOpen(course: NativePainelCourse): boolean {
        return !this.busy() && !!course.moodle_course_id && !!course.moodle_site_url;
    }

    selectCourse(course: NativePainelCourse): void {
        if (this.canOpen(course)) {
            this.openCourse.emit(course);
        }
    }

    isFavourite(course: NativePainelCourse): boolean {
        this.favouriteRevision();

        return this.favourites().isFavourite(course);
    }

    toggleFavourite(course: NativePainelCourse): void {
        try {
            this.favourites().toggle(course);
            this.preferenceError.set('');
            this.favouriteRevision.update(value => value + 1);
        } catch {
            this.preferenceError.set('Não foi possível salvar o favorito. Tente novamente.');
        }
    }

    async enableLibras(): Promise<void> {
        try {
            await loadVlibrasWidget();
            this.preferenceError.set('');
        } catch {
            this.preferenceError.set('Não foi possível carregar o VLibras. Verifique sua conexão e tente novamente.');
        }
    }

}
