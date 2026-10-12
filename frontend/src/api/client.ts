const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const SESSION_EXPIRED_EVENT = "mediccontrol:session-expired";
let sessionRevision = 0;
let writeRevision = 0;
export const getWriteRevision = () => writeRevision;
// Ambiguous writes stay in memory only until explicit retry or session change.
const writeIntents = new Map<string, { key: string; createdAt: number }>();
const replayWindow = 24 * 60 * 60 * 1000;
export const WRITE_RESULTS_EVENT = "mediccontrol:write-results";
export const WRITE_CONFIRMED_EVENT = "mediccontrol:write-confirmed";
export type UncertainWrite = { key: string; path: string; message: string };
const uncertainWrites = new Map<string, UncertainWrite & { intent: string; options: RequestInit }>();
const activeWrites = new Map<symbol, number>();
let interruptedWriteReview = false;
export const needsInterruptedWriteReview = () => interruptedWriteReview;
export function acknowledgeInterruptedWrites() { interruptedWriteReview = false; notifyWrites(); }
const notifyWrites = () => window.dispatchEvent(new Event(WRITE_RESULTS_EVENT));
export const getUncertainWrites = (): UncertainWrite[] => [...uncertainWrites.values()].map(({ key, path, message }) => ({ key, path, message }));
export const getWriteBody = (key: string) => uncertainWrites.get(key)?.options.body;
function clearWriteIntents() {
  interruptedWriteReview ||= uncertainWrites.size > 0 || [...activeWrites.values()].some(revision => revision === sessionRevision - 1);
  writeIntents.clear();
  uncertainWrites.clear();
  notifyWrites();
}

export class UncertainWriteError extends Error {}

export async function inspectWrite(key: string) {
  const pending = uncertainWrites.get(key);
  if (!pending) throw new SessionInterruptedError();
  return api<{ status: "unknown" | "confirmed"; result?: unknown }>("/write-result", { headers: { "Idempotency-Key": key } });
}

export async function retryWrite(key: string): Promise<unknown> {
  const pending = uncertainWrites.get(key);
  if (!pending) throw new SessionInterruptedError();
  const intent = writeIntents.get(pending.intent);
  if (intent && Date.now() - intent.createdAt >= replayWindow) throw new ApiError("Verifica el resultado anterior antes de repetir esta operación: su clave expiró.", 409);
  return api(pending.path, pending.options);
}

export function confirmWrite(key: string) {
  const pending = uncertainWrites.get(key);
  if (!pending) return;
  writeRevision++;
  if (writeIntents.get(pending.intent)?.key === key) writeIntents.delete(pending.intent);
  uncertainWrites.delete(key);
  window.dispatchEvent(new CustomEvent(WRITE_CONFIRMED_EVENT, { detail: pending.path }));
  notifyWrites();
}

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
  clearWriteIntents();
  localStorage.setItem("token", token);
}

export function invalidateSession() {
  sessionRevision += 1;
  clearWriteIntents();
  localStorage.removeItem("token");
}

/** Reject old-session responses and notify App once per interrupted session. */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const revision = sessionRevision;
  const login = path === "/auth/login";
  const method = (options.method ?? "GET").toUpperCase();
  const protectedWrite = ["POST", "PATCH"].includes(method) && !path.startsWith("/auth/");
  if (protectedWrite && interruptedWriteReview) throw new ApiError("Revisa los registros del envío incierto anterior antes de crear otra operación: la sesión perdió su clave de reintento.", 409);
  const headers = new Headers(options.headers);
  const version = headers.get("If-Match");
  const intent = protectedWrite ? `${method}:${path}:${options.body ?? ""}:${version ?? ""}` : null;
  if (intent && [...uncertainWrites.values()].some(item => item.path === path && item.intent !== intent)) {
    throw new UncertainWriteError("Hay un envío anterior por confirmar para este recurso. Consulta su resultado o reintenta la operación original antes de enviar cambios.");
  }
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
  const writeTicket = Symbol();
  if (protectedWrite) { writeRevision++; activeWrites.set(writeTicket, revision); }

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
      activeWrites.delete(writeTicket);
      invalidateSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw new SessionInterruptedError();
    }
    const result = (await response.json()) as T & { detail?: string | { code?: string; message?: string } };
    if (!isCurrent()) throw new SessionInterruptedError();
    if (intent && response.status < 500) {
      const key = headers.get("Idempotency-Key")!;
      if (writeIntents.get(intent)?.key === key) writeIntents.delete(intent);
      if (uncertainWrites.get(key)?.intent === intent) {
        if (response.ok) window.dispatchEvent(new CustomEvent(WRITE_CONFIRMED_EVENT, { detail: path }));
        uncertainWrites.delete(key);
        notifyWrites();
      }
    }
    if (!response.ok) {
      const detail = result.detail;
      const message = typeof detail === "string" ? detail : detail?.message || "Ocurrió un error";
      if (response.status === 409 && typeof detail === "object" && detail.code === "version_conflict") throw new VersionConflictError(message, 409);
      throw new ApiError(message, response.status);
    }
    return result;
  } catch (error) {
    if (!isCurrent()) throw new SessionInterruptedError();
    if (intent && (!(error instanceof ApiError) || error.status >= 500)) {
      const key = headers.get("Idempotency-Key")!;
      const message = `Resultado por confirmar. El servidor puede haber guardado la operación. ${(error as Error).message}`;
      uncertainWrites.set(key, { key, path, intent, message, options: { ...options, headers } });
      notifyWrites();
      throw new UncertainWriteError(message);
    }
    throw error;
  } finally {
    activeWrites.delete(writeTicket);
  }
}
