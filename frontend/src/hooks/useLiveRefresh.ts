import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { getSessionRevision, isSessionInterruption, getWriteRevision } from "../api/client";

export const LIVE_REFRESH_INTERVAL = 15_000;
type Options = {
  context: string | null;
  paused: () => boolean;
  load: (signal: AbortSignal) => Promise<() => void>;
};

/** One active read per view. A write, navigation or hidden tab invalidates its result. */
export function useLiveRefresh(options: Options) {
  const callbacks = useRef(options);
  useLayoutEffect(() => { callbacks.current = options; });
  const trigger = useRef<() => Promise<void>>(async () => {});
  const [status, setStatus] = useState<{ context: string; error: string; updated?: number }>({ context: "", error: "" });
  useLayoutEffect(() => {
    const context = options.context ?? "";
    if (!context) return;
    let disposed = false;
    let running = false;
    let resume = false;
    let visibilityRevision = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const visible = () => document.visibilityState !== "hidden";
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed && visible()) timer = setTimeout(() => { void refresh(); }, LIVE_REFRESH_INTERVAL);
    };
    async function refresh() {
      if (disposed || callbacks.current.context !== context || running || !visible()) return;
      clearTimeout(timer);
      if (callbacks.current.paused()) { schedule(); return; }
      running = true;
      controller = new AbortController();
      const session = getSessionRevision();
      const writes = getWriteRevision();
      const visibility = visibilityRevision;
      const current = () => !disposed && callbacks.current.context === context && visible() && visibility === visibilityRevision && session === getSessionRevision() && writes === getWriteRevision() && !callbacks.current.paused();
      try {
        const apply = await callbacks.current.load(controller.signal);
        if (current()) {
          apply();
          setStatus({ context, error: "", updated: Date.now() });
        }
      } catch (exception) {
        if (current() && !isSessionInterruption(exception)) setStatus(previous => ({ context, updated: previous.context === context ? previous.updated : undefined, error: (exception as Error).message }));
      } finally {
        running = false;
        if (resume && !disposed && visible()) { resume = false; void refresh(); }
        else schedule();
      }
    }
    function visibilityChanged() {
      visibilityRevision++;
      clearTimeout(timer);
      if (!visible()) controller?.abort();
      if (visible()) {
        if (running) resume = true;
        else void refresh();
      }
    }
    const focus = () => { void refresh(); };
    trigger.current = refresh;
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("focus", focus);
    schedule();
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("focus", focus);
    };
  }, [options.context]);
  const refresh = useCallback(() => trigger.current(), []);
  return { refresh, error: status.context === options.context ? status.error : "", updated: status.context === options.context ? status.updated : undefined };
}
