import { useEffect, useRef } from "react";
import { useFollowupDoctors } from "../hooks/useFollowupDoctors";
import type { Episode, LaboratoryFollowup, SessionUser } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { SampleApplied } from "./SpecimenWorkPanel";
import LaboratoryFollowupCard from "./LaboratoryFollowupCard";

export default function LaboratoryFollowupPanel(props: {
  episode: Episode; user: SessionUser; operations: PendingOperations; onApplied: SampleApplied;
  onConflict: (current: () => boolean) => void;
}) {
  if (!["DOCTOR", "NURSE", "LAB", "SUPERVISOR"].includes(props.user.role) || !props.episode.lab_followups?.some(item => item.id && item.version)) return null;
  return <Panel key={`${props.user.username}:${props.episode.id}`} {...props} />;
}
function Panel({ episode, user, operations, onApplied, onConflict }: Parameters<typeof LaboratoryFollowupPanel>[0]) {
  const recipients = useFollowupDoctors(user);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const cases = episode.lab_followups!.filter((item): item is LaboratoryFollowup => Boolean(item.id && item.version && item.episode_id));
  return <section className="panel"><h2>Seguimiento tras el alta</h2>
    {recipients.error && <div role="alert"><p>{recipients.error}</p><button type="button" onClick={recipients.retry}>Reintentar consulta de médicos</button></div>}
    {cases.map(item => <LaboratoryFollowupCard key={item.id} {...{ item, user, operations }} doctors={recipients.doctors}
      onApplied={(...args) => { if (mounted.current) onApplied(...args); }} onDirty={() => {}}
      onConflict={() => { if (mounted.current) onConflict(() => mounted.current); }} />)}
  </section>;
}
