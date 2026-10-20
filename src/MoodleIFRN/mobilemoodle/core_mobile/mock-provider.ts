import { backendConfig } from '../../services_mobile/backend.config';
import { courseKey, MockCourse, MockDashboard } from '../../services_mobile/mock-api';
interface MockBridge { mockDashboard?: () => Promise<MockDashboard>; mockCourse?: (id: number) => Promise<MockCourse> }
export const isMock = backendConfig.provider === 'mock';
const bridge = (): MockBridge => (window.parent as Window & { MoodleIfrnBridge?: MockBridge }).MoodleIfrnBridge || {};
export async function mockDashboard(): Promise<DashboardData> {
    const data = await bridge().mockDashboard?.();
    if (!data || data.source !== 'mock') throw new Error('Sessão de simulação ausente.');
    const map = (items: MockCourse[]): DashboardCourse[] => items.map(c => ({
        id: c.id, name: c.name, source: 'mock', environment: c.environment, moodle: 'Ambiente de teste',
        key: courseKey('mock', c.environment, c.id), launch: { kind: 'mock', courseId: c.id },
    }));
    return { source: 'mock', nome: data.user.nome, username: data.user.username,
        courses: map(data.courses), diarios: map(data.diarios), coordenacoes: map(data.coordenacoes),
        praticas: map(data.praticas), reutilizaveis: map(data.reutilizaveis), autoinscricoes: map(data.autoinscricoes) };
}
export async function mockCourse(id: string): Promise<CourseData> {
    const course = await bridge().mockCourse?.(Number(id));
    if (!course || course.source !== 'mock') throw new Error('Curso de simulação ausente.');
    return { ...course, source: 'mock', moodle: 'Ambiente de teste' };
}
