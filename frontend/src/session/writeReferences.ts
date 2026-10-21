import type { SessionUser } from "../types/clinical";

export const WRITE_REFERENCE_PREFIX = "mediccontrol:write-reference:v1:";
export const WRITE_REFERENCE_LIMIT = 256;
export const WRITE_KINDS = ["staffing", "account", "arrival", "identity", "triage", "vitals", "evaluation", "order", "task", "alert", "discharge", "demo", "rules", "operation"] as const;
export type WriteKind = typeof WRITE_KINDS[number];
export type WriteReference = { key: string; owner: string; kind: WriteKind; createdAt: number; reviewed: boolean };
const validKey = (key: string) => /^[A-Za-z0-9_-]{16,128}$/.test(key);

export async function writeReferenceOwner(api: string, user: SessionUser) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([api, user.username, user.role])));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function writeKind(path: string): WriteKind {
  if (path.startsWith("/staff/")) return "staffing";
  if (path === "/accounts" || path.startsWith("/accounts/")) return "account";
  if (path === "/episodes") return "arrival";
  if (/^\/episodes\/\d+\/identity$/.test(path)) return "identity";
  if (/^\/tasks\/\d+\/complete$/.test(path)) return "task";
  if (/^\/alerts\/\d+$/.test(path)) return "alert";
  if (path === "/demo/seed") return "demo";
  if (path === "/rules/evaluate") return "rules";
  const action = path.match(/^\/episodes\/\d+\/(triage|vitals|medical-evaluation|tasks|discharge)$/)?.[1];
  return ({ triage: "triage", vitals: "vitals", "medical-evaluation": "evaluation", tasks: "order", discharge: "discharge" } as Record<string, WriteKind>)[action ?? ""] ?? "operation";
}

/** One storage entry per key avoids concurrent tabs overwriting a shared list.
 * Never store a path, resource ID, payload, response, version or credential. */
export class WriteReferences {
  private storage: Storage;
  constructor(storage: Storage) { this.storage = storage; }
  scan(owner: string): { references: WriteReference[]; damaged: { key: string; raw: string; consultable: boolean }[] } {
    const keys = Array.from({ length: this.storage.length }, (_, index) => this.storage.key(index));
    const references: WriteReference[] = [];
    const damaged: { key: string; raw: string; consultable: boolean }[] = [];
    for (const storageKey of keys) {
      if (!storageKey?.startsWith(WRITE_REFERENCE_PREFIX)) continue;
      const raw = this.storage.getItem(storageKey);
      if (raw === null) continue;
      const key = storageKey.slice(WRITE_REFERENCE_PREFIX.length);
      let value: Partial<WriteReference> | null;
      try { value = JSON.parse(raw); }
      catch { damaged.push({ key, raw, consultable: false }); continue; }
      if (!value || typeof value.owner !== "string" || !/^[a-f0-9]{64}$/.test(value.owner)) {
        damaged.push({ key, raw, consultable: false }); continue;
      }
      if (value.owner !== owner) continue;
      if (!validKey(key) || !WRITE_KINDS.includes(value.kind as WriteKind) || typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt) || value.createdAt <= 0 || typeof value.reviewed !== "boolean" || Object.keys(value).some(name => !["owner", "kind", "createdAt", "reviewed"].includes(name))) {
        damaged.push({ key, raw, consultable: validKey(key) }); continue;
      }
      references.push({ key, owner, kind: value.kind!, createdAt: value.createdAt, reviewed: value.reviewed });
    }
    return { references: references.sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key)), damaged };
  }
  list(owner: string): WriteReference[] {
    const result = this.scan(owner);
    if (result.damaged.length) throw new Error("Registro local de envíos dañado.");
    return result.references;
  }
  removeConfirmedDamage(owner: string, key: string, original: string) {
    const item = this.scan(owner).damaged.find(item => item.key === key && item.consultable);
    if (!item || item.raw !== original) throw new Error("La referencia cambió durante la consulta. Vuelve a consultar.");
    this.storage.removeItem(WRITE_REFERENCE_PREFIX + key);
  }
  remember(reference: WriteReference) {
    if (!validKey(reference.key)) throw new Error("Identificador de envío no válido.");
    const existing = this.list(reference.owner);
    const previous = existing.find(item => item.key === reference.key);
    if (previous) return;
    const storageKey = WRITE_REFERENCE_PREFIX + reference.key;
    if (this.storage.getItem(storageKey) !== null) throw new Error("El identificador de envío pertenece a otra sesión.");
    if (existing.length >= WRITE_REFERENCE_LIMIT) throw new Error("Hay demasiadas referencias pendientes. Revisa los envíos antes de crear otro.");
    this.storage.setItem(storageKey, JSON.stringify({ owner: reference.owner, kind: reference.kind, createdAt: reference.createdAt, reviewed: reference.reviewed }));
  }
  review(owner: string, key: string) {
    const item = this.scan(owner).references.find(reference => reference.key === key);
    if (!item) throw new Error("La referencia ya no está disponible para esta sesión.");
    this.storage.setItem(WRITE_REFERENCE_PREFIX + key, JSON.stringify({ owner, kind: item.kind, createdAt: item.createdAt, reviewed: true }));
  }
  remove(owner: string, key: string) {
    if (this.scan(owner).references.some(reference => reference.key === key)) this.storage.removeItem(WRITE_REFERENCE_PREFIX + key);
  }
}
