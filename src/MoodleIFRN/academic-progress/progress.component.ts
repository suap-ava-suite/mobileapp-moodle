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

import {
    ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, SimpleChanges, inject, signal,
} from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import type { CoreCourseSection } from '@features/course/services/course-helper';
import { IfrnAcademicProgressService } from './progress.service';
import { panelProgress, unavailableProgress, type ProgressSnapshot } from './progress-model';

@Component({
    selector: 'ifrn-academic-progress',
    standalone: true,
    imports: [CoreSharedModule],
    templateUrl: './progress.component.html',
    styleUrls: ['./progress.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[attr.data-progress-context]': 'compact ? "panel" : "course"' },
})
export class IfrnAcademicProgressComponent implements OnChanges, OnDestroy {

    @Input() courseId = 0;
    @Input() siteUrl = '';
    @Input() compact = false;
    @Input() serverProgress: number | null = null;
    @Input() hasServerProgress = false;
    @Input() sections: CoreCourseSection[] = [];
    @Input() accountScope?: object | null;

    readonly snapshot = signal<ProgressSnapshot | null>(null);
    private release?: () => void;
    private readonly progress = inject(IfrnAcademicProgressService);

    get view(): ProgressSnapshot {
        return this.snapshot()
            ?? (this.compact ? panelProgress(this.serverProgress, this.hasServerProgress) : unavailableProgress());
    }

    get percentage(): number | null {
        return this.view.percent === null ? null : Math.round(this.view.percent);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (!changes['courseId'] && !changes['siteUrl'] && !changes['compact'] && !changes['accountScope']) { return; }
        this.release?.();
        this.snapshot.set(unavailableProgress());
        this.release = this.progress.watch(this.courseId, this.siteUrl, !this.compact, value => this.snapshot.set(value));
    }

    ngOnDestroy(): void { this.release?.(); this.release = undefined; }

}
