const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
import type { SessionUser } from "../types/clinical";
import { WriteReferences, writeKind, writeReferenceOwner } from "../session/writeReferences";
import type { WriteReference } from "../session/writeReferences";
import { requestLifetime } from "./requestLifetime";

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
const uncertainWrites = new Map<string, UncertainWrite & { intent: string; options: RequestInit; owner: string | null }>();
const activeWrites = new Map<symbol, { revision: number; key: string | null; owner: string | null }>();
const activeRequests = new Set<ReturnType<typeof requestLifetime>>();
let referenceOwner: string | null = null;
let referenceToken: string | null = null;
let recoveredKeys = new Set<string>();
let referenceError = "";
let recoveryBinding = false;
let recoveryBindingRevision = 0;
const references = () => new WriteReferences(localStorage);
let interruptedWriteReview = false;
export const needsInterruptedWriteReview = () => interruptedWriteReview;
export function acknowledgeInterruptedWrites() { interruptedWriteReview = false; notifyWrites(); }
const notifyWrites = () => window.dispatchEvent(new Event(WRITE_RESULTS_EVENT));
export const getUncertainWrites = (): UncertainWrite[] => [...uncertainWrites.values()].map(({ key, path, message }) => ({ key, path, message }));
export const getWriteBody = (key: string) => uncertainWrites.get(key)?.options.body;
function clearWriteIntents() {
  for (const request of activeRequests) request.cancel(new SessionInterruptedError());
  activeRequests.clear();
  const persisted = (owner: string | null, key: string | null) => {
    try { return Boolean(owner && key && references().list(owner).some(item => item.key === key)); }
    catch { return false; }
  };
  interruptedWriteReview ||= [...uncertainWrites.values()].some(item => !persisted(item.owner, item.key)) || [...activeWrites.values()].some(item => item.revision === sessionRevision - 1 && !persisted(item.owner, item.key));
  writeIntents.clear();
  uncertainWrites.clear();
  referenceOwner = null;
  referenceToken = null;
  recoveredKeys = new Set();
  referenceError = "";
  recoveryBinding = false;
  recoveryBindingRevision++;
  notifyWrites();
}

/** Bind only after a successful authenticated identity response. Clinical content remains in RAM. */
export async function bindWriteRecovery(user: SessionUser) {
  const revision = sessionRevision;
  const token = localStorage.getItem("token");
  if (referenceToken && referenceToken !== token) interruptChangedToken();
  referenceToken = token;
  const binding = ++recoveryBindingRevision;
  recoveryBinding = true;
  try {
    const owner = await writeReferenceOwner(API, user);
    if (revision !== sessionRevision || token !== localStorage.getItem("token") || binding !== recoveryBindingRevision) throw new SessionInterruptedError();
    referenceOwner = owner;
    recoveredKeys = new Set(references().scan(owner).references.map(item => item.key));
    refreshWriteRecovery();
  } catch (error) {
    if (isSessionInterruption(error) || revision !== sessionRevision || binding !== recoveryBindingRevision) throw new SessionInterruptedError();
    referenceError = "No se pudo habilitar el registro local de envíos. Las consultas siguen disponibles; no se enviarán nuevas operaciones.";
    notifyWrites();
  } finally {
    if (binding === recoveryBindingRevision) recoveryBinding = false;
  }
}

