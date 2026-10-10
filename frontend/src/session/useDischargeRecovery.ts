import { useCallback, useEffect, useState } from "react";
import { api, ApiError, isSessionInterruption } from "../api/client";
import type { Episode, SessionUser } from "../types/clinical";
import { DischargeDraftRecovery } from "./dischargeDraft";

type Status = "idle" | "waiting" | "checking" | "offer" | "retry";

export function useDischargeRecovery() {
  const [draft] = useState(() => new DischargeDraftRecovery());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const clear = useCallback(() => {
    draft.clear();
    setStatus("idle");
    setError("");
  }, [draft]);

  const suspend = useCallback(() => {
    draft.suspend();
    setStatus(draft.remainingMs() ? "waiting" : "idle");
    setError("");
  }, [draft]);

  useEffect(() => () => draft.clear(), [draft]);

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(clear, draft.remainingMs());
    return () => window.clearTimeout(timer);
  }, [draft, status, clear]);

  const check = useCallback(async (user: SessionUser, restore = false) => {
    const pending = draft.forUser(user);
    if (!pending) {
      clear();
      return null;
    }
    setStatus("checking");
    setError("");
    try {
      const episode = await api<Episode>(`/episodes/${pending.episodeId}`);
      if (draft.version !== pending.version) return null;
      if (!draft.forUser(user) || episode.id !== pending.episodeId || episode.status !== "ACTIVE") {
        clear();
        return null;
      }
      if (!restore) {
        setStatus("offer");
        return null;
      }
      const note = draft.take(user);
      clear();
      return note === null ? null : { episode, note };
    } catch (exception) {
      if (isSessionInterruption(exception) || draft.version !== pending.version) return null;
      if (!draft.forUser(user) || (exception instanceof ApiError && exception.status === 404)) {
        clear();
      } else {
        setStatus("retry");
        setError("No fue posible comprobar el episodio. Puedes reintentar recuperar la nota.");
      }
      return null;
    }
  }, [draft, clear]);

  const track = useCallback((username: string, episodeId: number, note: string) => {
    draft.track(username, episodeId, note);
  }, [draft]);

  return { status, error, track, clear, suspend, check };
}
