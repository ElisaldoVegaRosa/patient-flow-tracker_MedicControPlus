import type { SessionUser } from "../types/clinical";
import { allowsDraft } from "./formDrafts";
import type { DraftKind, FormDraft } from "./formDrafts";
import { RECOVERY_DURATION_MS } from "./dischargeDraft";

export const TAB_DRAFT_PREFIX = "mediccontrol:tab-drafts:v1:";
const fields: Record<DraftKind, string[]> = {
  arrival: ["name", "birth_date", "document", "priority", "location"],
  triage: ["priority", "location", "assigned_to"],
  vitals: ["temperature", "heart_rate", "systolic", "diastolic", "spo2", "respiratory_rate"],
  evaluation: ["diagnosis", "clinical_note", "disposition"],
  order: ["title", "service"], lab: ["result"], discharge: ["note"],
};
export type DraftSnapshot = { owner: SessionUser; drafts: FormDraft[] };
export const draftAlive = (draft: FormDraft) => typeof draft.editedAt === "number"
  && Number.isFinite(draft.editedAt) && draft.editedAt <= Date.now()
  && Date.now() - draft.editedAt < RECOVERY_DURATION_MS;

export class TabDraftStorage {
  readonly key: string;
  warning = "";
  constructor(api: string, privateStorage: () => Storage = () => window.sessionStorage) {
    this.key = TAB_DRAFT_PREFIX + encodeURIComponent(api);
    this.storage = privateStorage;
  }
  private storage: () => Storage;
  private failed() {
    this.warning = "No se pudo conservar el borrador para una recarga. Los campos actuales siguen disponibles en esta página.";
  }
  clear() {
    try { this.storage().removeItem(this.key); this.warning = ""; }
    catch { this.failed(); }
  }
  read(): DraftSnapshot | null {
    try {
      const raw = this.storage().getItem(this.key);
      if (!raw) return null;
      if (raw.length > 1_000_000) throw new Error();
      const value = JSON.parse(raw);
      if (value.version !== 1 || typeof value.owner?.username !== "string" || typeof value.owner?.role !== "string" || !Array.isArray(value.drafts) || value.drafts.length > 100) throw new Error();
      const drafts: FormDraft[] = [];
      for (const draft of value.drafts) {
        if (!draft || !(draft.kind in fields) || !allowsDraft(value.owner.role, draft.kind) || !draft.fields || typeof draft.fields !== "object" || Array.isArray(draft.fields)) throw new Error();
        if (!draftAlive(draft)) continue;
        if (draft.kind !== "arrival" && (!Number.isSafeInteger(draft.episodeId) || draft.episodeId < 1)) throw new Error();
        if (draft.kind === "lab" && (!Number.isSafeInteger(draft.taskId) || draft.taskId < 1)) throw new Error();
        if (draft.baseVersion !== undefined && typeof draft.baseVersion !== "string") throw new Error();
        const kind = draft.kind as DraftKind;
        if (Object.entries(draft.fields).some(([name, value]) => !fields[kind].includes(name) || typeof value !== "string" || value.length > 10_000)) throw new Error();
        drafts.push({ kind, episodeId: draft.episodeId, taskId: draft.taskId, baseVersion: draft.baseVersion, fields: { ...draft.fields }, editedAt: draft.editedAt });
      }
      const snapshot = { owner: { username: value.owner.username, role: value.owner.role }, drafts };
      this.write(snapshot);
      return drafts.length ? snapshot : null;
    } catch {
      this.clear();
      this.warning = "No se pudo recuperar el borrador de esta pestaña. Revisa los registros antes de volver a enviar una operación.";
      return null;
    }
  }
  write(snapshot: DraftSnapshot) {
    try {
      const drafts = snapshot.drafts.filter(draftAlive).map(draft => ({ kind: draft.kind, episodeId: draft.episodeId, taskId: draft.taskId, baseVersion: draft.baseVersion, editedAt: draft.editedAt,
        fields: Object.fromEntries(Object.entries(draft.fields).filter(([name]) => fields[draft.kind].includes(name))),
      }));
      const raw = JSON.stringify({ version: 1, owner: snapshot.owner, drafts });
      if (drafts.length > 100 || raw.length > 1_000_000 || drafts.some(draft => Object.values(draft.fields).some(value => value.length > 10_000))) throw new Error();
      if (!drafts.length) this.storage().removeItem(this.key);
      else this.storage().setItem(this.key, raw);
      this.warning = "";
    } catch {
      try { this.storage().removeItem(this.key); } catch { /* Storage can be unavailable entirely. */ }
      this.failed();
    }
  }
}
