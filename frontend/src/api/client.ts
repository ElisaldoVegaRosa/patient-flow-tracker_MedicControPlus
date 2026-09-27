    const API =
    import.meta.env.VITE_API_URL ??
    "http://localhost:8000";

    /**
     * Ejecuta una petición autenticada contra la API.
     *
     * Cuando el backend rechaza un token previamente válido, elimina
     * la sesión local y devuelve al usuario al inicio de sesión.
     */
    export async function api<T>(
    path: string,
    options: RequestInit = {},
    ): Promise<T> {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
        },
    });

    const result = (await response.json()) as T & {
        detail?: string;
    };

    if (
        response.status === 401 &&
        token &&
        path !== "/auth/login"
    ) {
        localStorage.removeItem("token");

        window.alert(
        "Tu sesión expiró. Inicia sesión nuevamente.",
        );

        window.location.reload();

        throw new Error(
        "Tu sesión expiró. Inicia sesión nuevamente.",
        );
    }

    if (!response.ok) {
        throw new Error(
        result.detail || "Ocurrió un error",
        );
    }

    return result;
    }