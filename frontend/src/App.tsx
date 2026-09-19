import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";

const API = "http://localhost:8000";

type User = {
  username: string;
  role: string;
  access_token: string;
};

type Episode = {
  id: number;
  name: string;
  birth_date: string;
  document: string;
  qr_token: string;
  status: string;
  priority: number;
  location: string;
  assigned_to?: string;
  vitals: Record<string, any>[];
  alerts: Record<string, any>[];
  tasks: Record<string, any>[];
  events: Record<string, any>[];
};

async function api(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const result = await response.json();

  /*
   * Si el backend rechaza un token que existía previamente,
   * la sesión expiró o el servidor fue reiniciado.
   *
   * Se elimina el token y se notifica al componente principal
   * para regresar de forma segura a la pantalla de login.
   */
  if (
    response.status === 401 &&
    token &&
    path !== "/auth/login"
  ) {
    /*
     * El backend dejó de reconocer el token.
     * Se elimina la sesión local y se recarga la aplicación.
     */
    localStorage.removeItem("token");

    window.alert(
      "Tu sesión expiró. Inicia sesión nuevamente.",
    );

    window.location.reload();

    throw new Error(
      "Tu sesión expiró. Inicia sesión nuevamente.",
    );
  }

  if (!response.ok) {
    throw new Error(result.detail || "Ocurrió un error");
  }

  return result;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState("dashboard");
  const [dashboard, setDashboard] = useState<any>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [laboratoryQueue, setLaboratoryQueue] = useState<any>(null);
  const [supervisorData, setSupervisorData] = useState<any>(null);
  const [supervisorFilter, setSupervisorFilter] = useState("ALL");
  const [historyData, setHistoryData] = useState<any>(null);
  const [error, setError] = useState("");
  const [restoringSession, setRestoringSession] =
  useState(true);

  async function loadDashboard() {
    try {
      setDashboard(await api("/dashboard"));
    } catch (exception) {
      setError((exception as Error).message);
    }
  }

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user]);

  useEffect(() => {
  const storedToken = localStorage.getItem("token");

  if (!storedToken) {
    setRestoringSession(false);
    return;
  }

  api("/auth/me")
    .then((session) => {
      setUser({
        username: session.username,
        role: session.role,
        access_token: storedToken,
      });
    })
    .catch(() => {
      localStorage.removeItem("token");
      setUser(null);
    })
    .finally(() => {
      setRestoringSession(false);
    });
}, []);



  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });

      localStorage.setItem("token", result.access_token);
      setUser(result);
    } catch (exception) {
      setError((exception as Error).message);
    }
  }

  async function createEpisode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    try {
      const result = await api("/episodes", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          birth_date: form.get("birth_date"),
          document: form.get("document"),
          priority: Number(form.get("priority")),
          location: form.get("location"),
        }),
      });

      setEpisode(result);
      setPage("episode");
      loadDashboard();
    } catch (exception) {
      setError((exception as Error).message);
    }
  }

  async function openEpisode(id: number) {
    try {
      setEpisode(await api(`/episodes/${id}`));
      setPage("episode");
    } catch (exception) {
      setError((exception as Error).message);
    }
  }

  async function scanEpisode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = new FormData(event.currentTarget).get("token");

    try {
      setEpisode(await api(`/scan/${token}`));
      setPage("episode");
    } catch (exception) {
      setError((exception as Error).message);
    }
  }

  /**
 * Solicita al backend la creación de los pacientes ficticios.
 *
 * El endpoint es aditivo e idempotente:
 * - conserva pacientes existentes;
 * - crea los doce pacientes demo una sola vez;
 * - no duplica datos en ejecuciones posteriores.
 */
async function loadDemoData() {
  const confirmed = window.confirm(
    "Se agregarán 12 pacientes ficticios sin borrar los datos actuales. " +
      "¿Deseas continuar?",
  );

  if (!confirmed) {
    return;
  }

  try {
    const result = await api("/demo/seed", {
      method: "POST",
    });

    window.alert(result.message);

    await openSupervisorDashboard();
    await loadDashboard();
  } catch (exception) {
    setError((exception as Error).message);
  }
}

/**
 * Carga episodios cerrados sin mezclarlos con la operación activa.
 *
 * El historial es de consulta y no reactiva episodios dados de alta.
 */
async function openEpisodeHistory() {
  try {
    const result = await api("/episodes/history");

    setHistoryData(result);
    setPage("history");
  } catch (exception) {
    setError((exception as Error).message);
  }
}

  /**
 * Carga el centro de control exclusivo del supervisor.
 *
 * Los indicadores se calculan en el backend para mantener una lectura
 * operacional consistente de pacientes, riesgos, alertas y tareas.
 */
