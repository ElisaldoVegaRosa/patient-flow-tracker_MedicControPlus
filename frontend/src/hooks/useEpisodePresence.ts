import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { api, getSessionRevision, isSessionInterruption } from "../api/client";
import type { EpisodePresenceData } from "../types/clinical";

export const PRESENCE_INTERVAL = 15_000;
type Options = { context: string | null; episodeId: number; root: RefObject<HTMLElement | null>; isEditing: () => boolean };
type State = { context: string; data?: EpisodePresenceData; error: string; updated?: number };

/** Advisory lease only. PUT/DELETE never enter the clinical write journal. */
export function useEpisodePresence(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const [status, setStatus] = useState<State>({ context: "", error: "" });
  useEffect(() => {
    if (!options.context) return;
    const context = options.context;
    const revision = getSessionRevision();
    let tab = crypto.randomUUID();
    let path = `/episodes/${options.episodeId}/presence/${tab}`;
    let sequence = 0;
    let disposed = false;
    let running = false;
    let resume = false;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const current = () => !disposed && revision === getSessionRevision();
    const visible = () => document.visibilityState !== "hidden";
    // Hidden tabs expire naturally; do not release a lease that must resume with its ID.
    async function renew() {
      if (!current() || !visible()) return;
      if (running) { resume = true; return; }
      clearTimeout(timer);
      running = true;
      controller = new AbortController();
      const requestedPath = path;
      try {
        const data = await api<EpisodePresenceData>(path, {
          method: "PUT", signal: controller.signal,
          body: JSON.stringify({ mode: latest.current.isEditing() ? "EDIT" : "VIEW", sequence: ++sequence }),
        });
        if (current() && visible() && requestedPath === path) setStatus({ context, data, error: "", updated: Date.now() });
      } catch (error) {
        if (current() && visible() && requestedPath === path && !isSessionInterruption(error)) setStatus(previous => ({
          ...previous, context, error: "No se pudo actualizar la presencia. La información puede estar desactualizada; no confirma que estés trabajando a solas.",
        }));
      } finally {
        running = false;
        if (current() && visible()) {
          if (resume) { resume = false; void renew(); }
          else timer = setTimeout(() => void renew(), PRESENCE_INTERVAL);
        }
      }
    }
    const changed = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void renew(), 250);
    };
    const visibility = () => {
      clearTimeout(timer);
      if (!visible()) controller?.abort();
      else void renew();
    };
    const focus = () => { void renew(); };
    const release = () => {
      if (revision === getSessionRevision()) void api(path, { method: "DELETE", keepalive: true }).catch(() => {});
    };
    const pageHidden = () => {
      controller?.abort();
      clearTimeout(timer);
      release();
      // A bfcache restoration must use a fresh lease, not the released tombstone.
      tab = crypto.randomUUID(); sequence = 0;
      path = `/episodes/${options.episodeId}/presence/${tab}`;
    };
    const root = options.root.current;
    root?.addEventListener("input", changed);
    root?.addEventListener("change", changed);
    root?.addEventListener("reset", changed);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", focus);
    window.addEventListener("pagehide", pageHidden);
    window.addEventListener("pageshow", focus);
    void renew();
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer); clearTimeout(debounce);
      root?.removeEventListener("input", changed);
      root?.removeEventListener("change", changed);
      root?.removeEventListener("reset", changed);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pagehide", pageHidden);
      window.removeEventListener("pageshow", focus);
      release();
    };
  }, [options.context, options.episodeId, options.root]);
  return status.context === options.context ? status : { context: options.context ?? "", error: "" };
}