export function refreshWriteRecovery() {
  if (!referenceOwner) { notifyWrites(); return; }
  try { referenceError = references().scan(referenceOwner).damaged.length ? "El registro local contiene referencias dañadas. Puedes consultar las referencias válidas; las nuevas operaciones siguen bloqueadas." : ""; }
  catch { referenceError = "No se puede leer el registro local de envíos. Revisa el almacenamiento antes de realizar otra operación."; }
  notifyWrites();
}
export const getWriteRecoveryError = () => referenceError;
export function getRecoveredWrites(): WriteReference[] {
  if (!referenceOwner) return [];
  try {
    return references().scan(referenceOwner).references.filter(item => recoveredKeys.has(item.key) && !uncertainWrites.has(item.key) && ![...activeWrites.values()].some(active => active.revision === sessionRevision && active.owner === referenceOwner && active.key === item.key));
  } catch { return []; }
}
export function getDamagedWriteReferences(): { key: string; consultable: boolean }[] {
  if (!referenceOwner) return [];
  try { return references().scan(referenceOwner).damaged.map(({ key, consultable }) => ({ key, consultable })); }
  catch { return []; }
}
export async function inspectDamagedWriteReference(key: string) {
  const owner = referenceOwner;
  const revision = sessionRevision;
  if (!owner) throw new SessionInterruptedError();
  const item = references().scan(owner).damaged.find(item => item.key === key && item.consultable);
  if (!item) throw new SessionInterruptedError();
  const response = await api<{ status: "unknown" | "confirmed" }>("/write-result", { headers: { "Idempotency-Key": key } });
  if (revision !== sessionRevision || owner !== referenceOwner) throw new SessionInterruptedError();
  if (response.status === "confirmed") {
    references().removeConfirmedDamage(owner, key, item.raw);
    writeRevision++;
  }
  refreshWriteRecovery();
  return response;
}
export function reviewRecoveredWrite(key: string) {
  if (!referenceOwner || !getRecoveredWrites().some(item => item.key === key)) throw new SessionInterruptedError();
  references().review(referenceOwner, key);
  notifyWrites();
}
export function forgetRecoveredWrite(key: string) {
  if (!referenceOwner || !getRecoveredWrites().some(item => item.key === key && item.reviewed)) throw new SessionInterruptedError();
  references().remove(referenceOwner, key);
  notifyWrites();
}
export async function inspectRecoveredWrite(key: string) {
  if (!referenceOwner || !getRecoveredWrites().some(item => item.key === key)) throw new SessionInterruptedError();
  return api<{ status: "unknown" | "confirmed"; result?: unknown }>("/write-result", { headers: { "Idempotency-Key": key } });
}
export function confirmRecoveredWrite(key: string) {
  if (!referenceOwner || !getRecoveredWrites().some(item => item.key === key)) throw new SessionInterruptedError();
  references().remove(referenceOwner, key);
  writeRevision++;
  notifyWrites();
}

