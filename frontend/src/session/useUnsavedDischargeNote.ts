import { useCallback, useEffect, useRef, useState } from "react";

export function useUnsavedDischargeNote() {
  const dirty = useRef(false);
  const evaluation = useRef(false);
  const [evaluationDirty, setEvaluationDirty] = useState(false);
  const order = useRef(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const action = useRef<(() => void) | null>(null);
  const [confirming, setConfirming] = useState(false);

  const clear = useCallback(() => {
    dirty.current = false;
    evaluation.current = false;
    setEvaluationDirty(false);
    order.current = false;
    setOrderDirty(false);
    action.current = null;
    setConfirming(false);
  }, []);

  const track = useCallback((note: string) => {
    dirty.current = Boolean(note.trim());
  }, []);

  const trackEvaluation = useCallback((changed: boolean) => {
    evaluation.current = changed;
    setEvaluationDirty(changed);
  }, []);

  const run = useCallback((next: () => void) => {
    if (!dirty.current && !evaluation.current && !order.current) {
      next();
      return;
    }
    action.current = next;
    setConfirming(true);
  }, []);

  const trackOrder = useCallback((changed: boolean) => {
    order.current = changed;
    setOrderDirty(changed);
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
      if (!dirty.current && !evaluation.current && !order.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  return { track, trackEvaluation, trackOrder, evaluationDirty, orderDirty, clear, run, confirming, cancel, discard };
}
