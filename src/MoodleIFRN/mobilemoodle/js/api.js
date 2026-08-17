(function (window) {
    const TOKEN_KEY = "ifrn_access_token";

    function getToken() {
        const params = new URLSearchParams(window.location.search);
        const queryToken = params.get("token");

        if (queryToken) {
            sessionStorage.setItem(TOKEN_KEY, queryToken);

            return queryToken;
        }

        return sessionStorage.getItem(TOKEN_KEY);
    }

    async function request(path) {
        const token = getToken();

        if (!token) {
            throw new Error("Sessão expirada. Entre novamente.");
        }

        const response = await fetch(path, {
            headers: {
                Accept: "application/json",
                Authorization: "Bearer " + token,
            },
        });

        if (response.status === 401) {
            sessionStorage.removeItem(TOKEN_KEY);
            throw new Error("Sessão expirada. Entre novamente.");
        }

        if (!response.ok) {
            throw new Error("Não foi possível carregar os dados do painel.");
        }

        return response.json();
    }

    window.MobileMoodleApi = {
        getToken,
        getDashboard: function () {
            return request("/dashboard/");
        },
        getCourse: function (courseId) {
            return request("/courses/" + courseId);
        },
    };
})(window);
