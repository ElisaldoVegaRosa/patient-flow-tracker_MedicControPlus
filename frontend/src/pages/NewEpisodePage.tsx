import { useState } from "react";
import type { FormEvent } from "react";
import { AdmissionReviewError } from "../api/client";
import type { AdmissionCandidate } from "../types/clinical";

type NewEpisodePageProps = {
  initialProvisional?: boolean;
  submitting?: boolean;
  onOpenEpisode: (id: number) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function NewEpisodePage({ onSubmit, onOpenEpisode, submitting = false, initialProvisional = false }: NewEpisodePageProps) {
  const [provisional, setProvisional] = useState(initialProvisional);
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const hasActiveMatch = candidates.some(candidate => candidate.matches && candidate.active_episode_ids.length > 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onSubmit(event);
    } catch (error) {
      if (!(error instanceof AdmissionReviewError)) throw error;
      setSelected(null);
      setCandidates(error.candidates);
      setReviewing(true);
    }
  }
  function identityChanged(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if ((target instanceof HTMLInputElement && ["name", "document", "birth_date"].includes(target.name)) ||
        (target instanceof HTMLSelectElement && target.name === "provisional")) {
      setCandidates([]);
      setSelected(null);
      setReviewing(false);
    }
  }
  return (
    <main className="container narrow">
      <section className="panel">
        <h1>Registrar llegada</h1>

        <form data-draft-kind="arrival" className="form-grid" onSubmit={submit} onChange={identityChanged}>
          {selected !== null && <input type="hidden" name="patient_id" value={selected} />}
          <label>Tipo de identificación
            <select name="provisional" disabled={submitting} value={String(provisional)}
              onChange={event => setProvisional(event.target.value === "true")}>
              <option value="false">Datos de identidad registrados</option>
              <option value="true">Identidad provisional · por verificar</option>
            </select>
          </label>
          {provisional && <p>Registra solo los datos conocidos. Admisión/archivo verificará la identidad; no inventes documento ni nacimiento. Sin nombre se asignará una etiqueta provisional única.</p>}
          <label>
            Nombre completo
            <input disabled={submitting} name="name" required={!provisional} data-identity-optional={provisional ? "true" : undefined} />
          </label>

          <label>
            Fecha de nacimiento
            <input disabled={submitting} name="birth_date" type="date" required={!provisional} data-identity-optional={provisional ? "true" : undefined} />
          </label>

          <label>
            Documento
            <input disabled={submitting} name="document" required={!provisional} data-identity-optional={provisional ? "true" : undefined} />
          </label>

          <label>
            Prioridad inicial
            <select disabled={submitting} name="priority" defaultValue="3">
              <option value="1">P1 · Crítica</option>
              <option value="2">P2 · Alta</option>
              <option value="3">P3 · Media</option>
              <option value="4">P4 · Baja</option>
              <option value="5">P5 · No urgente</option>
            </select>
          </label>

          <label>
            Ubicación
            <input disabled={submitting} name="location" defaultValue="Recepción" />
          </label>

          {reviewing && <section className="admission-review" aria-label="Revisión de identidad">
            <h2>Revisar identidad del paciente</h2>
            <p>Comprueba documento, nombre y nacimiento. No se fusionan fichas. El documento distingue mayúsculas; el nombre no. Se ignoran espacios exteriores.</p>
            {candidates.length === 0 && <p>La ficha seleccionada ya no coincide. Revisa los datos y vuelve a consultar.</p>}
            {candidates.map(candidate => <div key={candidate.id}>
              <p>Ficha {candidate.id}: {candidate.name} · {candidate.birth_date ?? "Nacimiento no registrado"} · {candidate.document ?? "Documento no registrado"}</p>
              {!candidate.matches && <p>Los datos no coinciden. Revisa y corrige el formulario antes de continuar.</p>}
              {candidate.matches && candidate.active_episode_ids.map(id => <button key={id} type="button" disabled={submitting} onClick={() => void onOpenEpisode(id)}>Abrir episodio activo EP-{id}</button>)}
              {candidate.matches && !hasActiveMatch && <label>
                <input type="radio" checked={selected === candidate.id} disabled={submitting} onChange={() => setSelected(candidate.id)} />
                Confirmo la identidad y selecciono la ficha {candidate.id} para un nuevo ingreso
              </label>}
            </div>)}
            {candidates.length > 1 && <p>Hay varias fichas con este documento. Requieren revisión individual; selecciona solo la identidad verificada.</p>}
          </section>}
          <button type="submit" disabled={submitting || (reviewing && candidates.length > 0 && selected === null)}>
            {submitting ? "Registrando llegada…" : "Crear episodio y pulsera"}
          </button>
        </form>
      </section>
    </main>
  );
}
