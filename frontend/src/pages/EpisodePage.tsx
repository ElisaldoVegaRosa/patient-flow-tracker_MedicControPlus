import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { usePendingOperations } from "../hooks/usePendingOperations";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { DraftKind } from "../session/formDrafts";
import { resourceVersion, useVersionedWrites } from "../hooks/useVersionedWrites";
import type { VersionedWrites } from "../hooks/useVersionedWrites";
import WriteConflicts from "../components/WriteConflicts";
import RecordCorrectionForm from "../components/RecordCorrectionForm";
import ReasonActionForm from "../components/ReasonActionForm";
import PatientIdentity from "../components/PatientIdentity";
import WristbandPrint from "../components/WristbandPrint";
import { QRCodeSVG } from "qrcode.react";
import { isSessionInterruption, WRITE_CONFIRMED_EVENT } from "../api/client";
import type { AlertHistoryEntry, Episode, User } from "../types/clinical";
import { clinicalLabel } from "../presentation/clinicalLabels";

type EpisodePageProps = {
  pendingOperations?: PendingOperations;
  versionedWrites?: VersionedWrites;
  onDraftSaved?: (kind: DraftKind) => void;
  onOpenLaboratory?: () => void;
  episode: Episode;
  user: User;
  updateEpisode: (episode: Episode) => void;
  showError: (message: string) => void;
  initialDischargeNote?: string;
  onDischargeNoteChange?: (note: string) => void;
  onMedicalEvaluationChange?: (changed: boolean) => void;
  onClinicalOrderChange?: (changed: boolean) => void;
};

