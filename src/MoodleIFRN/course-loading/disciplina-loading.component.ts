import {
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

/**
 * Tela de carregamento da disciplina Moodle.
 *
 * Integração:
 * - O Ionic/Android mantém a status bar e a navigation bar nativas.
 * - O componente apresenta cabeçalho, abas e skeleton.
 * - O componente que hospeda o WebView deve definir [moodleReady]="true"
 *   somente quando o Moodle estiver realmente pronto para ser exibido.
 *
 * IMPORTANTE:
 * O evento "load" de um iframe/WebView, isoladamente, não garante que o
 * Moodle terminou de montar seu conteúdo. Em WebView nativa, envie o estado
 * pronto por uma ponte JavaScript/nativa ou pelo evento do componente usado.
 */
@Component({
  selector: 'app-disciplina-loading',
  template: `
    <main class="discipline-screen">
      <header class="course-header">
        <div class="toolbar">
          <button
            class="toolbar-button"
            type="button"
            aria-label="Voltar"
            (click)="back.emit()">
            ‹
          </button>

          <div class="course-name-toolbar">{{ courseTitle }}</div>

          <button
            class="toolbar-button info-button"
            type="button"
            aria-label="Informações da disciplina"
            (click)="info.emit()">
            i
          </button>
        </div>

        <div class="blue-rule"></div>

        <section class="course-summary">
          <div class="course-thumb" aria-hidden="true"></div>

          <div class="summary-main">
            <h1>{{ courseTitle }}</h1>

            <div class="course-progress" aria-label="Progresso da disciplina">
              <div class="progress-track">
                <div
                  class="progress-value"
                  [style.width.%]="progress">
                </div>
              </div>
              <span class="progress-number">{{ progress }}%</span>
            </div>
          </div>
        </section>

        <nav class="course-tabs" aria-label="Abas da disciplina">
          <button
            type="button"
            class="course-tab"
            [class.active]="activeTab === 'Curso'"
            [attr.aria-current]="activeTab === 'Curso' ? 'page' : null"
            (click)="selectTab('Curso')">
            Curso
          </button>

          <button
            type="button"
            class="course-tab"
            [class.active]="activeTab === 'Participantes'"
            [attr.aria-current]="activeTab === 'Participantes' ? 'page' : null"
            (click)="selectTab('Participantes')">
            Participantes
          </button>

          <button
            type="button"
            class="course-tab"
            [class.active]="activeTab === 'Notas'"
            [attr.aria-current]="activeTab === 'Notas' ? 'page' : null"
            (click)="selectTab('Notas')">
            Notas
          </button>

          <button
            class="course-tab tab-next"
            type="button"
            aria-label="Próxima aba"
            (click)="nextTab()">
            ›
          </button>
        </nav>
      </header>

      <section
        class="content-area"
        [class.is-ready]="moodleReady"
        [attr.aria-busy]="!moodleReady">

        <div class="skeleton-layer" aria-hidden="true">
          <article class="skeleton-card">
            <div class="skeleton-heading">
              <div class="skeleton-circle"></div>
              <div class="skeleton-line heading-line"></div>
            </div>
            <div class="skeleton-block banner-skeleton"></div>
          </article>

          <article class="skeleton-card">
            <div class="skeleton-heading">
              <div class="skeleton-circle"></div>
              <div class="skeleton-line heading-line medium-line"></div>
            </div>
            <div class="skeleton-line progress-skeleton"></div>
            <div class="skeleton-line section-label"></div>
            <div class="skeleton-resource">
              <div class="skeleton-icon"></div>
              <div class="skeleton-line long-line"></div>
            </div>
            <div class="skeleton-resource">
              <div class="skeleton-icon"></div>
              <div class="skeleton-line medium-line"></div>
            </div>
            <div class="skeleton-resource">
              <div class="skeleton-icon"></div>
              <div class="skeleton-line long-line"></div>
            </div>
          </article>

          <article class="skeleton-card">
            <div class="skeleton-heading">
              <div class="skeleton-circle"></div>
              <div class="skeleton-line heading-line short-line"></div>
            </div>
            <div class="skeleton-line progress-skeleton"></div>
            <div class="skeleton-line section-label medium-line"></div>
            <div class="skeleton-resource">
              <div class="skeleton-icon"></div>
              <div class="skeleton-line long-line"></div>
            </div>
            <div class="skeleton-resource">
              <div class="skeleton-icon"></div>
              <div class="skeleton-line medium-line"></div>
            </div>
          </article>

          <p class="loading-error" *ngIf="loadError">{{ loadError }}</p>
        </div>

        <div class="moodle-layer">
          <!--
            Projete aqui o WebView/componente Moodle já existente no projeto.
            O elemento projetado precisa receber o atributo moodle-content.
            Não crie um segundo WebView se o aplicativo já possui um.
          -->
          <ng-content select="[moodle-content]"></ng-content>
        </div>
      </section>
    </main>
  `,
  styleUrls: ['./disciplina-loading.component.scss'],
})
export class DisciplinaLoadingComponent {
  @Input() courseTitle = 'Introdução à Lógica e Programação';

  @Input()
  set progressValue(value: number) {
    const normalized = Number.isFinite(value) ? value : 0;
    this.progress = Math.max(0, Math.min(100, normalized));
  }
  progress = 50;

  @Input() moodleReady = false;
  @Input() loadError = '';

  @Output() tabChange = new EventEmitter<'Curso' | 'Participantes' | 'Notas'>();
  @Output() back = new EventEmitter<void>();
  @Output() info = new EventEmitter<void>();

  activeTab: 'Curso' | 'Participantes' | 'Notas' = 'Curso';

  selectTab(tab: 'Curso' | 'Participantes' | 'Notas'): void {
    this.activeTab = tab;
    this.tabChange.emit(tab);
  }

  nextTab(): void {
    const tabs: Array<'Curso' | 'Participantes' | 'Notas'> = [
      'Curso',
      'Participantes',
      'Notas',
    ];
    const currentIndex = tabs.indexOf(this.activeTab);
    this.selectTab(tabs[(currentIndex + 1) % tabs.length]);
  }

  /**
   * Pode ser chamado pelo componente pai quando receber a confirmação
   * de que o Moodle terminou de carregar e está pronto para ser mostrado.
   */
  markMoodleReady(): void {
    this.moodleReady = true;
    this.loadError = '';
  }

  markMoodleError(message = 'Não foi possível carregar a disciplina.'): void {
    this.loadError = message;
    // Mantém o skeleton visível para não revelar uma área vazia.
    this.moodleReady = false;
  }
}
