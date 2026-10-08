import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";
import { api } from "./api/client";
import EpisodeHistoryPage from "./pages/EpisodeHistoryPage";
import ScanPage from "./pages/ScanPage";
import NewEpisodePage from "./pages/NewEpisodePage";
import DashboardPage from "./pages/DashboardPage";
import LaboratoryPage from "./pages/LaboratoryPage";
import SupervisorPage from "./pages/SupervisorPage";
import type {
  AlertHistoryEntry,
  DashboardData,
  DemoSeedResponse,
  Episode,
  HistoryData,
  LaboratoryQueue,
  LogoutResponse,
  SessionUser,
  SupervisorData,
  TimeRulesEvaluationResponse,
  User,
} from "./types/clinical";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState("dashboard");
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);  
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [laboratoryQueue, setLaboratoryQueue] =
    useState<LaboratoryQueue | null>(null);
  const [supervisorData, setSupervisorData] =
    useState<SupervisorData | null>(null);
  const [supervisorFilter, setSupervisorFilter] = useState("ALL");
  const [historyData, setHistoryData] =
    useState<HistoryData | null>(null);
  const [rulesMessage, setRulesMessage] = useState("");
  const [evaluatingRules, setEvaluatingRules] = useState(false);
  const [error, setError] = useState("");
  const [restoringSession, setRestoringSession] =
    useState(() => Boolean(localStorage.getItem("token")));

  async function loadDashboard() {
    try {
      setDashboard(await api<DashboardData>("/dashboard"));
    } catch (exception) {
      setError((exception as Error).message);
    }
  }

useEffect(() => {
  if (!user) {
    return;
  }

  let cancelled = false;

  api<DashboardData>("/dashboard")
    .then((result) => {
      if (!cancelled) {
        setDashboard(result);
      }
    })
    .catch((exception: unknown) => {
      if (!cancelled) {
        setError(
          exception instanceof Error
            ? exception.message
            : "No fue posible cargar el dashboard",
        );
      }
    });

  return () => {
    cancelled = true;
  };
}, [user]);

useEffect(() => {
  const storedToken = localStorage.getItem("token");

  if (!storedToken) {
    return;
  }

  let cancelled = false;

  api<SessionUser>("/auth/me")
    .then((session) => {
      if (!cancelled) {
        setUser({
          username: session.username,
          role: session.role,
          access_token: storedToken,
        });
      }
    })
    .catch(() => {
      localStorage.removeItem("token");

      if (!cancelled) {
        setUser(null);
      }
    })
    .finally(() => {
      if (!cancelled) {
        setRestoringSession(false);
      }
    });

  return () => {
    cancelled = true;
  };
}, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const result = await api<User>("/auth/login", {
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
      const result = await api<Episode>("/episodes", {
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
      setEpisode(await api<Episode>(`/episodes/${id}`));
      setPage("episode");
    } catch (exception) {
      setError((exception as Error).message);
    }
  }

  async function scanEpisode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = new FormData(event.currentTarget).get("token");

    try {
      setEpisode(await api<Episode>(`/scan/${token}`));
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
    const result = await api<DemoSeedResponse>("/demo/seed", {
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
    const result = await api<HistoryData>("/episodes/history");

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
    const result = await api<SupervisorData>("/supervisor/dashboard");

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
async function evaluateTemporalRules() {
  setError("");
  setRulesMessage("");
  setEvaluatingRules(true);

  try {
    const result = await api<TimeRulesEvaluationResponse>(
      "/rules/evaluate",
      {
        method: "POST",
      },
    );

    setRulesMessage(
      `${result.generated_alerts} alertas generadas tras evaluar ${result.evaluated_episodes} episodios.`,
    );

    await openSupervisorDashboard();
    await loadDashboard();
  } catch (exception) {
    setError((exception as Error).message);
  } finally {
    setEvaluatingRules(false);
  }
}

async function openLaboratoryQueue() {
  try {
    const result = await api<LaboratoryQueue>("/lab/orders?status=PENDING");

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
    await api<Episode>(`/tasks/${taskId}/complete`, {
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
    await api<LogoutResponse>("/auth/logout", {
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
        <DashboardPage
          dashboard={dashboard}
          onRefresh={loadDashboard}
          onOpenEpisode={openEpisode}
        />
      )}

      {page === "new" && <NewEpisodePage onSubmit={createEpisode} />}

      {page === "scan" && <ScanPage onSubmit={scanEpisode} />}

      {page === "history" && historyData && (
        <EpisodeHistoryPage
          historyData={historyData}
          onRefresh={openEpisodeHistory}
          onOpenEpisode={openEpisode}
        />
      )}

      {page === "supervisor" && supervisorData && (
        <SupervisorPage
          supervisorData={supervisorData}
          supervisorFilter={supervisorFilter}
          rulesMessage={rulesMessage}
          evaluatingRules={evaluatingRules}
          onLoadDemo={loadDemoData}
          onEvaluateRules={evaluateTemporalRules}
          onRefresh={openSupervisorDashboard}
          onFilterChange={setSupervisorFilter}
          onOpenEpisode={openEpisode}
        />
      )}

      {page === "laboratory" && laboratoryQueue && (
        <LaboratoryPage
          laboratoryQueue={laboratoryQueue}
          onRefresh={openLaboratoryQueue}
          onCompleteOrder={completeLaboratoryOrder}
        />
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
  const isClosed = episode.status === "CLOSED";
  const latestVitals = episode.vitals[0];
  const [dischargeNote, setDischargeNote] = useState("");
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
            onChange={(event) => setDischargeNote(event.target.value)}
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

export default App;
