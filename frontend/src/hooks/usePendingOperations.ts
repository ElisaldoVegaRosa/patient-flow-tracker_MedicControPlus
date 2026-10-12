import { useCallback, useRef, useState } from "react";

/** Acquire synchronously before React renders; release only the acquired operation. */
export function usePendingOperations() {
  const locks = useRef(new Map<string, symbol>());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const start = useCallback((key: string) => {
    if (locks.current.has(key)) return null;
    const token = Symbol(key);
    locks.current.set(key, token);
    setPending(new Set(locks.current.keys()));
    return () => {
      if (locks.current.get(key) !== token) return;
      locks.current.delete(key);
      setPending(new Set(locks.current.keys()));
    };
  }, []);
  const hasPending = useCallback(() => locks.current.size > 0, []);
  return { start, hasPending, isPending: (key: string) => pending.has(key) };
}
export type PendingOperations = ReturnType<typeof usePendingOperations>;
