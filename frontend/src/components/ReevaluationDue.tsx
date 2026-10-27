import { useEffect, useState } from "react";
import type { Reevaluation } from "../types/clinical";

function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15_000); return () => window.clearInterval(timer); }, []);
  return now;
}
export function ReevaluationSummary({ actions }: { actions: Reevaluation[] }) {
  const now = useNow();
  const pending = actions.filter(item => item.status === "PENDING");
  const overdue = pending.filter(item => Date.parse(item.due_at) <= now).length;
  return pending.length ? <p role={overdue ? "status" : undefined}>Reevaluaciones pendientes: {pending.length} · Vencidas: {overdue}</p> : null;
}
export default function ReevaluationDue({ dueAt, pending }: { dueAt: string; pending: boolean }) {
  const now = useNow();
  if (!pending) return null;
  const remaining = Date.parse(dueAt) - now;
  return <p role="status">{remaining > 0 ? `Pendiente · faltan ${Math.ceil(remaining / 60_000)} min` : `Vencida · hace ${Math.floor(-remaining / 60_000)} min`}</p>;
}
