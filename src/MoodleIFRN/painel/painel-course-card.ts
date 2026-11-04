import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';

@Component({
    selector: 'ifrn-painel-course-card',
    standalone: true,
    imports: [CoreSharedModule],
    template: `
        <ion-card class="painel-card" [class.painel-card--autoinscricao]="tab === 'autoinscricoes'">
            <ion-card-content>
                <button type="button" class="painel-card-link" (click)="open.emit()">
                    <h2 class="painel-card-title">{{ title }}</h2>
                    <span class="painel-card-header-shortname">{{ course.shortname || title }}</span>
                </button>
                <div class="course-progress" *ngIf="progressValue !== null" role="group" [attr.aria-label]="progressValue + '% do curso concluído'">
                    <ion-progress-bar [value]="progressValue / 100" [attr.aria-label]="progressValue + '% concluído'"></ion-progress-bar>
                    <span>{{ progressValue }}% concluído</span>
                </div>
                <div class="painel-card-details">
                    <div class="painel-card-actions" *ngIf="tab === 'autoinscricoes'">
                        <ion-button class="btn-enroll" color="primary" size="small" *ngIf="!isEnrolled" (click)="$event.stopPropagation(); enrol.emit()">
                            <ion-icon slot="start" name="enter-outline"></ion-icon>Inscreva-se
                        </ion-button>
                        <ion-button class="btn-access" color="primary" size="small" *ngIf="isEnrolled" (click)="$event.stopPropagation(); open.emit()">Acessar curso</ion-button>
                        <ion-button class="btn-unenroll" fill="outline" color="medium" size="small" *ngIf="isEnrolled" (click)="$event.stopPropagation(); cancelEnrol.emit()">
                            <ion-icon slot="start" name="close-outline"></ion-icon>Cancelar inscrição
                        </ion-button>
                    </div>
                    <div class="painel-card-details-info">
                        <span class="painel-card-info-icon"><ion-icon name="school-outline" aria-hidden="true"></ion-icon>{{ environment }}</span>
                        <span class="painel-card-details-info-published" *ngIf="tab !== 'autoinscricoes'">
                            <ion-icon name="checkmark-circle-outline" aria-hidden="true"></ion-icon>Publicado
                        </span>
                        <span class="painel-card-info-enrolled" *ngIf="tab === 'autoinscricoes' && isEnrolled">
                            <ion-icon name="checkmark-circle-outline" aria-hidden="true"></ion-icon>Inscrito
                        </span>
                        <button type="button" class="painel-card-details-info-favourite" [class.painel-card-details-info-unfavourite]="favourite"
                            [disabled]="!favouriteEnabled" [attr.aria-pressed]="favourite"
                            [attr.aria-label]="favourite ? 'Remover dos favoritos: ' + title : 'Adicionar aos favoritos: ' + title"
                            (click)="$event.stopPropagation(); favouriteChange.emit()">
                            <ion-icon [name]="favourite ? 'star' : 'star-outline'" aria-hidden="true"></ion-icon>
                        </button>
                    </div>
                </div>
            </ion-card-content>
        </ion-card>`,
    styles: [`
        :host { display: block; }
        .painel-card { margin: 0; width: 100%; min-height: 100px; border: 1px solid var(--painel-border, #ccc); border-radius: 4px; background: var(--painel-surface, #fff); box-shadow: none; transition: box-shadow .2s ease, border-color .2s ease; }
        .painel-card:hover { border-color: #666; box-shadow: 0 2px 8px rgb(0 0 0 / 8%); }
        .painel-card ion-card-content { display: flex; flex-direction: column; gap: 16px; padding: 24px; }
        .painel-card-details { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
        .painel-card:not(.painel-card--autoinscricao) .painel-card-details { order: -1; }
        .painel-card-details-info { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; width: 100%; }
        .painel-card-info-icon, .painel-card-details-info-published, .painel-card-details-info-unpublished, .painel-card-info-enrolled { display: inline-flex; align-items: center; gap: 4px; min-height: 26px; padding: 4px 8px; border-radius: 4px; background: #eaeff8; color: #1351b4; font-size: calc(.75rem * var(--font-scale, 1)); font-weight: 600; }
        .painel-card-details-info-published, .painel-card-info-enrolled { background: #d4f0d8; color: #184f16; }
        .painel-card-info-icon ion-icon, .painel-card-details-info-published ion-icon, .painel-card-info-enrolled ion-icon { flex-shrink: 0; font-size: 14px; }
        .painel-card-details-info-favourite, .painel-card-details-info-unfavourite { display: grid; place-items: center; width: 44px; height: 44px; margin-left: auto; border: 0; border-radius: 50%; padding: 0; background: transparent; color: #1351b4; cursor: pointer; }
        .painel-card-details-info-favourite ion-icon, .painel-card-details-info-unfavourite ion-icon { font-size: 22px; }
        .painel-card-details-info-favourite:hover, .painel-card-details-info-unfavourite:hover { background: #eaeff8; }
        .painel-card-details-info-favourite[aria-pressed="true"], .painel-card-details-info-unfavourite[aria-pressed="true"] { color: #0c326f; background: #eaeff8; }
        .painel-card-details-info-favourite:disabled, .painel-card-details-info-unfavourite:disabled { opacity: .45; cursor: default; }
        .painel-card-link { display: block; padding: 0; border: 0; text-align: left; background: transparent; color: inherit; cursor: pointer; }
        .painel-card-title { margin: 0; color: #0c326f; font-size: calc(1.35rem * var(--font-scale, 1)); font-weight: 700; overflow-wrap: anywhere; }
        .painel-card-header-shortname { display: block; margin-top: 8px; color: #666; font-size: calc(.85rem * var(--font-scale, 1)); line-height: 1.5; overflow-wrap: anywhere; }
        .course-progress { display: flex; align-items: center; gap: 8px; margin: -8px 0 0; }
        .course-progress ion-progress-bar { flex: 1; max-width: 187px; height: 4px; border-radius: 50px; --background: #e3e3e3; --progress-background: #1351b4; }
        .course-progress span { color: #666; font-size: calc(.75rem * var(--font-scale, 1)); }
        .painel-card-actions { display: flex; flex-wrap: wrap; gap: 10px; width: 100%; }
        .painel-card-actions ion-button { margin: 0; min-height: 44px; --border-radius: 999px; font-weight: 600; text-transform: none; }
        @media (max-width: 767.98px) { .painel-card ion-card-content { padding: 16px; gap: 12px; } .painel-card-title { font-size: calc(1.125rem * var(--font-scale, 1)); } .painel-card-actions ion-button { flex: 1 1 auto; } .course-progress { width: 100%; flex-wrap: wrap; } .course-progress ion-progress-bar { max-width: none; width: 100%; flex: 1 1 100%; } }
        :host-context(.dark) .painel-card-title { color: #b3d1ff; }
        :host-context(.dark) .painel-card-header-shortname { color: #ced4da; }
        :host-context(.dark) .painel-card-info-icon { background: #343a40; color: #dee2e6; }
        :host-context(.color_mode_high_contrast) .painel-card { border: 3px solid #000; }
        :host-context(.color_mode_grayscale) .painel-card { filter: grayscale(1); }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelCourseCardComponent {
    @Input({ required: true }) course!: DashboardCourse;
    @Input({ required: true }) tab!: PainelTabKey;
    @Input() favourite = false;
    @Input() favouriteEnabled = false;
    @Output() open = new EventEmitter<void>();
    @Output() enrol = new EventEmitter<void>();
    @Output() cancelEnrol = new EventEmitter<void>();
    @Output() favouriteChange = new EventEmitter<void>();

    get title(): string {
        for (const value of [this.course.name, this.course.fullname, this.course.shortname]) {
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
        return `Curso ${this.course.id || ''}`;
    }
    get environment(): string {
        return [this.course.moodle, this.course.environment, this.course.ambiente?.titulo]
            .find(value => typeof value === 'string' && Boolean(value.trim()))?.trim() || 'AVA Acadêmico';
    }
    get isEnrolled(): boolean { return Boolean(this.course.is_enrolled || this.course.enrolled); }
    get progressValue(): number | null {
        const progress = Number(this.course.progress);
        return this.course.hasprogress === true && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : null;
    }
}