export default function EpisodePage({
  episode,
  user,
  updateEpisode,
  showError,
  pendingOperations,
  versionedWrites,
  onDraftSaved,
  onOpenLaboratory,
  initialDischargeNote = "",
  onDischargeNoteChange,
  onMedicalEvaluationChange,
  onClinicalOrderChange,
}: EpisodePageProps) {
  const isClosed = episode.status !== "ACTIVE";
  const latestVitals = episode.vitals[0];
  const [dischargeNote, setDischargeNote] = useState(initialDischargeNote);
  const [dischargeError, setDischargeError] = useState("");
  const localOperations = usePendingOperations();
  const operations = pendingOperations ?? localOperations;
  const localWrites = useVersionedWrites();
  const writes = versionedWrites ?? localWrites;
  const episodeKey = (name: string) => `episode:${episode.id}:${name}`;
  const discharging = operations.isPending(episodeKey("discharge"));
  const savingEvaluation = operations.isPending(episodeKey("evaluation"));
  const creatingOrder = operations.isPending(episodeKey("order"));
  const savingVitals = operations.isPending(episodeKey("vitals"));
  const savingTriage = operations.isPending(episodeKey("triage"));
  const [taskErrors, setTaskErrors] = useState<Record<number, string>>({});
  const [alertErrors, setAlertErrors] = useState<Record<number, string>>({});
  const [triageSaved, setTriageSaved] = useState(false);
  const [triageError, setTriageError] = useState("");
  const [vitalsSaved, setVitalsSaved] = useState(false);
  const [vitalsError, setVitalsError] = useState("");
  const [evaluationSaved, setEvaluationSaved] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [orderError, setOrderError] = useState("");
  useEffect(() => {
    const confirmed = (event: Event) => {
      const path = (event as CustomEvent<string>).detail;
      if (path === `/episodes/${episode.id}/triage`) setTriageError("");
      if (path === `/episodes/${episode.id}/vitals`) setVitalsError("");
      if (path === `/episodes/${episode.id}/medical-evaluation`) setEvaluationError("");
      if (path === `/episodes/${episode.id}/tasks`) setOrderError("");
      if (path === `/episodes/${episode.id}/discharge`) setDischargeError("");
      const task = path.match(/^\/tasks\/(\d+)\/complete$/);
      const alert = path.match(/^\/alerts\/(\d+)$/);
      if (task) setTaskErrors(previous => { const next = { ...previous }; delete next[Number(task[1])]; return next; });
      if (alert) setAlertErrors(previous => { const next = { ...previous }; delete next[Number(alert[1])]; return next; });
    };
    window.addEventListener(WRITE_CONFIRMED_EVENT, confirmed);
    return () => window.removeEventListener(WRITE_CONFIRMED_EVENT, confirmed);
  }, [episode.id]);

  async function dischargeEpisode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (user.role !== "DOCTOR" || episode.status !== "ACTIVE") return;
    const note = dischargeNote.trim();
    if (!note) {
      setDischargeError("Escribe una nota de alta antes de cerrar el episodio.");
      return;
    }
    const release = operations.start(episodeKey("discharge"));
    if (!release) return;
    setDischargeError("");
    try {
      const path = `/episodes/${episode.id}/discharge`;
      updateEpisode(await writes.write(path, {
        method: "POST",
        body: JSON.stringify({ note }),
      }, episode.id, episode.clinical_version));
    } catch (exception) {
      if (isSessionInterruption(exception)) return;
      setDischargeError((exception as Error).message);
    } finally {
      release();
    }
  }

  async function call(path: string, options: RequestInit, reportError = showError) {
    try {
      const updated = await writes.write(path, options, episode.id, resourceVersion(path, episode));
      const kind = path.endsWith("/triage") ? "triage" : path.endsWith("/vitals") ? "vitals" : path.endsWith("/medical-evaluation") ? "evaluation" : path.endsWith("/tasks") ? "order" : null;
      if (kind) onDraftSaved?.(kind);
      updateEpisode(updated);
    } catch (exception) {
      if (isSessionInterruption(exception)) return false;
      reportError((exception as Error).message);
      return false;
    }
    return true;
  }

  async function updateAlert(alertId: number, status: "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED") {
    const alert = episode.alerts.find((item) => item.id === alertId);
    const allowed = alert && !isClosed && (
      (status === "ACKNOWLEDGED" && alert.status === "ACTIVE" && ["NURSE", "DOCTOR", "SUPERVISOR"].includes(user.role)) ||
      (status === "ESCALATED" && ["ACTIVE", "ACKNOWLEDGED"].includes(alert.status) && ["NURSE", "DOCTOR", "SUPERVISOR"].includes(user.role)) ||
      (status === "RESOLVED" && ["ACKNOWLEDGED", "ESCALATED"].includes(alert.status) && ["DOCTOR", "SUPERVISOR"].includes(user.role))
    );
    if (!allowed) return;
    const release = operations.start(`alert:${alertId}`);
    if (!release) return;
    setAlertErrors((previous) => {
      const next = { ...previous };
      delete next[alertId];
      return next;
    });
    try {
      await call(`/alerts/${alertId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }, (message) => setAlertErrors((previous) => ({ ...previous, [alertId]: message })));
    } finally {
      release();
    }
  }

  async function completeTask(taskId: number) {
    const task = episode.tasks.find((item) => item.id === taskId);
    if (isClosed || task?.status !== "PENDING" || task.service === "LAB") return;
    const release = operations.start(`task:${taskId}`);
    if (!release) return;
    setTaskErrors((previous) => {
      const next = { ...previous };
      delete next[taskId];
      return next;
    });
    try {
      await call(`/tasks/${taskId}/complete`, {
        method: "PATCH",
        body: JSON.stringify({ result: "Completada sin novedades" }),
      }, (message) => setTaskErrors((previous) => ({ ...previous, [taskId]: message })));
    } finally {
      release();
    }
  }

  async function changeNote(eventId: number, action: "CORRECT" | "ANNUL", reason: string, value?: string): Promise<boolean> {
    const original = episode.events.find(item => item.id === eventId);
    if (user.role !== "DOCTOR" || !original || !["MEDICAL_EVALUATION", "DISCHARGE"].includes(original.type) || original.annulled) return false;
    const release = operations.start(`event:${eventId}`);
    if (!release) return false;
    try {
      updateEpisode(await writes.write(`/events/${eventId}/note`, {
        method: "PATCH", body: JSON.stringify({ action, reason, ...(value ? { value } : {}) }),
      }, episode.id, original.version));
      return true;
    } catch (exception) {
      if (!isSessionInterruption(exception)) showError((exception as Error).message);
      return false;
    } finally { release(); }
  }

  async function changeEpisodeState(action: "reopen" | "annul", reason: string): Promise<boolean> {
    if ((action === "reopen" && (episode.status !== "CLOSED" || !["DOCTOR", "SUPERVISOR"].includes(user.role))) ||
        (action === "annul" && (episode.status !== "ACTIVE" || !["RECEPTION", "SUPERVISOR"].includes(user.role)))) return false;
    const release = operations.start(episodeKey(action));
    if (!release) return false;
    try {
      updateEpisode(await writes.write(`/episodes/${episode.id}/${action}`, {
        method: "POST", body: JSON.stringify({ reason }),
      }, episode.id, episode.clinical_version));
      return true;
    } catch (exception) {
      if (!isSessionInterruption(exception)) showError((exception as Error).message);
      return false;
    } finally { release(); }
  }

  async function registerTriage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isClosed || (user.role !== "NURSE" && user.role !== "SUPERVISOR")) return;
    const form = new FormData(event.currentTarget);
    const release = operations.start(episodeKey("triage"));
    if (!release) return;
    setTriageSaved(false);
    setTriageError("");
    try {
      const completed = await call(`/episodes/${episode.id}/triage`, {
        method: "POST",
        body: JSON.stringify({
          priority: Number(form.get("priority")),
          location: form.get("location"),
          assigned_to: form.get("assigned_to"),
        }),
      }, setTriageError);
      if (completed) setTriageSaved(true);
    } finally {
      release();
    }
  }

  /**
   * Registra la evaluación clínica realizada por el médico.
   *
   * El backend guardará la evaluación como un evento auditable,
   * conservando el usuario, la fecha, el diagnóstico y la decisión.
   */
    async function registerMedicalEvaluation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (user.role !== "DOCTOR" || episode.status !== "ACTIVE") return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const release = operations.start(episodeKey("evaluation"));

    if (!release) return;
    setEvaluationSaved(false);
    setEvaluationError("");
    try {
      const completed = await call(`/episodes/${episode.id}/medical-evaluation`, {
        method: "POST",
        body: JSON.stringify({
          clinical_note: form.get("clinical_note"),
          diagnosis: form.get("diagnosis"),
          disposition: form.get("disposition"),
        }),
      }, setEvaluationError);

      if (completed) {
        formElement.reset();
        onMedicalEvaluationChange?.(false);
        setEvaluationSaved(true);
      }
    } finally {
      release();
    }
  }

  /**
 * Crea una orden clínica y la asigna al servicio seleccionado.
 *
 * En esta etapa el médico puede enviar órdenes a laboratorio,
 * enfermería o al mismo equipo médico. La creación queda auditada
 * mediante un evento TASK_CREATED en el timeline.
 */
async function createClinicalOrder(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();
  if (user.role !== "DOCTOR" || episode.status !== "ACTIVE") return;

  const formElement = event.currentTarget;
  const form = new FormData(formElement);

  const release = operations.start(episodeKey("order"));

  if (!release) return;
  setOrderCreated(false);
  setOrderError("");
  try {
    const completed = await call(`/episodes/${episode.id}/tasks`, {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"),
        service: form.get("service"),
      }),
    }, setOrderError);

    if (completed) {
      formElement.reset();
      onClinicalOrderChange?.(false);
      setOrderCreated(true);
    }
  } finally {
    release();
  }
}

  async function registerVitals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isClosed || (user.role !== "NURSE" && user.role !== "DOCTOR")) return;
    const form = new FormData(event.currentTarget);
    const release = operations.start(episodeKey("vitals"));
    if (!release) return;
    setVitalsSaved(false);
    setVitalsError("");
    try {
      const completed = await call(`/episodes/${episode.id}/vitals`, {
        method: "POST",
        body: JSON.stringify({
          temperature: Number(form.get("temperature")),
          heart_rate: Number(form.get("heart_rate")),
          systolic: Number(form.get("systolic")),
          diastolic: Number(form.get("diastolic")),
          spo2: Number(form.get("spo2")),
          respiratory_rate: Number(form.get("respiratory_rate")),
        }),
      }, setVitalsError);
      if (completed) setVitalsSaved(true);
    } finally {
      release();
    }
  }

  return (
    <main className="container">
      {!versionedWrites && <WriteConflicts writes={writes} onReviewed={updateEpisode} />}
      <div className="page-title">
        <div>
          <h1>{episode.name}</h1>
          <p>
            Episodio EP-{episode.id} · {clinicalLabel("episodeStatus", episode.status)}
          </p>
        </div>

        <span className={`priority p${episode.priority}`}>
          Prioridad {episode.priority}
        </span>
      </div>

      {isClosed && (
        <p role="status" className="panel">
          {episode.status === "ANNULLED" ? "Ingreso anulado; registro conservado para consulta" : "Episodio cerrado; las correcciones se agregan al historial"}
        </p>
      )}

      {episode.status === "CLOSED" && ["DOCTOR", "SUPERVISOR"].includes(user.role) &&
        <section className="panel"><h2>Reabrir alta registrada por error</h2>
          <p>Se conservará el alta original y la reapertura quedará registrada.</p>
          <ReasonActionForm label="Reabrir este episodio" onAction={reason => changeEpisodeState("reopen", reason)} />
        </section>}
      {episode.status === "ACTIVE" && ["RECEPTION", "SUPERVISOR"].includes(user.role) &&
        episode.events.every(item => ["EPISODE_CREATED", "QR_SCANNED", "IDENTITY_VERIFIED"].includes(item.type)) &&
        episode.vitals.length === 0 && episode.tasks.length === 0 && episode.alerts.length === 0 &&
        <section className="panel"><h2>Ingreso creado por error</h2>
          <p>Anula este ingreso sin actividad clínica. La ficha quedará consultable en historial.</p>
          <ReasonActionForm label="Anular ingreso" onAction={reason => changeEpisodeState("annul", reason)} />
        </section>}

      <div className="clinical-grid">
        <section className="panel">
          <h2>Identidad y ubicación</h2>
          <p><strong>Ubicación:</strong> {episode.location}</p>
          <p><strong>Documento:</strong> {episode.document ?? "No registrado"}</p>
          <p><strong>Nacimiento:</strong> {episode.birth_date ?? "No registrado"}</p>
          <p>
            <strong>Asignado:</strong>{" "}
            {episode.assigned_to || "Sin asignar"}
          </p>

          <details>
            <summary>Mostrar pulsera QR</summary>
            <div className="qr">
              <QRCodeSVG value={episode.qr_token} size={160} />
              <code>{episode.qr_token}</code>
            </div>
          </details>
          <WristbandPrint key={`${user.username}:${user.role}:${episode.id}:${episode.status}:${episode.identity_version}:${episode.events.filter(event => event.type === "TRIAGE").map(event => event.id).join(",")}`}
            episode={episode} user={user} />
        </section>

        <PatientIdentity episode={episode} user={user} operations={operations} writes={writes}
          onUpdated={updateEpisode} onSaved={() => onDraftSaved?.("identity")} />
        {!isClosed && (user.role === "NURSE" || user.role === "SUPERVISOR") && (
  <section className="panel triage-panel">
    <h2>Triaje y asignación</h2>

    <p className="section-description">
      Actualiza la prioridad, ubicación y personal responsable.
    </p>

    <form data-draft-kind="triage" data-episode-id={episode.id} data-draft-version={episode.triage_version} className="form-grid" onSubmit={registerTriage} onChange={(event) => {
      const dirty = [...event.currentTarget.elements].some(element => {
        if (element instanceof HTMLSelectElement) return element.value !== ([...element.options].find(option => option.defaultSelected)?.value ?? element.options[0]?.value ?? "");
        return element instanceof HTMLInputElement && element.value.trim() !== element.defaultValue.trim();
      });
      if (dirty) writes.remember(`/episodes/${episode.id}/triage`, episode.triage_version);
      else writes.forget(`/episodes/${episode.id}/triage`);
      setTriageSaved(false);
      setTriageError("");
    }}>
      <label>
        Prioridad
        <select
          disabled={savingTriage}
          name="priority"
          defaultValue={String(episode.priority)}
        >
          <option value="1">P1 · Crítica</option>
          <option value="2">P2 · Alta</option>
          <option value="3">P3 · Media</option>
          <option value="4">P4 · Baja</option>
          <option value="5">P5 · No urgente</option>
        </select>
      </label>

      <label>
        Área o ubicación
        <select
          disabled={savingTriage}
          name="location"
          defaultValue={episode.location}
        >
          <option value="Recepción">Recepción</option>
          <option value="Sala de espera">Sala de espera</option>
          <option value="Triaje">Triaje</option>
          <option value="Observación">Observación</option>
          <option value="Consultorio 1">Consultorio 1</option>
          <option value="Consultorio 2">Consultorio 2</option>
          <option value="Área de choque">Área de choque</option>
          <option value="Laboratorio">Laboratorio</option>
        </select>
      </label>

      <label>
        Personal responsable
        <input
          disabled={savingTriage}
          name="assigned_to"
          defaultValue={episode.assigned_to || ""}
          placeholder="Ejemplo: Enfermería A"
          required
        />
      </label>

      <button type="submit" disabled={savingTriage}>
        {savingTriage ? "Guardando triaje…" : "Guardar triaje y asignación"}
      </button>
      {triageSaved && <p role="status">Triaje y asignación guardados</p>}
      {triageError && <p role="alert">{triageError}</p>}
    </form>
  </section>
)}

        <section className="panel">
          <h2>Signos vitales</h2>

          {latestVitals ? (
            <div className="vital-cards">
              <strong>{latestVitals.spo2}% SpO₂</strong>
              <strong>{latestVitals.heart_rate} lpm</strong>
              <strong>{latestVitals.temperature} °C</strong>
              <strong>
                {latestVitals.systolic}/{latestVitals.diastolic} mmHg
              </strong>
            </div>
          ) : (
            <p>No hay signos registrados.</p>
          )}

          {!isClosed && (user.role === "NURSE" || user.role === "DOCTOR") && (
            <details>
              <summary className="large-button">
                Registrar nuevos signos
              </summary>

              <form data-draft-kind="vitals" data-episode-id={episode.id} className="form-grid" onSubmit={registerVitals} onChange={() => {
                setVitalsSaved(false);
                setVitalsError("");
              }}>
                <label>
                  Temperatura
                  <input
                    disabled={savingVitals}
                    name="temperature"
                    type="number"
                    step="0.1"
                    defaultValue="37"
                  />
                </label>

                <label>
                  Frecuencia cardíaca
                  <input
                    disabled={savingVitals}
                    name="heart_rate"
                    type="number"
                    defaultValue="80"
                  />
                </label>

                <label>
                  Sistólica
                  <input
                    disabled={savingVitals}
                    name="systolic"
                    type="number"
                    defaultValue="120"
                  />
                </label>

                <label>
                  Diastólica
                  <input
                    disabled={savingVitals}
                    name="diastolic"
                    type="number"
                    defaultValue="80"
                  />
                </label>

                <label>
                  SpO₂
                  <input
                    disabled={savingVitals}
                    name="spo2"
                    type="number"
                    defaultValue="98"
                  />
                </label>

                <label>
                  Frecuencia respiratoria
                  <input
                    disabled={savingVitals}
                    name="respiratory_rate"
                    type="number"
                    defaultValue="16"
                  />
                </label>

                <button type="submit" disabled={savingVitals}>
                  {savingVitals ? "Guardando signos…" : "Guardar y evaluar reglas"}
                </button>
                {vitalsSaved && <p role="status">Signos vitales guardados</p>}
                {vitalsError && <p role="alert">{vitalsError}</p>}
              </form>
            </details>
          )}
        </section>

        {user.role === "DOCTOR" && episode.status === "ACTIVE" && (
  <section className="panel medical-panel">
    <div className="section-heading">
      <div>
        <span className="section-icon">⚕</span>

        <div>
          <h2>Evaluación médica</h2>

          <p className="section-description">
            Registra el diagnóstico y la decisión sobre el episodio.
          </p>
        </div>
      </div>

      <span className="role-badge">MÉDICO</span>
    </div>

    <form data-draft-kind="evaluation" data-episode-id={episode.id}
      className="medical-form"
      onSubmit={registerMedicalEvaluation}
      onChange={(event) => {
        setEvaluationSaved(false);
        setEvaluationError("");
        const form = new FormData(event.currentTarget);
        onMedicalEvaluationChange?.(
          Boolean(form.get("diagnosis") || form.get("clinical_note")) ||
          form.get("disposition") !== "CONTINUE_OBSERVATION",
        );
      }}
    >
      <label>
        Diagnóstico o impresión clínica

        <input
          name="diagnosis"
          disabled={savingEvaluation}
          placeholder="Ejemplo: síndrome febril en estudio"
          minLength={2}
          maxLength={500}
          required
        />
      </label>

      <label>
        Nota de evaluación

        <textarea
          name="clinical_note"
          disabled={savingEvaluation}
          placeholder="Describe el estado del paciente y la conducta médica"
          minLength={3}
          maxLength={2000}
          rows={5}
          required
        />
      </label>

      <label>
        Decisión médica

        <select
          name="disposition"
          disabled={savingEvaluation}
          defaultValue="CONTINUE_OBSERVATION"
        >
          <option value="CONTINUE_OBSERVATION">
            {clinicalLabel("disposition", "CONTINUE_OBSERVATION")}
          </option>

          <option value="ORDER_TESTS">
            {clinicalLabel("disposition", "ORDER_TESTS")}
          </option>

          <option value="READY_FOR_DISCHARGE">
            {clinicalLabel("disposition", "READY_FOR_DISCHARGE")}
          </option>
        </select>
      </label>

      <button type="submit" disabled={savingEvaluation}>
        {savingEvaluation ? "Guardando…" : "Guardar evaluación médica"}
      </button>
      {evaluationSaved && <p role="status">Evaluación guardada</p>}
      {evaluationError && <p role="alert">{evaluationError}</p>}
    </form>
  </section>
)}

{user.role === "DOCTOR" && episode.status === "ACTIVE" && (
  <section className="panel order-panel">
    <div className="section-heading">
      <div>
        <span className="section-icon order-icon">＋</span>

        <div>
          <h2>Nueva orden clínica</h2>

          <p className="section-description">
            Crea una tarea y asígnala al servicio responsable.
          </p>
        </div>
      </div>

      <span className="role-badge">ORDEN MÉDICA</span>
    </div>

    <form data-draft-kind="order" data-episode-id={episode.id}
      className="medical-form"
      onSubmit={createClinicalOrder}
      onChange={(event) => {
        setOrderCreated(false);
        setOrderError("");
        const form = new FormData(event.currentTarget);
        onClinicalOrderChange?.(
          Boolean(form.get("title")) || form.get("service") !== "LAB",
        );
      }}
    >
      <label>
        Orden o procedimiento solicitado

        <input
          name="title" disabled={creatingOrder}
          placeholder="Ejemplo: hemograma completo"
          minLength={3}
          maxLength={300}
          required
        />
      </label>

      <label>
        Servicio responsable

        <select name="service" disabled={creatingOrder} defaultValue="LAB">
          <option value="LAB">{clinicalLabel("service", "LAB")}</option>
          <option value="NURSING">{clinicalLabel("service", "NURSING")}</option>
          <option value="MEDICAL">{clinicalLabel("service", "MEDICAL")}</option>
        </select>
      </label>

      <button type="submit" disabled={creatingOrder}>
        {creatingOrder ? "Creando orden…" : "Crear y asignar orden"}
      </button>
      {orderCreated && <p role="status">Orden creada</p>}
      {orderError && <p role="alert">{orderError}</p>}
    </form>
  </section>
)}
       <section className="panel alerts">
  <h2>
    Alertas activas{" "}
    <mark>
      {
        episode.alerts.filter(
          (alert) => alert.status !== "RESOLVED",
        ).length
      }
    </mark>
  </h2>

  {episode.alerts.filter(
    (alert) => alert.status !== "RESOLVED",
  ).length === 0 && <p>Sin alertas activas ✓</p>}

  {episode.alerts
    .filter((alert) => alert.status !== "RESOLVED")
    .map((alert) => (
      <article key={alert.id}>
        <strong>
          {clinicalLabel("severity", alert.severity)} · {alert.reason}
        </strong>

        <span>{clinicalLabel("alertStatus", alert.status)}</span>

        <div>
          {!isClosed && alert.status === "ACTIVE" &&
            (user.role === "NURSE" ||
              user.role === "DOCTOR" ||
              user.role === "SUPERVISOR") && (
              <button
                disabled={operations.isPending(`alert:${alert.id}`)}
                onClick={() => updateAlert(alert.id, "ACKNOWLEDGED")}
              >
                Reconocer
              </button>
            )}

          {!isClosed && (alert.status === "ACTIVE" ||
            alert.status === "ACKNOWLEDGED") &&
            (user.role === "NURSE" ||
              user.role === "DOCTOR" ||
              user.role === "SUPERVISOR") && (
              <button
                disabled={operations.isPending(`alert:${alert.id}`)}
                onClick={() => updateAlert(alert.id, "ESCALATED")}
              >
                Escalar
              </button>
            )}

{!isClosed && (alert.status === "ACKNOWLEDGED" ||
  alert.status === "ESCALATED") &&
  (user.role === "DOCTOR" ||
    user.role === "SUPERVISOR") && (
    <button
      disabled={operations.isPending(`alert:${alert.id}`)}
                onClick={() => updateAlert(alert.id, "RESOLVED")}
    >
      Resolver
    </button>
  )}
        </div>

        {operations.isPending(`alert:${alert.id}`) && <p role="status">Actualizando alerta…</p>}
        {alertErrors[alert.id] && <p role="alert">{alertErrors[alert.id]}</p>}

        <details className="alert-history">
          <summary>
            Ver historial ({(alert.history ?? []).length})
          </summary>

          {(alert.history ?? []).length === 0 ? (
            <p>Esta alerta todavía no tiene cambios de estado.</p>
          ) : (
            <ol>
              {(alert.history ?? []).map(
                (
                  transition: AlertHistoryEntry,
                  index: number,
                ) => {
                  const transitionDate =
                    transition.created_at ?? transition.at;

                  return (
                    <li
                      key={
                        transition.id ??
                        `${alert.id}-${index}`
                      }
                    >
                      <strong>
                        {clinicalLabel("alertStatus", transition.old_status ?? "CREATED")} →{" "}
                        {clinicalLabel("alertStatus", transition.new_status)}
                      </strong>

                      <small>
                        {transition.username}
                        {" · "}
                        {transitionDate
                          ? new Date(
                              transitionDate,
                            ).toLocaleString()
                          : "Fecha no disponible"}
                      </small>
                    </li>
                  );
                },
              )}
            </ol>
          )}
        </details>
      </article>
    ))}

  {episode.alerts.some(
    (alert) => alert.status === "RESOLVED",
  ) && (
    <details className="resolved-alerts">
      <summary>
        Alertas resueltas (
        {
          episode.alerts.filter(
            (alert) => alert.status === "RESOLVED",
          ).length
        }
        )
      </summary>

      {episode.alerts
        .filter((alert) => alert.status === "RESOLVED")
        .map((alert) => (
          <article
            key={alert.id}
            className="resolved-alert"
          >
            <strong>
              {clinicalLabel("severity", alert.severity)} · {alert.reason}
            </strong>

            <span>{clinicalLabel("alertStatus", alert.status)}</span>

            <details className="alert-history">
              <summary>
                Ver historial (
                {(alert.history ?? []).length})
              </summary>

              {(alert.history ?? []).length === 0 ? (
                <p>
                  Esta alerta no tiene cambios registrados.
                </p>
              ) : (
                <ol>
                  {(alert.history ?? []).map(
                    (
                      transition: AlertHistoryEntry,
                      index: number,
                    ) => {
                      const transitionDate =
                        transition.created_at ??
                        transition.at;

                      return (
                        <li
                          key={
                            transition.id ??
                            `${alert.id}-${index}`
                          }
                        >
                          <strong>
                            {clinicalLabel("alertStatus", transition.old_status ?? "CREATED")}{" "}
                            → {clinicalLabel("alertStatus", transition.new_status)}
                          </strong>

                          <small>
                            {transition.username}
                            {" · "}
                            {transitionDate
                              ? new Date(
                                  transitionDate,
                                ).toLocaleString()
                              : "Fecha no disponible"}
                          </small>
                        </li>
                      );
                    },
                  )}
                </ol>
              )}
            </details>
          </article>
        ))}
    </details>
  )}
</section>

        <section className="panel">
          <h2>Órdenes y tareas del episodio</h2>

          {episode.tasks
            .map((task) => (
              <article className="task" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <small>{clinicalLabel("service", task.service)}</small>
                  <small>#{task.id} · {clinicalLabel("taskStatus", task.status)}</small>
                  {task.status !== "PENDING" && <p>Resultado: {task.status === "ANNULLED" ? "Publicación anulada" : task.result || "Sin resultado"}</p>}
                </div>

                {!isClosed && task.status === "PENDING" && (task.service === "LAB" ? (
                  user.role === "LAB" || user.role === "SUPERVISOR" ? (
                    <button disabled={!onOpenLaboratory} onClick={onOpenLaboratory}>
                      {user.role === "LAB" ? "Registrar resultado en laboratorio" : "Consultar laboratorio"}
                    </button>
                  ) : <p>Laboratorio debe registrar el resultado desde su bandeja.</p>
                ) : (
                  <button
                    disabled={operations.isPending(`task:${task.id}`)}
                    onClick={() => completeTask(task.id)}
                  >
                    {operations.isPending(`task:${task.id}`) ? "Completando…" : "Completar"}
                  </button>
                ))}
                {taskErrors[task.id] && <p role="alert">{taskErrors[task.id]}</p>}
              </article>
            ))}
        </section>

        <section className="panel timeline">
          <h2>Línea de tiempo auditable</h2>

          {episode.events.map((event) => (
            <article key={event.id}>
              <strong>{clinicalLabel("eventType", event.type)}</strong>
              <p>{event.annulled ? "Nota anulada" : event.current_note ?? event.note}</p>
              {(event.annulled || (event.current_note !== undefined && event.current_note !== event.note)) && <details><summary>Ver texto original</summary><p>{event.note}</p></details>}
              <small>
                {new Date(event.created_at).toLocaleString()} ·{" "}
                {event.username}
              </small>
              {["MEDICAL_EVALUATION", "DISCHARGE"].includes(event.type) && !event.annulled && user.role === "DOCTOR" &&
                <RecordCorrectionForm label={event.type === "DISCHARGE" ? "Texto corregido del alta" : "Texto corregido de la evaluación"} onAction={(action, reason, value) => changeNote(event.id, action, reason, value)} />}
            </article>
          ))}
        </section>

        {(episode.record_changes ?? []).length > 0 && <section className="panel">
          <h2>Historial de correcciones</h2>
          {(episode.record_changes ?? []).map(change => <article key={change.id}>
            <strong>{clinicalLabel("recordTarget", change.target_type)} #{change.target_id} · {clinicalLabel("changeAction", change.action)}</strong>
            <p>Motivo: {change.reason}</p>
            <p>Anterior: {change.target_type === "EPISODE" && change.old_value !== null ? clinicalLabel("episodeStatus", change.old_value) : change.old_value ?? "Sin texto"}</p>
            <p>Nuevo: {change.target_type === "EPISODE" && change.new_value !== null ? clinicalLabel("episodeStatus", change.new_value) : change.new_value ?? "Sin texto vigente"}</p>
            <small>{change.username} · {new Date(change.created_at).toLocaleString()}</small>
          </article>)}
        </section>}
      </div>

      {user.role === "DOCTOR" && episode.status === "ACTIVE" && (
        <form data-draft-kind="discharge" data-episode-id={episode.id} className="panel medical-form" onSubmit={dischargeEpisode} noValidate>
          <label htmlFor="discharge-note">Nota de alta</label>
          <textarea
            id="discharge-note"
            name="note"
            value={dischargeNote}
            onChange={(event) => {
              setDischargeNote(event.target.value);
              if (event.target.value.trim()) writes.remember(`/episodes/${episode.id}/discharge`, episode.clinical_version);
              else writes.forget(`/episodes/${episode.id}/discharge`);
              onDischargeNoteChange?.(event.target.value);
            }}
            required
            rows={4}
            disabled={discharging}
            aria-describedby={dischargeError ? "discharge-error" : undefined}
          />
          {dischargeError && <p id="discharge-error" role="alert">{dischargeError}</p>}
          <button type="submit" className="discharge" disabled={discharging}>
            {discharging ? "Cerrando episodio…" : "Cerrar episodio · Alta médica"}
          </button>
        </form>
      )}
    </main>
  );
}
