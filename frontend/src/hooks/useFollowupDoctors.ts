import { useEffect, useState } from "react";
import { api, isSessionInterruption } from "../api/client";
import type { FollowupPerson, SessionUser } from "../types/clinical";

export function useFollowupDoctors(user: SessionUser, enabled = true) {
  const [doctors, setDoctors] = useState<FollowupPerson[]>([]), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const eligible = enabled && (user.role === "DOCTOR" || Boolean(user.can_coordinate));
  useEffect(() => {
    if (!eligible) return;
    let active = true;
    const controller = new AbortController();
    void api<{ doctors: FollowupPerson[] }>("/lab/followup-doctors", { signal: controller.signal })
      .then(value => { if (active) { setDoctors(value.doctors); setError(""); } })
      .catch(exception => { if (active && !isSessionInterruption(exception)) { setDoctors([]); setError("No se pudo consultar el personal médico receptor."); } });
    return () => { active = false; controller.abort(); };
  }, [eligible, user.username, user.role, user.can_coordinate, attempt]);
  return { doctors: eligible ? doctors : [], error: eligible ? error : "", retry: () => setAttempt(value => value + 1) };
}
