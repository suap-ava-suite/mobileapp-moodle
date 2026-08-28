/** Tipos compartilhados do painel mobilemoodle (namespace global window.MobileMoodle). */

interface ApiErrorShape {
    status: number;
    title: string;
    message: string;
    retryable: boolean;
}

interface DashboardCourse {
    id: number | string;
    name?: string;
    fullname?: string;
    shortname?: string;
    progress?: number | null;
    hasprogress?: boolean;
    moodle?: string;
    environment?: string;
    ambiente?: { titulo?: string };
    isfavourite?: boolean;
    favourite?: boolean;
    is_enrolled?: boolean;
    enrolled?: boolean;
    details_url?: string;
}

interface DashboardData {
    nome?: string;
    foto_url?: string;
    foto?: string;
    avatar_url?: string;
    papel?: string;
    role?: string;
    filtro_situacao?: string;
    situacao?: string;
    filter_situacao?: string;
    filtro_label?: string;
    situacao_label?: string;
    courses?: DashboardCourse[];
    diarios?: DashboardCourse[];
    autoinscricoes?: DashboardCourse[];
    self_enrolments?: DashboardCourse[];
}

interface CourseActivity {
    name?: string;
    title?: string;
    modname?: string;
    module?: string;
    type?: string;
    completion?: boolean;
}

interface CourseSection {
    name?: string;
    activities?: CourseActivity[];
    modules?: CourseActivity[];
    cms?: CourseActivity[];
}

interface CourseData {
    id?: number | string;
    name?: string;
    teacher?: string;
    workload?: string;
    progress?: number;
    moodle?: string;
    summary?: string;
    description?: string;
    sections?: CourseSection[];
}

type PainelTabKey = 'diarios' | 'autoinscricoes';

type RouteInfo =
    | { name: 'painel' }
    | { name: 'curso'; courseId: number }
    | { name: 'notfound' };

type FilterSituacao = 'inprogress' | 'allincludinghidden' | 'favourites' | 'hidden';

interface ActiveFilter {
    situacao: FilterSituacao | string;
    label: string;
}

type SidebarModalType = 'profile' | 'help' | 'accessibility' | 'filter';

type A11yBoolKey =
    | 'dyslexia_friendly'
    | 'remove_justify'
    | 'highlight_links'
    | 'stop_animations'
    | 'hidden_illustrative_image'
    | 'big_cursor'
    | 'vlibras_active'
    | 'high_line_height';

type ColorMode = 'default' | 'high_contrast' | 'low_contrast' | 'colorblind' | 'grayscale';

interface A11yState {
    dyslexia_friendly: boolean;
    remove_justify: boolean;
    highlight_links: boolean;
    stop_animations: boolean;
    hidden_illustrative_image: boolean;
    big_cursor: boolean;
    vlibras_active: boolean;
    high_line_height: boolean;
    zoom_level: number;
    color_mode: ColorMode;
}

interface A11yModule {
    init: () => void;
    bindPanel: () => void;
    syncPanel: () => void;
    getState: () => A11yState;
    COLOR_MODE_LABELS: Record<ColorMode, string>;
}

interface MobileMoodleApp {
    content: HTMLElement | null;
    title: HTMLElement | null;
    menuUserInfo: HTMLElement | null;
    toolbarAvatar: HTMLElement | null;
    templatesRoot: HTMLElement | null;
    dashboardCache: DashboardData | null;
    sidebarUserName?: string;
    dashboardPapel?: string;
    activePainelTab?: PainelTabKey;
    activeFilter?: ActiveFilter;
    ASSET_BASE?: string;
    A11y?: A11yModule;
    FILTER_LABELS?: Record<string, string>;
    logout?: () => void;
    bindSidebar?: () => void;
    escapeHtml?: (value: unknown) => string;
    initials?: (name: unknown) => string;
    cloneTemplate?: (id: string) => DocumentFragment | null;
    fetchText?: (url: string) => Promise<string>;
    showLoading?: (message?: string) => void;
    markLoadingStart?: () => void;
    waitLoadingMinimum?: (force?: boolean) => Promise<void>;
    showNotFound?: () => void;
    showStatusError?: (error: ApiErrorShape | Error | unknown) => void;
    loadRoute?: (force: boolean) => Promise<void>;
    parseRoute?: () => RouteInfo;
    setUser?: (dashboard: DashboardData) => void;
    renderPainel?: (dashboard: DashboardData) => void;
    renderCurso?: (course: CourseData, dashboard: DashboardData) => void;
    closeSidebarModal?: () => void;
    openSidebarModal?: (type: SidebarModalType) => void;
    applyUserFilter?: (dashboard: DashboardData) => void;
    updateFilterChip?: () => void;
    onFilterChange?: (filter: ActiveFilter) => void;
}

interface CourseCacheEntry {
    value: CourseData | null;
    fetchedAt: number;
    inFlight: Promise<CourseData> | null;
}

interface MobileMoodleNamespace {
    App: MobileMoodleApp;
    ApiError: new (status: number, detail?: string) => ApiErrorShape & Error;
    messageForStatus: (status: number, detail?: string) => string;
    titleForStatus: (status: number) => string;
    isRetryable: (status: number) => boolean;
    TOKEN_KEY: string;
    isValidToken: (token: string) => boolean;
    getToken: () => string | null;
    setToken: (token: string) => boolean;
    clearToken: () => void;
    setApiBaseUrl: (url: string) => void;
    joinUrl: (path: string) => string;
    request: (path: string, options?: RequestInit) => Promise<unknown>;
    invalidateCache: () => void;
    getDashboard: (force?: boolean) => Promise<DashboardData>;
    getCourse: (courseId: string | number, force?: boolean) => Promise<CourseData>;
    getCoursesList: () => Promise<DashboardCourse[]>;
}

interface MobileMoodleApiPublic {
    setApiBaseUrl: (url: string) => void;
    getToken: () => string | null;
    setToken: (token: string) => boolean;
    clearToken: () => void;
    invalidateCache: () => void;
    getCoursesList: () => Promise<DashboardCourse[]>;
    getDashboard: (force?: boolean) => Promise<DashboardData>;
    getCourse: (courseId: string | number, force?: boolean) => Promise<CourseData>;
}

interface Window {
    MobileMoodle: MobileMoodleNamespace;
    MobileMoodleApi: MobileMoodleApiPublic;
    VLibras?: {
        Widget: new (url: string) => unknown;
    };
}