function removeReference(owner: string | null, key: string) {
  if (!owner) return;
  try { references().remove(owner, key); }
  catch { referenceError = "El envío respondió, pero no se pudo retirar su referencia local. Reintenta la consulta antes de enviar otra operación."; }
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
  removeReference(pending.owner, key);
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

function interruptChangedToken(): never {
  // Another tab may have authenticated a different user. Keep its token intact.
  sessionRevision++;
  clearWriteIntents();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  throw new SessionInterruptedError();
}

/** Reject old-session responses and notify App once per interrupted session. */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const revision = sessionRevision;
  const login = path === "/auth/login";
  if (!login && referenceToken && referenceToken !== token) interruptChangedToken();
  const method = (options.method ?? "GET").toUpperCase();
  const protectedWrite = ["POST", "PATCH"].includes(method) && !path.startsWith("/auth/");
  // An already cancelled request has not reached the server or acquired an intention.
  if (options.signal?.aborted) throw new DOMException("La solicitud fue cancelada.", "AbortError");
  if (protectedWrite && recoveryBinding) throw new ApiError("Comprobando los envíos anteriores. Espera antes de enviar otra operación; esta no se ha enviado.", 409);
  if (protectedWrite && referenceOwner) refreshWriteRecovery();
  if (protectedWrite && referenceError) throw new ApiError(`${referenceError} No se ha enviado esta operación.`, 503);
  if (protectedWrite && getRecoveredWrites().some(item => !item.reviewed)) throw new ApiError("Hay envíos anteriores recuperados por revisar. Consulta sus resultados o confirma la revisión manual antes de crear otra operación.", 409);
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
  const owner = referenceOwner;
  const operationKey = headers.get("Idempotency-Key");
  let hadReference = false;
  if (protectedWrite) {
    writeRevision++;
    activeWrites.set(writeTicket, { revision, key: operationKey, owner });
    if (owner && operationKey) {
      try {
        hadReference = references().list(owner).some(item => item.key === operationKey);
        references().remember({ owner, key: operationKey, kind: writeKind(path), createdAt: Date.now(), reviewed: false });
      }
      catch {
        activeWrites.delete(writeTicket);
        referenceError = "No se pudo conservar la referencia de este envío. No se ha enviado; revisa el almacenamiento local.";
        notifyWrites();
        throw new ApiError(referenceError, 503);
      }
    }
  }

  const request = requestLifetime(options.signal);
  // Logout starts before App clears its local session: let server revocation finish.
  // Its response still cannot affect a new session and retains the same deadline.
  const logout = path === "/auth/logout";
  if (!logout) activeRequests.add(request);
  const storageChanged = (event: StorageEvent) => {
    if (!logout && (event.key === "token" || event.key === null) && token !== localStorage.getItem("token")) request.cancel(new SessionInterruptedError());
  };
  window.addEventListener("storage", storageChanged);
  try {
    const response = await request.wait(() => fetch(`${API}${path}`, {
      ...options,
      signal: request.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...Object.fromEntries(headers.entries()),
      },
    }));
    if (!isCurrent()) throw new SessionInterruptedError();
    if (response.status === 401 && token && !login) {
      // A fresh auth rejection cannot have committed. A retry's 401 says
      // nothing about an earlier ambiguous attempt, whose reference must survive.
      if (operationKey && !hadReference && !uncertainWrites.has(operationKey) && ![...activeWrites.entries()].some(([ticket, active]) => ticket !== writeTicket && active.key === operationKey && active.revision === revision)) removeReference(owner, operationKey);
      activeWrites.delete(writeTicket);
      invalidateSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw new SessionInterruptedError();
    }
    const result = (await request.wait(() => response.json())) as T & { detail?: string | { code?: string; message?: string } };
    if (!isCurrent()) throw new SessionInterruptedError();
    if (intent && response.status < 500) {
      const key = headers.get("Idempotency-Key")!;
      removeReference(owner, key);
      if (writeIntents.get(intent)?.key === key) writeIntents.delete(intent);
      if (uncertainWrites.get(key)?.intent === intent) {
        if (response.ok) window.dispatchEvent(new CustomEvent(WRITE_CONFIRMED_EVENT, { detail: path }));
        uncertainWrites.delete(key);
        notifyWrites();
      }
    }
    if (!response.ok) {
      const detail = result.detail;
      const message = Array.isArray(detail)
        ? detail.map((issue: { loc?: string[]; msg?: string }) => `${issue.loc?.slice(1).join(".") || "Datos"}: ${issue.msg || "Valor inválido"}`).join("; ")
        : typeof detail === "string" ? detail : detail?.message || "Ocurrió un error";
      if (response.status === 409 && typeof detail === "object" && detail.code === "version_conflict") throw new VersionConflictError(message, 409);
      throw new ApiError(message, response.status);
    }
    return result;
  } catch (error) {
    if (!isCurrent()) throw new SessionInterruptedError();
    if (intent && (!(error instanceof ApiError) || error.status >= 500)) {
      const key = headers.get("Idempotency-Key")!;
      const message = `Resultado por confirmar. El servidor puede haber guardado la operación. ${(error as Error).message}`;
      // A retry is a new transport attempt, never reuse its cancelled caller signal.
      uncertainWrites.set(key, { key, path, intent, message, options: { ...options, signal: undefined, headers }, owner });
      notifyWrites();
      throw new UncertainWriteError(message);
    }
    throw error;
  } finally {
    request.dispose();
    activeRequests.delete(request);
    window.removeEventListener("storage", storageChanged);
    activeWrites.delete(writeTicket);
    if (protectedWrite) notifyWrites();
  }
}
