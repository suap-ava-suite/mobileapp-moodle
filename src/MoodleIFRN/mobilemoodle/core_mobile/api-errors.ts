/**
 * api-errors.ts
 * ----------------------------------------------------------------------------
 * Padroniza falhas da API para a UI.
 *
 * - messageForStatus / titleForStatus → textos amigáveis por código HTTP
 * - isRetryable → decide se mostra botão “Tentar novamente”
 * - ApiError → construtor estilo Error com status, title, message, retryable
 *
 * Exposto em MM para os outros módulos (api-http, app-status…).
 */
import { MM } from './namespace';

    /** Mensagem curta exibida ao usuário conforme o status HTTP. */
    function messageForStatus(status: number, detail?: string): string {
        switch (status) {
            case 401:
            case 403:
                return 'Sessão expirada. Entre novamente.';
            case 404:
                return 'O recurso solicitado não foi encontrado.';
            case 408:
                return 'A requisição demorou demais. Tente novamente.';
            case 429:
                return 'Muitas tentativas. Aguarde e tente de novo.';
            case 500:
                return 'Ocorreu um erro interno no servidor. Tente novamente em instantes.';
            case 502:
                return 'O serviço está temporariamente indisponível (gateway). Verifique a conexão e tente de novo.';
            case 503:
                return 'O serviço está em manutenção ou sobrecarregado. Tente novamente em breve.';
            case 504:
                return 'Tempo esgotado no servidor. A conexão está lenta ou o serviço não respondeu.';
            default:
                if (status >= 500) {
                    return 'Erro no servidor (' + status + '). Tente novamente em instantes.';
                }

                // status 0 = falha de rede; outros 4xx usam detail se vier da API
                return detail || 'Não foi possível carregar os dados do painel.';
        }
    }

    /** Título curto do card/tela de erro. */
    function titleForStatus(status: number): string {
        switch (status) {
            case 401:
            case 403:
                return 'Acesso não autorizado';
            case 404:
                return 'Não encontrado';
            case 408:
            case 504:
                return 'Tempo esgotado';
            case 429:
                return 'Muitas tentativas';
            case 500:
                return 'Erro interno do servidor';
            case 502:
                return 'Serviço indisponível';
            case 503:
                return 'Serviço em manutenção';
            case 0:
                return 'Falha de conexão';
            default:
                if (status >= 500) {
                    return 'Erro no servidor';
                }

                return 'Algo deu errado';
        }
    }

    /** Erros transitórios (rede, timeout, 5xx) permitem retry na UI. */
    function isRetryable(status: number): boolean {
        return status === 0 || status === 408 || status === 429 || status === 500 ||
            status === 502 || status === 503 || status === 504 || status >= 500;
    }

    /**
     * Construtor de erro da API (não usa `class` para manter o padrão do bundle).
     * Uso: `throw new MM.ApiError(401)` ou `new MM.ApiError(500, 'detalhe')`.
     */
    function ApiError(this: ApiErrorShape & Error, status: number, detail?: string): void {
        const code = Number(status) || 0;

        this.name = 'ApiError';
        this.status = code;
        this.title = titleForStatus(code);
        this.message = messageForStatus(code, detail);
        this.retryable = isRetryable(code);
    }

    ApiError.prototype = Object.create(Error.prototype);
    ApiError.prototype.constructor = ApiError;

    MM.messageForStatus = messageForStatus;
    MM.titleForStatus = titleForStatus;
    MM.isRetryable = isRetryable;
    MM.ApiError = ApiError as unknown as MobileMoodleNamespace['ApiError'];
