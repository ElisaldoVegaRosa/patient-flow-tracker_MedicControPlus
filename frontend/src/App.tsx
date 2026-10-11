import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import {
  api, establishSession, getSessionRevision, invalidateSession,
  isSessionInterruption, SESSION_EXPIRED_EVENT,
} from "./api/client";
import { useDischargeRecovery } from "./session/useDischargeRecovery";
import { useUnsavedDischargeNote } from "./session/useUnsavedDischargeNote";
import EpisodeHistoryPage from "./pages/EpisodeHistoryPage";
import ScanPage from "./pages/ScanPage";
import NewEpisodePage from "./pages/NewEpisodePage";
import DashboardPage from "./pages/DashboardPage";
import LaboratoryPage from "./pages/LaboratoryPage";
import SupervisorPage from "./pages/SupervisorPage";
import EpisodePage from "./pages/EpisodePage";
import LoginPage from "./pages/LoginPage";
import AppHeader from "./components/AppHeader";
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
  const recovery = useDischargeRecovery();
  const { clear: clearDraft, suspend: suspendRecovery } = recovery;
  const leave = useUnsavedDischargeNote();
  const { clear: clearLeave, track: trackLeave } = leave;
  const clearRecovery = useCallback(() => {
    clearDraft();
    clearLeave();
  }, [clearDraft, clearLeave]);
  const [recoveredNote, setRecoveredNote] = useState("");

  function navigate(nextPage: string) {
    clearRecovery();
    setRecoveredNote("");
    setPage(nextPage);
  }

  function updateEpisode(updated: Episode) {
    if (updated.status === "CLOSED") {
      clearRecovery();
      setRecoveredNote("");
    }
    setEpisode(updated);
  }

  useEffect(() => {
    function sessionExpired() {
      suspendRecovery();
      clearLeave();
      setRecoveredNote("");
      setUser(null);
      setEpisode(null);
      setDashboard(null);
      setLaboratoryQueue(null);
      setSupervisorData(null);
      setHistoryData(null);
      setPage("dashboard");
      setRestoringSession(false);
      setEvaluatingRules(false);
      setRulesMessage("");
      setError("Tu sesión expiró. Inicia sesión nuevamente.");
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
  }, [suspendRecovery, clearLeave]);

  async function restoreNote() {
    if (!user) return;
    const result = await recovery.check(user, true);
    if (result) {
      setEpisode(result.episode);
      setRecoveredNote(result.note);
      recovery.track(user.username, result.episode.id, result.note);
      trackLeave(result.note);
      setPage("episode");
    }
  }

  async function loadDashboard() {
    try {
      setDashboard(await api<DashboardData>("/dashboard"));
    } catch (exception) {
      if (isSessionInterruption(exception)) return;
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
      if (isSessionInterruption(exception)) return;
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
    .catch((exception: unknown) => {
      if (isSessionInterruption(exception)) return;
      invalidateSession();

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

      establishSession(result.access_token);
      setUser(result);
      await recovery.check(result);
    } catch (exception) {
      if (isSessionInterruption(exception)) return;
      setError((exception as Error).message);
    }
  }

  async function createEpisode(event: FormEvent<HTMLFormElement>) {
    clearRecovery();
    setRecoveredNote("");
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
      if (isSessionInterruption(exception)) return;
      setError((exception as Error).message);
    }
  }

  async function openEpisode(id: number) {
    clearRecovery();
    setRecoveredNote("");
    try {
      setEpisode(await api<Episode>(`/episodes/${id}`));
      setPage("episode");
    } catch (exception) {
      if (isSessionInterruption(exception)) return;
      setError((exception as Error).message);
    }
  }

  async function scanEpisode(event: FormEvent<HTMLFormElement>) {
    clearRecovery();
    setRecoveredNote("");
    event.preventDefault();
    const token = new FormData(event.currentTarget).get("token");

    try {
      setEpisode(await api<Episode>(`/scan/${token}`));
      setPage("episode");
    } catch (exception) {
      if (isSessionInterruption(exception)) return;
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
  const revision = getSessionRevision();
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
    if (revision !== getSessionRevision()) return;
    await loadDashboard();
  } catch (exception) {
    if (isSessionInterruption(exception)) return;
    setError((exception as Error).message);
  }
}

/**
 * Carga episodios cerrados sin mezclarlos con la operación activa.
 *
 * El historial es de consulta y no reactiva episodios dados de alta.
 */
async function openEpisodeHistory() {
    clearRecovery();
    setRecoveredNote("");
  try {
    const result = await api<HistoryData>("/episodes/history");

    setHistoryData(result);
    setPage("history");
  } catch (exception) {
    if (isSessionInterruption(exception)) return;
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
    clearRecovery();
    setRecoveredNote("");
  try {
    const result = await api<SupervisorData>("/supervisor/dashboard");

    setSupervisorData(result);
    setSupervisorFilter("ALL");
    setPage("supervisor");
  } catch (exception) {
    if (isSessionInterruption(exception)) return;
    setError((exception as Error).message);
  }
}

  /**
 * Abre la bandeja de laboratorio y carga las órdenes pendientes.
 */
async function evaluateTemporalRules() {
  const revision = getSessionRevision();
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
    if (revision !== getSessionRevision()) return;
    await loadDashboard();
  } catch (exception) {
    if (isSessionInterruption(exception)) return;
    setError((exception as Error).message);
  } finally {
    if (revision === getSessionRevision()) setEvaluatingRules(false);
  }
}

async function openLaboratoryQueue() {
    clearRecovery();
    setRecoveredNote("");
  try {
    const result = await api<LaboratoryQueue>("/lab/orders?status=PENDING");

    setLaboratoryQueue(result);
    setPage("laboratory");
  } catch (exception) {
    if (isSessionInterruption(exception)) return;
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
    if (isSessionInterruption(exception)) return;
    setError((exception as Error).message);
  }
}

async function logout() {
  const request = api<LogoutResponse>("/auth/logout", { method: "POST" });
  invalidateSession();
  clearRecovery();
  setRecoveredNote("");
  setUser(null);
  setEpisode(null);
  setDashboard(null);
  setLaboratoryQueue(null);
  setSupervisorData(null);
  setHistoryData(null);
  setPage("dashboard");
  setError("");
  setRulesMessage("");
  setEvaluatingRules(false);
  try {
    await request;
  } catch (exception) {
    if (!isSessionInterruption(exception)) {
      console.warn("No fue posible cerrar la sesión en el servidor.", exception);
    }
  }
}

  if (restoringSession || !user) {
    return (
      <LoginPage
        restoringSession={restoringSession}
        error={error}
        onSubmit={login}
      />
    );
  }

  return (
    <>
      <AppHeader
        user={user}
        onDashboard={() => leave.run(() => {
          navigate("dashboard");
          void loadDashboard();
        })}
        onSupervisor={async () => leave.run(() => { void openSupervisorDashboard(); })}
        onScan={() => leave.run(() => navigate("scan"))}
        onHistory={async () => leave.run(() => { void openEpisodeHistory(); })}
        onLaboratory={async () => leave.run(() => { void openLaboratoryQueue(); })}
        onNewEpisode={() => leave.run(() => navigate("new"))}
        onLogout={async () => leave.run(() => { void logout(); })}
      />

      {leave.confirming && (
        <section className="panel" role="dialog" aria-labelledby="unsaved-note-title">
          <h2 id="unsaved-note-title">Nota de alta sin enviar</h2>
          <p>Si sales, perderás esta nota de alta.</p>
          <button type="button" autoFocus onClick={leave.cancel}>Seguir editando</button>
          <button type="button" onClick={leave.discard}>Descartar y salir</button>
        </section>
      )}

      {recovery.status !== "idle" && recovery.status !== "waiting" && (
        <section className="panel" aria-label="Recuperación de nota de alta">
          {recovery.status === "checking" ? (
            <p role="status">Comprobando el episodio para recuperar la nota…</p>
          ) : (
            <>
              <p>{recovery.error || "Hay una nota de alta pendiente de recuperar tras expirar la sesión."}</p>
              {recovery.status === "offer" ? (
                <button type="button" onClick={restoreNote}>Restaurar nota de alta</button>
              ) : (
                <button type="button" onClick={() => recovery.check(user)}>Reintentar recuperación</button>
              )}
            </>
          )}
          <button type="button" onClick={clearRecovery}>Descartar</button>
        </section>
      )}

      {error && (
        <div className="error-banner" onClick={() => setError("")}>
          {error} ×
        </div>
      )}

      {page === "dashboard" && dashboard && (
        <DashboardPage
          dashboard={dashboard}
          onRefresh={loadDashboard}
          onOpenEpisode={async (id) => leave.run(() => { void openEpisode(id); })}
        />
      )}

      {page === "new" && <NewEpisodePage onSubmit={createEpisode} />}

      {page === "scan" && <ScanPage onSubmit={scanEpisode} />}

      {page === "history" && historyData && (
        <EpisodeHistoryPage
          historyData={historyData}
          onRefresh={openEpisodeHistory}
          onOpenEpisode={async (id) => leave.run(() => { void openEpisode(id); })}
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
          onOpenEpisode={async (id) => leave.run(() => { void openEpisode(id); })}
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
          key={`${user.username}:${episode.id}`}
          episode={episode}
          user={user}
          updateEpisode={updateEpisode}
          showError={setError}
          initialDischargeNote={recoveredNote}
          onDischargeNoteChange={(note) => {
            recovery.track(user.username, episode.id, note);
            trackLeave(note);
          }}
        />
      )}
    </>
  );
}

export default App;
