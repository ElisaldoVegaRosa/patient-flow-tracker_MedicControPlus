import { useCallback, useEffect, useRef, useState } from "react";

export function useUnsavedDischargeNote() {
  const dirty = useRef(false);
  const action = useRef<(() => void) | null>(null);
  const [confirming, setConfirming] = useState(false);

  const clear = useCallback(() => {
    dirty.current = false;
    action.current = null;
    setConfirming(false);
  }, []);

  const track = useCallback((note: string) => {
    dirty.current = Boolean(note.trim());
  }, []);

  const run = useCallback((next: () => void) => {
    if (!dirty.current) {
      next();
      return;
    }
    action.current = next;
    setConfirming(true);
  }, []);

  const cancel = useCallback(() => {
    action.current = null;
    setConfirming(false);
  }, []);

  const discard = useCallback(() => {
    const next = action.current;
    clear();
    next?.();
  }, [clear]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  return { track, clear, run, confirming, cancel, discard };
}
