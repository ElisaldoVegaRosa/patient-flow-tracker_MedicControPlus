import type { SessionUser } from "../types/clinical";
import { RECOVERY_DURATION_MS } from "./dischargeDraft";

export type SpecimenDraft = { baseline: string; fields: Record<string, string>; editedAt: number };
const key = "mediccontrol:specimen-drafts:v1:" + encodeURIComponent(import.meta.env.VITE_API_URL ?? "http://localhost:8000");
const allowed = new Set(["reason", "location", "performed_by", "professional_id", "time_mode", "occurred_at_date", "occurred_at_hour", "occurred_at_minute", "occurred_at_period", "suitability", "result", "specimen_ids"]);
const allowedField = (name: string) => allowed.has(name) || ["title", "note", "followup_reason", "communication_plan", "user_id"].includes(name) || /^(?:analysis_a\d+|kind_s\d+|description_s\d+|link_s\d+_a\d+|repeat_analysis_\d+|legacy_review_\d+|due_at_(?:date|hour|minute|period))$/.test(name);
type Bucket = { username: string; role: string; drafts: Record<string, SpecimenDraft> };
const empty = (owner: SessionUser): Bucket => ({ username: owner.username, role: owner.role, drafts: {} });
export function clearSpecimenDrafts() { try { sessionStorage.removeItem(key); } catch { /* A blocked store holds no restorable draft. */ } }

export function claimSpecimenDraftOwner(owner: SessionUser) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const previous = JSON.parse(raw);
    if (typeof previous.username === "string" && typeof previous.role === "string" &&
        (previous.username !== owner.username || previous.role !== owner.role)) clearSpecimenDrafts();
  } catch { /* The form reports storage or damaged-data errors when recovery is requested. */ }
}

function load(owner: SessionUser): Bucket {
  const raw = sessionStorage.getItem(key);
  if (!raw) return empty(owner);
  if (raw.length > 500_000) throw new Error();
  const value = JSON.parse(raw) as Bucket;
  if (value.username !== owner.username || value.role !== owner.role) { clearSpecimenDrafts(); return empty(owner); }
  if (!value.drafts || typeof value.drafts !== "object" || Array.isArray(value.drafts)) throw new Error();
  const drafts: Record<string, SpecimenDraft> = {};
  if (Object.keys(value.drafts).length > 100) throw new Error();
  for (const [path, draft] of Object.entries(value.drafts)) {
    if (!/^(?:\/episodes\/\d+\/(?:lab-orders|discharge)|\/lab\/(?:specimens\/\d+\/(?:collection|delivery|receipt|suitability|repeat)|analyses\/\d+\/(?:results|cancel|reinstate)|results\/\d+\/(?:corrections|annul|review)|followups\/\d+\/(?:plan|propose|accept|cancel-handoff)))$/.test(path)) throw new Error();
    if (!draft || typeof draft.baseline !== "string" || draft.baseline.length > 256 || !Number.isFinite(draft.editedAt)) throw new Error();
    if (draft.editedAt > Date.now() || Date.now() - draft.editedAt >= RECOVERY_DURATION_MS) continue;
    if (!draft.fields || typeof draft.fields !== "object" || Array.isArray(draft.fields) || Object.entries(draft.fields).some(([name, text]) => !allowedField(name) || typeof text !== "string" || text.length > 2000)) throw new Error();
    drafts[path] = draft;
  }
  const clean = { ...empty(owner), drafts };
  if (!Object.keys(drafts).length) clearSpecimenDrafts();
  else if (Object.keys(drafts).length !== Object.keys(value.drafts).length) sessionStorage.setItem(key, JSON.stringify(clean));
  return clean;
}

export function readSpecimenDraft(owner: SessionUser, path: string): { draft?: SpecimenDraft; warning: string } {
  try { return { draft: load(owner).drafts[path], warning: "" }; }
  catch { clearSpecimenDrafts(); return { warning: "No se pudo recuperar el borrador de laboratorio de esta pestaña." }; }
}

export function saveSpecimenDraft(owner: SessionUser, path: string, baseline: string, fields: Record<string, string>, dirty: boolean) {
  try {
    const bucket = load(owner);
    if (dirty) bucket.drafts[path] = { baseline, fields: Object.fromEntries(Object.entries(fields).filter(([name]) => allowedField(name))), editedAt: Date.now() };
    else delete bucket.drafts[path];
    const raw = JSON.stringify(bucket);
    if (Object.keys(bucket.drafts).length > 100 || raw.length > 500_000) throw new Error();
    if (Object.keys(bucket.drafts).length) sessionStorage.setItem(key, raw); else clearSpecimenDrafts();
    return "";
  } catch { return "No se pudo conservar este borrador para una nueva sesión. Mantén esta página abierta."; }
}
