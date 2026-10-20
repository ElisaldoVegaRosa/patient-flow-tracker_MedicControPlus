import { useEffect, useState } from "react";
import { api, getSessionRevision } from "../api/client";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import type { PendingIdentity, SessionUser } from "../types/clinical";

export default function IdentityQueuePage({ user, onOpenEpisode }: {
  user: SessionUser; onOpenEpisode: (id: number) => Promise<void>;
}) {
  const [patients, setPatients] = useState<PendingIdentity[] | null>(null);
  const { refresh, error } = useLiveRefresh({
    context: `identity:${getSessionRevision()}:${user.username}:${user.role}`,
    paused: () => false,
    load: async signal => {
      const result = await api<{ patients: PendingIdentity[] }>("/identity/pending", { signal });
      return () => setPatients(result.patients);
    },
  });
  useEffect(() => { void refresh(); }, [refresh]);
  return <main className="container"><section className="panel">
    <h1>Identidades por verificar</h1>
    <p>Admisión/archivo confirma los datos conservando el episodio y su actividad. No se fusionan fichas.</p>
    <button type="button" onClick={() => void refresh()}>Actualizar identidades</button>
    {error && <p role="alert">{error}</p>}
    {!patients && !error && <p role="status">Consultando identidades…</p>}
    {patients?.length === 0 && <p>No hay identidades provisionales pendientes.</p>}
    {patients?.map(patient => <article key={patient.patient_id} className="panel">
      <h2>{patient.name}</h2>
      <p>Identidad provisional · Ficha {patient.patient_id}</p>
      <p>{patient.document ?? "Documento no registrado"} · {patient.birth_date ?? "Nacimiento no registrado"}</p>
      {patient.episode_id !== null && <button type="button" onClick={() => void onOpenEpisode(patient.episode_id!)}>Revisar identidad · EP-{patient.episode_id}</button>}
    </article>)}
    <p>Actualización cada 15 segundos mientras la pestaña está visible.</p>
  </section></main>;
}
