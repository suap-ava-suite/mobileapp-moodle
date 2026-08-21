/**
 * api-errors.js
 * Mensagens, títulos e a classe ApiError usados quando a API falha
 * (401, 404, 500, 502, 503, rede, timeout, etc.).
 */
(function (window) {
    "use strict";

    // Namespace compartilhado entre todos os arquivos JS do mobilemoodle.
    const MM = (window.MobileMoodle = window.MobileMoodle || {});

    /** Texto amigável exibido para o usuário conforme o código HTTP. */
    function messageForStatus(status, detail) {
        switch (status) {
            case 401:
            case 403:
                return "Sessão expirada. Entre novamente.";
            case 404:
                return "O recurso solicitado não foi encontrado.";
            case 408:
                return "A requisição demorou demais. Tente novamente.";
            case 429:
                return "Muitas tentativas. Aguarde e tente de novo.";
            case 500:
                return "Ocorreu um erro interno no servidor. Tente novamente em instantes.";
            case 502:
                return "O serviço está temporariamente indisponível (gateway). Verifique a conexão e tente de novo.";
            case 503:
                return "O serviço está em manutenção ou sobrecarregado. Tente novamente em breve.";
            case 504:
                return "Tempo esgotado no servidor. A conexão está lenta ou o serviço não respondeu.";
            default:
                // Qualquer outro 5xx genérico.
                if (status >= 500) {
                    return "Erro no servidor (" + status + "). Tente novamente em instantes.";
                }

                // Se a API mandou um detail/message, usa; senão mensagem padrão.
                return detail || "Não foi possível carregar os dados do painel.";
        }
    }

    /** Título curto da tela de erro (acima da mensagem). */
    function titleForStatus(status) {
        switch (status) {
            case 401:
            case 403:
                return "Acesso não autorizado";
            case 404:
                return "Não encontrado";
            case 408:
            case 504:
                return "Tempo esgotado";
            case 429:
                return "Muitas tentativas";
            case 500:
                return "Erro interno do servidor";
            case 502:
                return "Serviço indisponível";
            case 503:
                return "Serviço em manutenção";
            case 0:
                // status 0 = falha de rede / CORS / servidor offline
                return "Falha de conexão";
            default:
                if (status >= 500) {
                    return "Erro no servidor";
                }

                return "Algo deu errado";
        }
    }

    /** Indica se faz sentido mostrar o botão "Tentar novamente". */
    function isRetryable(status) {
        return status === 0 || status === 408 || status === 429 || status === 500 ||
            status === 502 || status === 503 || status === 504 || status >= 500;
    }

    /**
     * Erro padronizado da API.
     * O app.js / app-status.js leem: status, title, message, retryable.
     */
    function ApiError(status, detail) {
        const code = Number(status) || 0;

        this.name = "ApiError";
        this.status = code;
        this.title = titleForStatus(code);
        this.message = messageForStatus(code, detail);
        this.retryable = isRetryable(code);
    }

    // Faz ApiError se comportar como um Error nativo (stack, instanceof, etc.).
    ApiError.prototype = Object.create(Error.prototype);
    ApiError.prototype.constructor = ApiError;

    // Expõe no namespace para api-http.js e api.js usarem.
    MM.messageForStatus = messageForStatus;
    MM.titleForStatus = titleForStatus;
    MM.isRetryable = isRetryable;
    MM.ApiError = ApiError;
})(window);
