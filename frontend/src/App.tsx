import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import { api } from "./api/client";
import EpisodeHistoryPage from "./pages/EpisodeHistoryPage";
import ScanPage from "./pages/ScanPage";
import NewEpisodePage from "./pages/NewEpisodePage";
import DashboardPage from "./pages/DashboardPage";
import LaboratoryPage from "./pages/LaboratoryPage";
import SupervisorPage from "./pages/SupervisorPage";
import EpisodePage from "./pages/EpisodePage";
import type {
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

export default App;
