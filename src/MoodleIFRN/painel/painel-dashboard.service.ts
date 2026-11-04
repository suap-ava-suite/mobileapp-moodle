import { Injectable } from '@angular/core';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { createCourseFavourites } from '../mobilemoodle/core_mobile/course-favourites';

@Injectable({ providedIn: 'root' })
export class PainelDashboardService {
    private readonly favourites = createCourseFavourites();

    constructor(private readonly painelAva: PainelAvaService) {}

    getDashboard(): DashboardData | null {
        const raw = this.painelAva.getDashboard();
        if (!raw || typeof raw !== 'object') return null;
        const data = (Array.isArray(raw) ? { diarios: raw } : raw) as DashboardData;
        const profile = this.painelAva.getProfile();
        const name = this.profileName(profile, data);
        const photo = this.profilePhoto(profile) || data.foto_url || data.foto || data.avatar_url;
        return {
            ...data,
            nome: name,
            foto_url: photo,
            diarios: this.mapCourses(data.diarios || data.courses || [], false),
            coordenacoes: this.mapCourses(data.coordenacoes || [], false),
            autoinscricoes: this.mapCourses(data.autoinscricoes || data.self_enrolments || [], true),
        };
    }

    getLists(data: DashboardData): Record<PainelTabKey, DashboardCourse[]> {
        const diarios = data.diarios || data.courses || [];
        const autoinscricoes = data.autoinscricoes || data.self_enrolments || [];
        return {
            diarios: Array.isArray(diarios) ? this.mapCourses(diarios, false) : [],
            coordenacoes: Array.isArray(data.coordenacoes) ? this.mapCourses(data.coordenacoes, false) : [],
            autoinscricoes: Array.isArray(autoinscricoes) ? this.mapCourses(autoinscricoes, true) : [],
        };
    }

    /** Converte o contrato cru de /api/v1/diarios/ em itens do Painel Mobile. */
    private mapCourses(items: unknown[], showcase: boolean): DashboardCourse[] {
        return items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
            .map(item => {
                if (item['source'] === 'painel' && item['moodle_course_id'] != null) return item as unknown as DashboardCourse;
                const id = item['id'] as number | string | undefined;
                const numericId = Number(id);
                const fullname = this.string(item['fullname']);
                const shortname = this.string(item['shortname']);
                const disciplina = item['disciplina'] && typeof item['disciplina'] === 'object'
                    ? item['disciplina'] as Record<string, unknown> : {};
                const rawAmbiente = item['ambiente'] && typeof item['ambiente'] === 'object'
                    ? item['ambiente'] as Record<string, unknown> : undefined;
                const ambiente = rawAmbiente ? {
                    id: Number(rawAmbiente['id']) || undefined,
                    titulo: this.string(rawAmbiente['titulo']) || this.string(rawAmbiente['label']),
                } : undefined;
                const autoinscricao = item['autoinscricao'] && typeof item['autoinscricao'] === 'object'
                    ? item['autoinscricao'] as Record<string, unknown> : undefined;
                const viewurl = this.string(item['viewurl']) || this.string(item['url']);
                const environment = this.string(ambiente?.titulo) || 'AVA';
                const enrolled = item['is_enrolled'] ?? autoinscricao?.['is_enrolled'] ?? !showcase;
                return {
                    ...item,
                    id: Number.isFinite(numericId) ? numericId : id || 0,
                    name: fullname || this.string(disciplina['descricao']) || shortname || `Curso ${id || ''}`,
                    fullname: fullname || this.string(disciplina['descricao']) || shortname,
                    shortname: shortname || this.string(disciplina['sigla']) || String(id || ''),
                    moodle: environment,
                    environment,
                    ambiente,
                    isfavourite: Boolean(item['isfavourite'] || item['favourite']),
                    favourite: Boolean(item['isfavourite'] || item['favourite']),
                    is_enrolled: Boolean(enrolled),
                    enrolled: Boolean(enrolled),
                    details_url: this.string(autoinscricao?.['details_url']) || this.string(item['details_url']) || viewurl,
                    viewurl,
                    moodle_course_id: Number.isFinite(numericId) ? numericId : undefined,
                    moodle_site_url: this.siteOrigin(viewurl),
                    diario_id: Number(item['id_diario_clean'] ?? item['diario_id'] ?? item['id_diario']) || undefined,
                    source: 'painel',
                } as DashboardCourse;
            });
    }

    private string(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }

    private siteOrigin(viewurl: string): string | undefined {
        try {
            const url = new URL(viewurl);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
            if (/^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/.test(url.hostname) || /\.(local|localhost)$/.test(url.hostname)) return undefined;
            return url.origin;
        } catch { return undefined; }
    }

    private profileName(profile: Record<string, unknown> | null, data: DashboardData): string {
        for (const value of [profile?.['nome_exibicao'], profile?.['show_name'], profile?.['nome_usual'], profile?.['nome_social'],
            profile?.['nome_registro'], profile?.['nome'], profile?.['nome_completo'], data.nome, data.username]) {
            if (typeof value === 'string' && value.trim() && !/\.\.\.$|…$/.test(value.trim())) return value.trim();
        }
        return 'Estudante';
    }

    private profilePhoto(profile: Record<string, unknown> | null): string | undefined {
        for (const value of [profile?.['url_foto_150x200'], profile?.['url_foto_75x100'], profile?.['foto'], profile?.['profileimageurl']]) {
            if (typeof value !== 'string' || !value.trim()) continue;
            const url = value.trim();
            if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
            if (url.startsWith('/media/') || url.startsWith('/static/')) return `https://suap.ifrn.edu.br${url}`;
            if (url.startsWith('/')) return `https://ava.ifrn.edu.br${url}`;
        }
        return undefined;
    }

    canEditFavourite(course: DashboardCourse): boolean { return this.favourites.canEdit(course); }
    isFavourite(course: DashboardCourse): boolean { return this.favourites.isFavourite(course); }
    toggleFavourite(course: DashboardCourse): boolean { return this.favourites.toggle(course); }
}