async function openSupervisorDashboard() {
  try {
    const result = await api("/supervisor/dashboard");

    setSupervisorData(result);
    setSupervisorFilter("ALL");
    setPage("supervisor");
  } catch (exception) {
    setError((exception as Error).message);
  }
}

  /**
 * Abre la bandeja de laboratorio y carga las órdenes pendientes.
 */
async function openLaboratoryQueue() {
  try {
    const result = await api("/lab/orders?status=PENDING");

    setLaboratoryQueue(result);
    setPage("laboratory");
  } catch (exception) {
    setError((exception as Error).message);
  }
}

/**
 * Publica el resultado de una orden de laboratorio.
 * Al finalizar, vuelve a consultar la bandeja para retirar la orden completada.
 */
async function completeLaboratoryOrder(
  event: FormEvent<HTMLFormElement>,
  taskId: number,
) {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  try {
    await api(`/tasks/${taskId}/complete`, {
      method: "PATCH",
      body: JSON.stringify({
        result: form.get("result"),
      }),
    });

    await openLaboratoryQueue();
  } catch (exception) {
    setError((exception as Error).message);
  }
}

async function logout() {
  try {
    await api("/auth/logout", {
      method: "POST",
    });
  } catch (exception) {
    console.warn(
      "No fue posible cerrar la sesión en el servidor.",
      exception,
    );
  } finally {
    localStorage.removeItem("token");
    setUser(null);
    setEpisode(null);
    setDashboard(null);
    setLaboratoryQueue(null);
    setSupervisorData(null);
    setHistoryData(null);
    setPage("dashboard");
    setError("");
  }
}

