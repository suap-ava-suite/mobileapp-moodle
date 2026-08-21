(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});

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
                if (status >= 500) {
                    return "Erro no servidor (" + status + "). Tente novamente em instantes.";
                }

                return detail || "Não foi possível carregar os dados do painel.";
        }
    }

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
                return "Falha de conexão";
            default:
                if (status >= 500) {
                    return "Erro no servidor";
                }

                return "Algo deu errado";
        }
    }

    function isRetryable(status) {
        return status === 0 || status === 408 || status === 429 || status === 500 ||
            status === 502 || status === 503 || status === 504 || status >= 500;
    }

    function ApiError(status, detail) {
        const code = Number(status) || 0;

        this.name = "ApiError";
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
    MM.ApiError = ApiError;
})(window);
