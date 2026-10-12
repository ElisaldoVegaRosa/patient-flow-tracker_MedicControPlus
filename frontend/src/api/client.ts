const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const SESSION_EXPIRED_EVENT = "mediccontrol:session-expired";
let sessionRevision = 0;
// Ambiguous writes stay in memory only until explicit retry or session change.
const writeIntents = new Map<string, { key: string; createdAt: number }>();
const replayWindow = 24 * 60 * 60 * 1000;

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

export class VersionConflictError extends ApiError {}

export const getSessionRevision = () => sessionRevision;
export const isSessionInterruption = (error: unknown) => error instanceof SessionInterruptedError;

export function establishSession(token: string) {
  sessionRevision += 1;
  writeIntents.clear();
  localStorage.setItem("token", token);
}

export function invalidateSession() {
  sessionRevision += 1;
  writeIntents.clear();
  localStorage.removeItem("token");
}

/** Reject old-session responses and notify App once per interrupted session. */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const revision = sessionRevision;
  const login = path === "/auth/login";
  const method = (options.method ?? "GET").toUpperCase();
  const protectedWrite = ["POST", "PATCH"].includes(method) && !path.startsWith("/auth/");
  const headers = new Headers(options.headers);
  const version = headers.get("If-Match");
  const intent = protectedWrite ? `${method}:${path}:${options.body ?? ""}:${version ?? ""}` : null;
  if (intent && !headers.has("Idempotency-Key")) {
    let pending = writeIntents.get(intent);
    if (pending && Date.now() - pending.createdAt >= replayWindow) {
      throw new ApiError("Verifica el resultado anterior antes de repetir esta operación: su clave expiró.", 409);
    }
    if (!pending) {
      if (writeIntents.size >= 256) throw new ApiError("Hay demasiadas operaciones sin confirmar. Revisa sus resultados antes de continuar.", 409);
      pending = { key: crypto.randomUUID(), createdAt: Date.now() };
      writeIntents.set(intent, pending);
    }
    headers.set("Idempotency-Key", pending.key);
  }
  const isCurrent = () => revision === sessionRevision &&
    (login || token === localStorage.getItem("token"));

  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...Object.fromEntries(headers.entries()),
      },
    });
    if (!isCurrent()) throw new SessionInterruptedError();
    if (response.status === 401 && token && !login) {
      invalidateSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw new SessionInterruptedError();
    }
    const result = (await response.json()) as T & { detail?: string | { code?: string; message?: string } };
    if (!isCurrent()) throw new SessionInterruptedError();
    if (intent && response.status < 500 && writeIntents.get(intent)?.key === headers.get("Idempotency-Key")) writeIntents.delete(intent);
    if (!response.ok) {
      const detail = result.detail;
      const message = typeof detail === "string" ? detail : detail?.message || "Ocurrió un error";
      if (response.status === 409 && typeof detail === "object" && detail.code === "version_conflict") throw new VersionConflictError(message, 409);
      throw new ApiError(message, response.status);
    }
    return result;
  } catch (error) {
    if (!isCurrent()) throw new SessionInterruptedError();
    throw error;
  }
}