if (restoringSession) {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="logo">✚ MedicControl+</div>
        <h1>Restaurando sesión</h1>
        <p>Validando el acceso guardado...</p>
      </section>
    </main>
  );
}

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="logo">✚ MedicControl+</div>
          <h1>Seguimiento clínico</h1>
          <p>Acceso al episodio activo del paciente</p>

          <form onSubmit={login}>
            <label>
              Usuario
              <select name="username">
                <option value="recepcion">Recepción</option>
                <option value="enfermeria">Enfermería</option>
                <option value="medico">Médico</option>
                <option value="laboratorio">Laboratorio</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </label>

            <label>
              Contraseña
              <input
                name="password"
                type="password"
                defaultValue="demo123"
              />
            </label>

            <button type="submit">Entrar</button>
          </form>

          {error && <p className="error">{error}</p>}
          <small>Contraseña de demostración: demo123</small>
        </section>
      </main>
    );
  }

  return (
    <>
      <header className="header">
        <div className="logo">✚ MedicControl+</div>

        <nav>
          <button
            onClick={() => {
              setPage("dashboard");
              loadDashboard();
            }}
          >
            Centro de control
          </button>

          {user.role === "SUPERVISOR" && (
        <button onClick={openSupervisorDashboard}>
          Panel de supervisor
        </button>
          )}

          <button onClick={() => setPage("scan")}>
            Escanear pulsera
          </button>

          {(
  user.role === "RECEPTION" ||
  user.role === "DOCTOR" ||
  user.role === "SUPERVISOR"
) && (
  <button onClick={openEpisodeHistory}>
    Historial de episodios
  </button>
)}

          {(user.role === "LAB" || user.role === "SUPERVISOR") && (
          <button onClick={openLaboratoryQueue}>
          Bandeja de laboratorio
        </button>
          )}

          {user.role === "RECEPTION" && (
            <button onClick={() => setPage("new")}>
              Nuevo ingreso
            </button>
          )}
        </nav>

        <div className="user">
          <strong>{user.username}</strong>
          <span>{user.role}</span>
          <button onClick={logout}>Salir</button>
        </div>
      </header>

      {error && (
        <div className="error-banner" onClick={() => setError("")}>
          {error} ×
        </div>
      )}

      {page === "dashboard" && dashboard && (
        <main className="container">
          <div className="page-title">
            <div>
              <span>OPERACIÓN EN TIEMPO REAL</span>
              <h1>Centro de control</h1>
            </div>

            <button onClick={loadDashboard}>Actualizar</button>
          </div>

          <section className="stats">
            <article>
              <strong>{dashboard.active}</strong>
              <span>Pacientes activos</span>
            </article>

            <article className="danger">
              <strong>{dashboard.open_alerts}</strong>
              <span>Alertas abiertas</span>
            </article>

            <article>
              <strong>
                {
                  dashboard.patients.filter(
                    (patient: Episode) => patient.priority <= 2,
                  ).length
                }
              </strong>
              <span>Alta prioridad</span>
            </article>

            <article>
              <strong>
                {dashboard.patients.reduce(
                  (total: number, patient: Episode) =>
                    total +
                    patient.tasks.filter(
                      (task) => task.status === "PENDING",
                    ).length,
                  0,
                )}
              </strong>
              <span>Tareas pendientes</span>
            </article>
          </section>

          <section className="panel">
            <h2>Pacientes activos</h2>

            {dashboard.patients.length === 0 ? (
              <p>No hay pacientes activos.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Prioridad</th>
                    <th>Ubicación</th>
                    <th>Alertas</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {dashboard.patients.map((patient: Episode) => (
                    <tr key={patient.id}>
                      <td>
                        <strong>{patient.name}</strong>
                        <small>EP-{patient.id}</small>
                      </td>
                      <td>
                        <span className={`priority p${patient.priority}`}>
                          P{patient.priority}
                        </span>
                      </td>
                      <td>{patient.location}</td>
                      <td>
                        {
                          patient.alerts.filter(
                            (alert) => alert.status !== "RESOLVED",
                          ).length
                        }
                      </td>
                      <td>
                        <button onClick={() => openEpisode(patient.id)}>
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </main>
      )}

      {page === "new" && (
        <main className="container narrow">
          <section className="panel">
            <h1>Registrar llegada</h1>

            <form className="form-grid" onSubmit={createEpisode}>
              <label>
                Nombre completo
                <input name="name" required />
              </label>

              <label>
                Fecha de nacimiento
                <input name="birth_date" type="date" required />
              </label>

              <label>
                Documento
                <input name="document" required />
              </label>

              <label>
                Prioridad inicial
                <select name="priority" defaultValue="3">
                  <option value="1">P1 · Crítica</option>
                  <option value="2">P2 · Alta</option>
                  <option value="3">P3 · Media</option>
                  <option value="4">P4 · Baja</option>
                  <option value="5">P5 · No urgente</option>
                </select>
              </label>

              <label>
                Ubicación
                <input name="location" defaultValue="Recepción" />
              </label>

              <button type="submit">
                Crear episodio y pulsera
              </button>
            </form>
          </section>
        </main>
      )}

      {page === "scan" && (
        <main className="container narrow">
          <section className="panel scan-panel">
            <h1>Escanear pulsera</h1>
            <p>Pega el token seguro impreso bajo el QR.</p>

            <form onSubmit={scanEpisode}>
              <input
                name="token"
                placeholder="Token de la pulsera"
                required
              />
              <button type="submit">Identificar paciente</button>
            </form>
          </section>
        </main>
      )}

      {page === "history" && historyData && (
  <main className="container">
    <div className="page-title">
      <div>
        <span>CONSULTA HISTÓRICA</span>
        <h1>Episodios cerrados</h1>
        <p>
          Pacientes dados de alta y episodios finalizados.
        </p>
      </div>

      <button onClick={openEpisodeHistory}>
        Actualizar historial
      </button>
    </div>

    <section className="history-summary">
      <article>
        <strong>{historyData.total}</strong>
        <span>Episodios cerrados</span>
      </article>
    </section>

    <section className="panel history-table">
      {historyData.episodes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✓</div>
          <h2>No existen episodios cerrados</h2>
          <p>
            Los pacientes dados de alta aparecerán aquí.
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Documento</th>
              <th>Prioridad</th>
              <th>Ubicación final</th>
              <th>Responsable</th>
              <th>Fecha de cierre</th>
              <th>Actividad</th>
              <th>Acción</th>
            </tr>
          </thead>

          <tbody>
            {historyData.episodes.map((closedEpisode: any) => (
              <tr key={closedEpisode.id}>
                <td>
                  <strong>{closedEpisode.name}</strong>
                  <small>EP-{closedEpisode.id}</small>
                </td>

                <td>{closedEpisode.document}</td>

                <td>
                  <span
                    className={`priority p${closedEpisode.priority}`}
                  >
                    P{closedEpisode.priority}
                  </span>
                </td>

                <td>{closedEpisode.location}</td>

                <td>
                  {closedEpisode.assigned_to || "Sin asignar"}
                </td>

                <td>
                  {closedEpisode.closed_at
                    ? new Date(
                        closedEpisode.closed_at,
                      ).toLocaleString()
                    : "Sin fecha"}
                </td>

                <td>
                  <div className="history-counts">
                    <span>
                      {closedEpisode.event_count} eventos
                    </span>

                    <span>
                      {closedEpisode.alert_count} alertas
                    </span>

                    <span>
                      {closedEpisode.task_count} tareas
                    </span>
                  </div>
                </td>

                <td>
                  <button
                    onClick={() => openEpisode(closedEpisode.id)}
                  >
                    Ver timeline
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  </main>
)}

      {page === "supervisor" && supervisorData && (
  <main className="container">
    <div className="page-title">
      <div>
        <span>SUPERVISIÓN OPERACIONAL</span>
        <h1>Centro de control del supervisor</h1>
        <p>
          Prioridades, riesgos, alertas y carga asistencial.
        </p>
      </div>

<div className="page-actions">
  <button
    className="secondary-button"
    onClick={loadDemoData}
  >
    Cargar datos de demostración
  </button>

  <button onClick={openSupervisorDashboard}>
    Actualizar indicadores
  </button>
</div>
    </div>

      <section className="rules-status">
  <div>
    <span className="rules-icon">⚙</span>

    <div>
      <strong>Motor de reglas actualizado</strong>
      <p>
        Se evaluaron{" "}
        {supervisorData.rules.evaluated_episodes} episodios activos.
      </p>
    </div>
  </div>

  <div className="rules-result">
    <strong>{supervisorData.rules.generated_alerts}</strong>
    <span>Nuevas alertas generadas</span>
  </div>
</section>

    <section className="supervisor-stats">
      <article>
        <strong>
          {supervisorData.metrics.active_patients}
        </strong>
        <span>Pacientes activos</span>
      </article>

      <article className="warning-stat">
        <strong>
          {supervisorData.metrics.high_priority_patients}
        </strong>
        <span>Prioridad P1–P2</span>
      </article>

      <article className="danger-stat">
        <strong>
          {supervisorData.metrics.patients_at_risk}
        </strong>
        <span>Pacientes en riesgo</span>
      </article>

      <article className="danger-stat">
        <strong>
          {supervisorData.metrics.open_alerts}
        </strong>
        <span>Alertas abiertas</span>
      </article>

      <article>
        <strong>
          {supervisorData.metrics.pending_tasks}
        </strong>
        <span>Tareas pendientes</span>
      </article>
    </section>

    <section className="panel supervisor-table">
      <div className="supervisor-toolbar">
        <div>
          <h2>Seguimiento de pacientes</h2>
          <p>
            Filtra la operación para localizar situaciones prioritarias.
          </p>
        </div>

        <div className="filter-buttons">
          <button
            className={
              supervisorFilter === "ALL" ? "active-filter" : ""
            }
            onClick={() => setSupervisorFilter("ALL")}
          >
            Todos
          </button>

          <button
            className={
              supervisorFilter === "RISK" ? "active-filter" : ""
            }
            onClick={() => setSupervisorFilter("RISK")}
          >
            En riesgo
          </button>

          <button
            className={
              supervisorFilter === "HIGH" ? "active-filter" : ""
            }
            onClick={() => setSupervisorFilter("HIGH")}
          >
            P1–P2
          </button>

          <button
            className={
              supervisorFilter === "ALERTS" ? "active-filter" : ""
            }
            onClick={() => setSupervisorFilter("ALERTS")}
          >
            Con alertas
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Prioridad</th>
            <th>Ubicación</th>
            <th>Espera</th>
            <th>Alertas</th>
            <th>Tareas</th>
            <th>Riesgo</th>
            <th>Acción</th>
          </tr>
        </thead>

        <tbody>
          {supervisorData.patients
            .filter((patient: any) => {
              if (supervisorFilter === "RISK") {
                return patient.at_risk;
              }

              if (supervisorFilter === "HIGH") {
                return patient.priority <= 2;
              }

              if (supervisorFilter === "ALERTS") {
                return patient.open_alert_count > 0;
              }

              return true;
            })
            .map((patient: any) => (
              <tr key={patient.id}>
                <td>
                  <strong>{patient.name}</strong>
                  <small>EP-{patient.id}</small>
                </td>

                <td>
                  <span className={`priority p${patient.priority}`}>
                    P{patient.priority}
                  </span>
                </td>

                <td>{patient.location}</td>

                <td>
                  {patient.waiting_minutes} min
                </td>

                <td>
                  <span
                    className={
                      patient.open_alert_count > 0
                        ? "count-badge danger-count"
                        : "count-badge"
                    }
                  >
                    {patient.open_alert_count}
                  </span>
                </td>

                <td>
                  <span className="count-badge">
                    {patient.pending_task_count}
                  </span>
                </td>

                <td>
                  {patient.at_risk ? (
                    <span className="risk-badge">REQUIERE ATENCIÓN</span>
                  ) : (
                    <span className="stable-badge">ESTABLE</span>
                  )}
                </td>

                <td>
                  <button onClick={() => openEpisode(patient.id)}>
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  </main>
)}

      {page === "laboratory" && laboratoryQueue && (
  <main className="container">
    <div className="page-title">
      <div>
        <span>LABORATORIO SIMULADO</span>
        <h1>Órdenes pendientes</h1>
        <p>
          Registra y publica resultados para los episodios activos.
        </p>
      </div>

      <button onClick={openLaboratoryQueue}>
        Actualizar bandeja
      </button>
    </div>

    <section className="lab-summary">
      <article>
        <strong>{laboratoryQueue.total}</strong>
        <span>Órdenes pendientes</span>
      </article>
    </section>

    {laboratoryQueue.orders.length === 0 ? (
      <section className="panel empty-state">
        <div className="empty-icon">✓</div>
        <h2>No hay órdenes pendientes</h2>
        <p>
          Las nuevas órdenes de laboratorio aparecerán aquí.
        </p>
      </section>
    ) : (
      <section className="lab-grid">
        {laboratoryQueue.orders.map((order: any) => (
          <article className="panel lab-order" key={order.id}>
            <div className="lab-order-header">
              <div>
                <span className="order-number">
                  ORDEN #{order.id}
                </span>

                <h2>{order.title}</h2>
              </div>

              <span className={`priority p${order.priority}`}>
                P{order.priority}
              </span>
            </div>

            <dl className="lab-details">
              <div>
                <dt>Paciente</dt>
                <dd>{order.patient_name}</dd>
              </div>

              <div>
                <dt>Episodio</dt>
                <dd>EP-{order.episode_id}</dd>
              </div>

              <div>
                <dt>Ubicación</dt>
                <dd>{order.location}</dd>
              </div>

              <div>
                <dt>Estado</dt>
                <dd>{order.status}</dd>
              </div>
            </dl>

            <form
              className="lab-result-form"
              onSubmit={(event) =>
                completeLaboratoryOrder(event, order.id)
              }
            >
              <label>
                Resultado de laboratorio

                <textarea
                  name="result"
                  rows={4}
                  placeholder={
                    "Ejemplo: hemoglobina 13.8 g/dL; " +
                    "leucocitos 8,400/mm3"
                  }
                  minLength={3}
                  required
                />
              </label>

              <button type="submit">
                Publicar resultado y completar
              </button>
            </form>
          </article>
        ))}
      </section>
    )}
  </main>
)}

      {page === "episode" && episode && (
        <EpisodePage
          episode={episode}
          user={user}
          updateEpisode={setEpisode}
          showError={setError}
        />
      )}
    </>
  );
}

type EpisodePageProps = {
  episode: Episode;
  user: User;
  updateEpisode: (episode: Episode) => void;
  showError: (message: string) => void;
};

function EpisodePage({
  episode,
  user,
  updateEpisode,
  showError,
}: EpisodePageProps) {
  const latestVitals = episode.vitals[0];

  async function call(path: string, options: RequestInit) {
    try {
      updateEpisode(await api(path, options));
    } catch (exception) {
      showError((exception as Error).message);
    }
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

    const form = new FormData(event.currentTarget);

    await call(`/episodes/${episode.id}/medical-evaluation`, {
      method: "POST",
      body: JSON.stringify({
        clinical_note: form.get("clinical_note"),
        diagnosis: form.get("diagnosis"),
        disposition: form.get("disposition"),
      }),
    });

    event.currentTarget.reset();
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

  const form = new FormData(event.currentTarget);

  await call(`/episodes/${episode.id}/tasks`, {
    method: "POST",
    body: JSON.stringify({
      title: form.get("title"),
      service: form.get("service"),
    }),
  });

  event.currentTarget.reset();
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

        {(user.role === "NURSE" || user.role === "SUPERVISOR") && (
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

          {(user.role === "NURSE" || user.role === "DOCTOR") && (
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
          {alert.status === "ACTIVE" &&
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

          {(alert.status === "ACTIVE" ||
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

{(alert.status === "ACKNOWLEDGED" ||
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
                  transition: Record<string, any>,
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
                      transition: Record<string, any>,
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
        <button
          className="discharge"
          onClick={() =>
            call(`/episodes/${episode.id}/discharge`, {
              method: "POST",
              body: JSON.stringify({
                note: "Alta médica; paciente estable",
              }),
            })
          }
        >
          Cerrar episodio · Alta médica
        </button>
      )}
    </main>
  );
}

export default App;