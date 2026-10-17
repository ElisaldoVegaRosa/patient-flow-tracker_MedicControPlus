import type { TabDraftStorage } from "./tabDraftStorage";
import type { SessionUser } from "../types/clinical";
import { RECOVERY_DURATION_MS } from "./dischargeDraft";

export type DraftKind = "arrival" | "triage" | "vitals" | "evaluation" | "order" | "lab" | "discharge";
export type FormDraft = { kind: DraftKind; episodeId?: number; taskId?: number; baseVersion?: string; fields: Record<string, string>; editedAt?: number };
const roles: Record<DraftKind, string[]> = {
  arrival: ["RECEPTION", "SUPERVISOR"], triage: ["NURSE", "SUPERVISOR"],
  vitals: ["NURSE", "DOCTOR"], evaluation: ["DOCTOR"], order: ["DOCTOR"],
  lab: ["LAB"], discharge: ["DOCTOR"],
};
export const draftKey = (draft: Pick<FormDraft, "kind" | "episodeId" | "taskId">) => `${draft.kind}:${draft.episodeId ?? ""}:${draft.taskId ?? ""}`;
export const allowsDraft = (role: string, kind: DraftKind) => roles[kind]?.includes(role) ?? false;

export class FormDraftRecovery {
  private current = new Map<string, FormDraft>();
  private owner: SessionUser | null = null;
  private pending: { owner: SessionUser; drafts: FormDraft[]; interruptedAt: number } | null = null;
  version = 0;
  private journal?: TabDraftStorage;
  constructor(journal?: TabDraftStorage) {
    this.journal = journal;
    const snapshot = journal?.read();
    if (snapshot) this.pending = { ...snapshot, interruptedAt: Math.min(...snapshot.drafts.map(draft => draft.editedAt!)) };
  }
  get storageWarning() { return this.journal?.warning ?? ""; }
  private persist() {
    const owner = this.pending?.owner ?? this.owner;
    if (owner) this.journal?.write({ owner, drafts: this.pending?.drafts ?? [...this.current.values()] });
    else this.journal?.clear();
  }
  expire() {
    let changed = false;
    const alive = (draft: FormDraft) => draft.editedAt !== undefined && draft.editedAt <= Date.now() && Date.now() - draft.editedAt < RECOVERY_DURATION_MS;
    for (const [key, draft] of this.current) if (!alive(draft)) { this.current.delete(key); changed = true; }
    if (this.pending) {
      const drafts = this.pending.drafts.filter(alive);
      if (drafts.length !== this.pending.drafts.length) {
        changed = true;
        this.pending.drafts = drafts;
        this.version += 1;
      }
      if (!drafts.length) this.pending = null;
    }
    if (changed) this.persist();
  }

  track(user: SessionUser, draft: FormDraft, dirty = true, editedAt = Date.now()) {
    const owner = this.pending?.owner ?? this.owner;
    if (owner && (owner.username !== user.username || owner.role !== user.role)) this.clear();
    if (this.pending || !allowsDraft(user.role, draft.kind)) return;
    this.owner = { username: user.username, role: user.role };
    const key = draftKey(draft);
    if (!dirty) this.current.delete(key);
    else this.current.set(key, { ...draft, fields: { ...draft.fields }, editedAt });
    this.persist();
  }

  remove(kind: DraftKind, episodeId?: number, taskId?: number) {
    const key = draftKey({ kind, episodeId, taskId });
    this.current.delete(key);
    if (this.pending) {
      this.pending.drafts = this.pending.drafts.filter(draft => draftKey(draft) !== key);
      this.version += 1;
      if (!this.pending.drafts.length) this.clear();
    }
    this.persist();
  }

  suspend(resolveVersion?: (draft: FormDraft) => string | undefined) {
    if (!this.pending && this.owner && this.current.size) {
      const drafts = [...this.current.values()].map(draft => ({ ...draft, baseVersion: resolveVersion?.(draft) ?? draft.baseVersion }));
      this.pending = { owner: this.owner, drafts, interruptedAt: Math.min(...drafts.map(draft => draft.editedAt!)) };
      this.version += 1;
    }
    this.current.clear();
    this.owner = null;
    this.persist();
  }

  remainingMs() {
    if (!this.pending) return 0;
    const elapsed = Date.now() - Math.max(...this.pending.drafts.map(draft => draft.editedAt!));
    return elapsed < 0 ? 0 : Math.max(0, RECOVERY_DURATION_MS - elapsed);
  }

  forUser(user: SessionUser) {
    const owner = this.pending?.owner ?? this.owner;
    if (owner && (owner.username !== user.username || owner.role !== user.role)) { this.clear(); return null; }
    this.expire();
    if (!this.pending) return null;
    if (!this.remainingMs() || user.username !== this.pending.owner.username || user.role !== this.pending.owner.role) {
      this.clear();
      return null;
    }
    return { drafts: this.pending.drafts.map(draft => ({ ...draft, fields: { ...draft.fields } })), version: this.version };
  }

  clear() {
    this.current.clear();
    this.owner = null;
    this.pending = null;
    this.version += 1;
    this.journal?.clear();
  }
}
