import { resourceVersion } from "../hooks/useVersionedWrites";
import { TabDraftStorage } from "./tabDraftStorage";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, getSessionRevision, isSessionInterruption } from "../api/client";
import type { Episode, LaboratoryQueue, SessionUser } from "../types/clinical";
import { allowsDraft, FormDraftRecovery } from "./formDrafts";
import type { DraftKind, FormDraft } from "./formDrafts";

type Status = "idle" | "waiting" | "checking" | "offer" | "retry";
export function useFormRecovery() {
  const lifetime = useRef(0);
  const [store] = useState(() => new FormDraftRecovery(new TabDraftStorage(import.meta.env.VITE_API_URL ?? "http://localhost:8000")));
  const [storageWarning, setStorageWarning] = useState(store.storageWarning);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [versionNotice, setVersionNotice] = useState("");
  const [noteOnly, setNoteOnly] = useState(true);
  const clear = useCallback(() => { store.clear(); setVersionNotice(""); setStatus("idle"); setError(""); setStorageWarning(store.storageWarning); }, [store]);
  const suspend = useCallback((resolveVersion?: (draft: FormDraft) => string | undefined) => { store.suspend(resolveVersion); setStatus(store.remainingMs() ? "waiting" : "idle"); setError(""); setStorageWarning(store.storageWarning); }, [store]);
  useEffect(() => {
    lifetime.current += 1;
    const timer = window.setInterval(() => {
      store.expire();
      setStorageWarning(store.storageWarning);
      if (!store.remainingMs()) setStatus("idle");
    }, 1000);
    function otherSessionClosed(event: StorageEvent) {
      if (event.key === "token" && event.newValue === null) clear();
    }
    window.addEventListener("storage", otherSessionClosed);
    return () => { lifetime.current += 1; window.clearInterval(timer); window.removeEventListener("storage", otherSessionClosed); };
  }, [store, clear]);

  const check = useCallback(async (user: SessionUser, restore = false) => {
    const pending = store.forUser(user);
    if (!pending) { setStatus("idle"); setError(""); setStorageWarning(store.storageWarning); return null; }
    setNoteOnly(pending.drafts.every(draft => draft.kind === "discharge"));
    setStatus("checking"); setError("");
    const revision = getSessionRevision();
    const instance = lifetime.current;
    const current = () => {
      if (instance !== lifetime.current || revision !== getSessionRevision()) return false;
      const available = store.forUser(user);
      if (!available || store.version !== pending.version) {
        setStatus(available ? "retry" : "idle");
        return false;
      }
      return true;
    };
    try {
      const episodes = new Map<number, Episode>();
      const valid: FormDraft[] = [];
      let laboratoryQueue: LaboratoryQueue | null = null;
      for (const draft of pending.drafts) {
        if (!allowsDraft(user.role, draft.kind)) continue;
        if (draft.episodeId !== undefined) {
          let episode = episodes.get(draft.episodeId);
          if (!episode) {
            try { episode = await api<Episode>(`/episodes/${draft.episodeId}`); }
            catch (exception) { if (exception instanceof ApiError && exception.status === 404) continue; throw exception; }
            if (!current()) return null;
            episodes.set(draft.episodeId, episode);
          }
          if (episode.id !== draft.episodeId || (draft.kind === "identity" ? episode.identity_status !== "PROVISIONAL" : episode.status !== "ACTIVE")) continue;
          if (draft.kind === "lab" && !episode.tasks?.some(task => task.id === draft.taskId && task.service === "LAB" && task.status === "PENDING")) continue;
        }
        valid.push(draft);
      }
      if (valid.some(draft => draft.kind === "lab")) {
        laboratoryQueue = await api<LaboratoryQueue>("/lab/orders?status=PENDING");
        if (!current()) return null;
        const orders = laboratoryQueue.orders;
        for (let i = valid.length - 1; i >= 0; i--) {
          const draft = valid[i];
          if (draft.kind === "lab" && !orders.some(order => order.id === draft.taskId && order.episode_id === draft.episodeId && order.status === "PENDING" && order.episode_status === "ACTIVE")) valid.splice(i, 1);
        }
      }
      if (!current()) return null;
      if (!valid.length) { clear(); return null; }
      const changed = valid.some(draft => {
        const episode = episodes.get(draft.episodeId ?? -1);
        const path = draft.kind === "identity" ? `/episodes/${draft.episodeId}/identity` : draft.kind === "triage" ? `/episodes/${draft.episodeId}/triage` : draft.kind === "discharge" ? `/episodes/${draft.episodeId}/discharge` : draft.kind === "lab" ? `/tasks/${draft.taskId}/complete` : null;
        return episode && path && draft.baseVersion !== resourceVersion(path, episode);
      });
      const notice = changed ? "Otra sesión modificó datos de estos formularios. Se conservará la versión original del borrador; revisa los cambios antes de guardar." : "";
      setVersionNotice(notice);
      if (!restore) { setStatus("offer"); return null; }
      clear();
      for (const draft of valid) store.track(user, draft, true, draft.editedAt);
      const episode = episodes.get(valid[0].episodeId ?? -1) ?? null;
      const note = valid.find(draft => draft.kind === "discharge")?.fields.note ?? "";
      return { drafts: valid, episode, note, laboratoryQueue, versionNotice: notice };
    } catch (exception) {
      if (isSessionInterruption(exception) || !current()) return null;
      if (exception instanceof ApiError && [403, 404].includes(exception.status)) clear();
      else { setStatus("retry"); setError("No fue posible comprobar el episodio. Puedes reintentar recuperar la nota o los formularios."); }
      return null;
    }
  }, [store, clear]);
  const trackForm = useCallback((user: SessionUser, draft: FormDraft, dirty = true) => { store.track(user, draft, dirty); setStorageWarning(store.storageWarning); }, [store]);
  const track = useCallback((username: string, episodeId: number, note: string, baseVersion?: string) => { store.track({ username, role: "DOCTOR" }, { kind: "discharge", episodeId, baseVersion, fields: { note } }, !!note.trim()); setStorageWarning(store.storageWarning); }, [store]);
  const remove = useCallback((kind: DraftKind, episodeId?: number, taskId?: number) => store.remove(kind, episodeId, taskId), [store]);
  return { status, error, storageWarning, versionNotice, noteOnly, clear, suspend, check, track, trackForm, remove };
}
