import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, isSessionInterruption } from "../api/client";
import type { AlertHistoryEntry, Episode, User } from "../types/clinical";

type EpisodePageProps = {
  episode: Episode;
  user: User;
  updateEpisode: (episode: Episode) => void;
  showError: (message: string) => void;
  initialDischargeNote?: string;
  onDischargeNoteChange?: (note: string) => void;
};

export default function EpisodePage({
  episode,
  user,
  updateEpisode,
  showError,
  initialDischargeNote = "",
  onDischargeNoteChange,
}: EpisodePageProps) {
  const isClosed = episode.status === "CLOSED";
  const latestVitals = episode.vitals[0];
  const [dischargeNote, setDischargeNote] = useState(initialDischargeNote);
  const [dischargeError, setDischargeError] = useState("");
  const [discharging, setDischarging] = useState(false);
  const dischargeInFlight = useRef(false);

  async function dischargeEpisode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dischargeInFlight.current || user.role !== "DOCTOR" || episode.status !== "ACTIVE") return;
    const note = dischargeNote.trim();
    if (!note) {
      setDischargeError("Escribe una nota de alta antes de cerrar el episodio.");
      return;
    }
    dischargeInFlight.current = true;
    setDischarging(true);
    setDischargeError("");
    try {
      updateEpisode(await api<Episode>(`/episodes/${episode.id}/discharge`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }));
    } catch (exception) {
      if (isSessionInterruption(exception)) return;
      setDischargeError((exception as Error).message);
    } finally {
      dischargeInFlight.current = false;
      setDischarging(false);
    }
  }

  async function call(path: string, options: RequestInit) {
    try {
      updateEpisode(await api<Episode>(path, options));
    } catch (exception) {
      if (isSessionInterruption(exception)) return false;
      showError((exception as Error).message);
    }
    return true;
  }

  async function registerTriage(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  await call(`/episodes/${episode.id}/triage`, {
    method: "POST",
    body: JSON.stringify({
      priority: Number(form.get("priority")),
      location: form.get("location"),
      assigned_to: form.get("assigned_to"),
    }),
  });
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

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const completed = await call(`/episodes/${episode.id}/medical-evaluation`, {
      method: "POST",
      body: JSON.stringify({
        clinical_note: form.get("clinical_note"),
        diagnosis: form.get("diagnosis"),
        disposition: form.get("disposition"),
      }),
    });

    if (completed) formElement.reset();
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

  const formElement = event.currentTarget;
  const form = new FormData(formElement);

  const completed = await call(`/episodes/${episode.id}/tasks`, {
    method: "POST",
    body: JSON.stringify({
      title: form.get("title"),
      service: form.get("service"),
    }),
  });

  if (completed) formElement.reset();
}

  async function registerVitals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await call(`/episodes/${episode.id}/vitals`, {
      method: "POST",
      body: JSON.stringify({
        temperature: Number(form.get("temperature")),
        heart_rate: Number(form.get("heart_rate")),
        systolic: Number(form.get("systolic")),
        diastolic: Number(form.get("diastolic")),
        spo2: Number(form.get("spo2")),
        respiratory_rate: Number(form.get("respiratory_rate")),
      }),
    });
  }

  return (
    <main className="container">
      <div className="page-title">
        <div>
          <h1>{episode.name}</h1>
          <p>
            Episodio EP-{episode.id} · {episode.status}
          </p>
        </div>

        <span className={`priority p${episode.priority}`}>
          Prioridad {episode.priority}
        </span>
      </div>

      {isClosed && (
        <p role="status" className="panel">
          Episodio cerrado — solo lectura
        </p>
      )}

      <div className="clinical-grid">
        <section className="panel">
          <h2>Identidad y ubicación</h2>
          <p><strong>Ubicación:</strong> {episode.location}</p>
          <p><strong>Documento:</strong> {episode.document}</p>
          <p><strong>Nacimiento:</strong> {episode.birth_date}</p>
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
        </section>

        {!isClosed && (user.role === "NURSE" || user.role === "SUPERVISOR") && (
  <section className="panel triage-panel">
    <h2>Triaje y asignación</h2>

    <p className="section-description">
      Actualiza la prioridad, ubicación y personal responsable.
    </p>

    <form className="form-grid" onSubmit={registerTriage}>
      <label>
        Prioridad
        <select
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
          name="assigned_to"
          defaultValue={episode.assigned_to || ""}
          placeholder="Ejemplo: Enfermería A"
          required
        />
      </label>

      <button type="submit">
        Guardar triaje y asignación
      </button>
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

              <form className="form-grid" onSubmit={registerVitals}>
                <label>
                  Temperatura
                  <input
                    name="temperature"
                    type="number"
                    step="0.1"
                    defaultValue="37"
                  />
                </label>

                <label>
                  Frecuencia cardíaca
                  <input
                    name="heart_rate"
                    type="number"
                    defaultValue="80"
                  />
                </label>

                <label>
                  Sistólica
                  <input
                    name="systolic"
                    type="number"
                    defaultValue="120"
                  />
                </label>

                <label>
                  Diastólica
                  <input
                    name="diastolic"
                    type="number"
                    defaultValue="80"
                  />
                </label>

                <label>
                  SpO₂
                  <input
                    name="spo2"
                    type="number"
                    defaultValue="98"
                  />
                </label>

                <label>
                  Frecuencia respiratoria
                  <input
                    name="respiratory_rate"
                    type="number"
                    defaultValue="16"
                  />
                </label>

                <button type="submit">
                  Guardar y evaluar reglas
                </button>
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

    <form
      className="medical-form"
      onSubmit={registerMedicalEvaluation}
    >
      <label>
        Diagnóstico o impresión clínica

        <input
          name="diagnosis"
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
          defaultValue="CONTINUE_OBSERVATION"
        >
          <option value="CONTINUE_OBSERVATION">
            Continuar en observación
          </option>

          <option value="ORDER_TESTS">
            Solicitar pruebas u órdenes
          </option>

          <option value="READY_FOR_DISCHARGE">
            Preparar para alta
          </option>
        </select>
      </label>

      <button type="submit">
        Guardar evaluación médica
      </button>
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

    <form
      className="medical-form"
      onSubmit={createClinicalOrder}
    >
      <label>
        Orden o procedimiento solicitado

        <input
          name="title"
          placeholder="Ejemplo: hemograma completo"
          minLength={3}
          maxLength={300}
          required
        />
      </label>

      <label>
        Servicio responsable

        <select name="service" defaultValue="LAB">
          <option value="LAB">Laboratorio</option>
          <option value="NURSING">Enfermería</option>
          <option value="MEDICAL">Equipo médico</option>
        </select>
      </label>

      <button type="submit">
        Crear y asignar orden
      </button>
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
          {alert.severity} · {alert.reason}
        </strong>

        <span>{alert.status}</span>

        <div>
          {!isClosed && alert.status === "ACTIVE" &&
            (user.role === "NURSE" ||
              user.role === "DOCTOR" ||
              user.role === "SUPERVISOR") && (
              <button
                onClick={() =>
                  call(`/alerts/${alert.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      status: "ACKNOWLEDGED",
                    }),
                  })
                }
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
                onClick={() =>
                  call(`/alerts/${alert.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      status: "ESCALATED",
                    }),
                  })
                }
              >
                Escalar
              </button>
            )}

{!isClosed && (alert.status === "ACKNOWLEDGED" ||
  alert.status === "ESCALATED") &&
  (user.role === "DOCTOR" ||
    user.role === "SUPERVISOR") && (
    <button
      onClick={() =>
        call(`/alerts/${alert.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "RESOLVED",
          }),
        })
      }
    >
      Resolver
    </button>
  )}
        </div>

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
                        {transition.old_status ?? "CREATED"} →{" "}
                        {transition.new_status}
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
              {alert.severity} · {alert.reason}
            </strong>

            <span>{alert.status}</span>

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
                            {transition.old_status ??
                              "CREATED"}{" "}
                            → {transition.new_status}
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
          <h2>Tareas pendientes</h2>

          {episode.tasks
            .filter((task) => task.status === "PENDING")
            .map((task) => (
              <article className="task" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <small>{task.service}</small>
                </div>

                {!isClosed && (
                <button
                  onClick={() =>
                    call(`/tasks/${task.id}/complete`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        result: "Completada sin novedades",
                      }),
                    })
                  }
                >
                  Completar
                </button>
                )}
              </article>
            ))}
        </section>

        <section className="panel timeline">
          <h2>Línea de tiempo auditable</h2>

          {episode.events.map((event) => (
            <article key={event.id}>
              <strong>{event.type.replaceAll("_", " ")}</strong>
              <p>{event.note}</p>
              <small>
                {new Date(event.created_at).toLocaleString()} ·{" "}
                {event.username}
              </small>
            </article>
          ))}
        </section>
      </div>

      {user.role === "DOCTOR" && episode.status === "ACTIVE" && (
        <form className="panel medical-form" onSubmit={dischargeEpisode} noValidate>
          <label htmlFor="discharge-note">Nota de alta</label>
          <textarea
            id="discharge-note"
            value={dischargeNote}
            onChange={(event) => {
              setDischargeNote(event.target.value);
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
