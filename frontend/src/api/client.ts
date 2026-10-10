const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const SESSION_EXPIRED_EVENT = "mediccontrol:session-expired";
let sessionRevision = 0;

export class SessionInterruptedError extends Error {
  constructor() {
    super("Tu sesión cambió. Inicia sesión nuevamente.");
  }
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const getSessionRevision = () => sessionRevision;
export const isSessionInterruption = (error: unknown) => error instanceof SessionInterruptedError;

export function establishSession(token: string) {
  sessionRevision += 1;
  localStorage.setItem("token", token);
}

export function invalidateSession() {
  sessionRevision += 1;
  localStorage.removeItem("token");
}

/** Reject old-session responses and notify App once per interrupted session. */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const revision = sessionRevision;
  const login = path === "/auth/login";
  const isCurrent = () => revision === sessionRevision &&
    (login || token === localStorage.getItem("token"));

  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (!isCurrent()) throw new SessionInterruptedError();
    if (response.status === 401 && token && !login) {
      invalidateSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw new SessionInterruptedError();
    }
    const result = (await response.json()) as T & { detail?: string };
    if (!isCurrent()) throw new SessionInterruptedError();
    if (!response.ok) throw new ApiError(result.detail || "Ocurrió un error", response.status);
    return result;
  } catch (error) {
    if (!isCurrent()) throw new SessionInterruptedError();
    throw error;
  }
}
