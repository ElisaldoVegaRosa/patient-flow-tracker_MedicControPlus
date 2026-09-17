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
  const [error, setError] = useState("");

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

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
    setEpisode(null);
    setDashboard(null);
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

          <button onClick={() => setPage("scan")}>
            Escanear pulsera
          </button>

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

        <section className="panel alerts">
          <h2>Alertas activas</h2>

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

                  {(user.role === "DOCTOR" ||
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
              </article>
            ))}
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