import { validateOperationalForm } from "./forms/inputValidation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import { usePendingOperations } from "./hooks/usePendingOperations";
import { useLiveRefresh } from "./hooks/useLiveRefresh";
import { useVersionedWrites } from "./hooks/useVersionedWrites";
import WriteConflicts from "./components/WriteConflicts";
import UncertainWrites from "./components/UncertainWrites";
import RetainedDrafts from "./components/RetainedDrafts";
import RecoveredWrites from "./components/RecoveredWrites";
import {
  AdmissionReviewError, api, bindWriteRecovery, establishSession, getSessionRevision, invalidateSession,
  isSessionInterruption, SESSION_EXPIRED_EVENT, VersionConflictError,
} from "./api/client";
import { useFormRecovery } from "./session/useFormRecovery";
import { matchesSubmittedFields } from "./session/submittedFields";
import type { DraftKind, FormDraft } from "./session/formDrafts";
type VisibleDraft = FormDraft & { defaults?: Record<string, string> };
import { useUnsavedDischargeNote } from "./session/useUnsavedDischargeNote";
import EpisodeHistoryPage from "./pages/EpisodeHistoryPage";
import ScanPage from "./pages/ScanPage";
import IdentityQueuePage from "./pages/IdentityQueuePage";
import NewEpisodePage from "./pages/NewEpisodePage";
import DashboardPage from "./pages/DashboardPage";
import LaboratoryPage from "./pages/LaboratoryPage";
import SupervisorPage from "./pages/SupervisorPage";
import EpisodePage from "./pages/EpisodePage";
import LoginPage from "./pages/LoginPage";
import AccountsPage from "./pages/AccountsPage";
import EpisodePresence from "./components/EpisodePresence";
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
  const [laboratoryFilter, setLaboratoryFilter] = useState<"PENDING" | "COMPLETED" | "ALL">("PENDING");
  const [supervisorData, setSupervisorData] =
    useState<SupervisorData | null>(null);
  const [supervisorFilter, setSupervisorFilter] = useState("ALL");
  const [historyData, setHistoryData] =
    useState<HistoryData | null>(null);
  const [rulesMessage, setRulesMessage] = useState("");
  const operations = usePendingOperations();
  const evaluatingRules = operations.isPending("rules");
  const [error, setError] = useState("");
  const [writeNotice, setWriteNotice] = useState("");
  const [restoringSession, setRestoringSession] =
    useState(() => Boolean(localStorage.getItem("token")));
  const recovery = useFormRecovery();
  const writes = useVersionedWrites();
  const { clear: clearWrites, remember: rememberVersion } = writes;
  const { clear: clearDraft, suspend: suspendRecovery, check: checkRecovery } = recovery;
  const leave = useUnsavedDischargeNote();
  const { clear: clearLeave, track: trackLeave } = leave;
  const [restoredForms, setRestoredForms] = useState<VisibleDraft[]>([]);
  const applyRestoration = useRef(false);
  const clearRecovery = useCallback(() => {
    clearDraft();
    clearLeave();
    clearWrites();
    setRestoredForms([]);
    setRetainedDrafts([]);
    applyRestoration.current = false;
  }, [clearDraft, clearLeave, clearWrites]);
  const [recoveredNote, setRecoveredNote] = useState("");
  const draftRoot = useRef<HTMLDivElement>(null);
  const [retainedDrafts, setRetainedDrafts] = useState<FormDraft[]>([]);
  const lifecycleDirty = useCallback(() => {
    return [...(draftRoot.current?.querySelectorAll<HTMLFormElement>("form[data-record-correction], form[data-draft-kind='identity']") ?? [])]
      .some(form => [...form.querySelectorAll("input, textarea")].some(field =>
        (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) &&
        (form.dataset.draftKind === "identity" ? field.value !== field.defaultValue : Boolean(field.value.trim()))));
  }, []);
  function guardLifecycle(action: () => void) {
    if (lifecycleDirty() && !window.confirm("Hay una corrección o motivo sin guardar. ¿Descartar esos campos y salir?")) return;
    action();
  }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!lifecycleDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [lifecycleDirty]);

  function visibleDrafts(): VisibleDraft[] {
    return [...(draftRoot.current?.querySelectorAll<HTMLFormElement>("form[data-draft-kind]") ?? [])].filter(form => [...form.elements].some(element => {
      if (form.dataset.draftKind === "discharge" && element instanceof HTMLTextAreaElement) return Boolean(element.value.trim());
      if (element instanceof HTMLSelectElement) return element.value !== ([...element.options].find(option => option.defaultSelected)?.value ?? element.options[0]?.value ?? "");
      return (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.value !== element.defaultValue;
    })).map(form => ({
      kind: form.dataset.draftKind as DraftKind,
      episodeId: form.dataset.episodeId ? Number(form.dataset.episodeId) : undefined,
      taskId: form.dataset.taskId ? Number(form.dataset.taskId) : undefined,
      fields: Object.fromEntries([...form.elements].filter((element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement).filter(element => element.name).map(element => [element.name, element.value])),
      defaults: Object.fromEntries([...form.elements].filter((element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement).filter(element => element.name).map(element => [element.name, element instanceof HTMLSelectElement ? [...element.options].find(option => option.defaultSelected)?.value ?? element.options[0]?.value ?? "" : element.defaultValue])),
    }));
  }

  function applyLaboratoryQueue(result: LaboratoryQueue) {
    const drafts = visibleDrafts().filter(draft => draft.kind === "lab");
    const executable = (draft: FormDraft) => result.orders.some(order => order.id === draft.taskId && order.episode_id === draft.episodeId && order.status === "PENDING" && order.episode_status === "ACTIVE");
    const removed = drafts.filter(draft => !executable(draft) && Object.values(draft.fields).some(value => value.trim()));
    setRetainedDrafts(previous => [...previous.filter(draft => !removed.some(item => item.taskId === draft.taskId)), ...removed]);
    applyRestoration.current = true;
    setRestoredForms(drafts.filter(executable));
    setLaboratoryQueue(result);
  }

  const liveReady = page === "dashboard" ? dashboard : page === "supervisor" ? supervisorData : page === "laboratory" ? laboratoryQueue : page === "episode" ? episode : null;
  const liveContext = user && liveReady
    ? `${getSessionRevision()}:${user.username}:${user.role}:${page}:${page === "episode" ? episode?.id ?? "" : page === "laboratory" ? laboratoryFilter : ""}` : null;
  const live = useLiveRefresh({
    context: liveContext,
    paused: () => operations.hasPending() || leave.confirming || recovery.status === "checking" || lifecycleDirty(),
    load: async signal => {
      if (page === "dashboard") {
        const result = await api<DashboardData>("/dashboard", { signal });
        return () => setDashboard(result);
      }
      if (page === "supervisor") {
        const result = await api<SupervisorData>("/supervisor/dashboard", { signal });
        return () => setSupervisorData(result);
      }
      if (page === "laboratory") {
        const result = await api<LaboratoryQueue>(`/lab/orders?status=${laboratoryFilter}`, { signal });
        return () => applyLaboratoryQueue(result);
      }
      if (page === "episode" && episode) {
        const result = await api<Episode>(`/episodes/${episode.id}`, { signal });
        return () => {
          const drafts = visibleDrafts();
          if (!drafts.some(draft => draft.kind === "triage") && result.status === "ACTIVE") {
            const fields = { priority: String(result.priority), location: result.location, assigned_to: result.assigned_to ?? "" };
            drafts.push({ kind: "triage", episodeId: result.id, fields, defaults: fields });
          }
          if (result.status === "CLOSED" && episode.status !== "CLOSED") {
            setRetainedDrafts(drafts.filter(draft => Object.values(draft.fields).some(value => value.trim())));
          }
          // Never adopt a new write baseline: dirty drafts retain their original version.
          applyRestoration.current = true;
          setRestoredForms(drafts);
          setEpisode(result);
        };
      }
      return () => {};
    },
  });

  function captureDraft(event: FormEvent<HTMLDivElement>) {
    if (!user || !(event.target instanceof HTMLElement)) return;
    const form = event.target.closest("form");
    const kind = form?.dataset.draftKind as DraftKind | undefined;
    if (!form || !kind || kind === "discharge") return;
    const fields = Object.fromEntries([...new FormData(form).entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    const dirty = [...form.elements].some(element => {
      if (element instanceof HTMLSelectElement) {
        const original = [...element.options].find(option => option.defaultSelected)?.value ?? element.options[0]?.value ?? "";
        return element.value !== original;
      }
      return (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.value.trim() !== element.defaultValue.trim();
    });
    const episodeId = form.dataset.episodeId ? Number(form.dataset.episodeId) : undefined;
    const taskId = form.dataset.taskId ? Number(form.dataset.taskId) : undefined;
    const path = kind === "identity" ? `/episodes/${episodeId}/identity` : kind === "triage" ? `/episodes/${episodeId}/triage` : kind === "lab" ? `/tasks/${taskId}/complete` : null;
    if (path && !dirty) writes.forget(path);
    const baseVersion = path && dirty ? writes.remember(path, form.dataset.draftVersion) : undefined;
    recovery.trackForm(user, { kind, episodeId, taskId, baseVersion, fields }, dirty);
  }

  useLayoutEffect(() => {
    if (!applyRestoration.current || !user || !restoredForms.length || !draftRoot.current) return;
    for (const draft of restoredForms) {
      if (draft.kind === "discharge") continue;
      const form = [...draftRoot.current.querySelectorAll<HTMLFormElement>("form[data-draft-kind]")].find(form =>
        form.dataset.draftKind === draft.kind && Number(form.dataset.episodeId ?? 0) === (draft.episodeId ?? 0) && Number(form.dataset.taskId ?? 0) === (draft.taskId ?? 0));
      if (!form) continue;
      for (const [name, value] of Object.entries(draft.fields)) {
        const element = form.elements.namedItem(name);
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
          const original = draft.defaults?.[name];
          if (original !== undefined) {
            if (element instanceof HTMLSelectElement) for (const option of element.options) option.defaultSelected = option.value === original;
            else element.defaultValue = original;
          }
          element.value = value;
        }
      }
    }
    applyRestoration.current = false;
  }, [restoredForms, user, page]);

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

  function reviewChanges(latest: Episode, savedForm?: HTMLFormElement) {
    // Re-render authoritative state while preserving every visible local form.
    const drafts = [...(draftRoot.current?.querySelectorAll<HTMLFormElement>("form[data-draft-kind]") ?? [])]
      .filter(form => form.dataset.draftKind !== "discharge" && form !== savedForm)
      .map(form => ({ kind: form.dataset.draftKind as DraftKind,
        episodeId: form.dataset.episodeId ? Number(form.dataset.episodeId) : undefined,
        taskId: form.dataset.taskId ? Number(form.dataset.taskId) : undefined,
        fields: Object.fromEntries([...new FormData(form).entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      }));
    applyRestoration.current = true;
    setRestoredForms(drafts);
    if (page === "episode") updateEpisode(latest);
    if (page === "laboratory" && laboratoryQueue) applyLaboratoryQueue({ ...laboratoryQueue, orders: laboratoryQueue.orders.map(order => {
      const task = latest.tasks.find(item => item.id === order.id);
      return order.episode_id === latest.id ? { ...order, ...task, episode_status: latest.status,
        record_changes: (latest.record_changes ?? []).filter(change => change.target_type === "TASK" && change.target_id === order.id) } : order;
    }) });
  }

  function confirmedWrite(path: string, result: unknown, body: BodyInit | null | undefined) {
    setWriteNotice("Operación confirmada por el servidor. No se ha creado otro registro.");
    setError(previous => previous.includes("Resultado por confirmar") || previous.includes("envío anterior por confirmar") ? "" : previous);
    const kind = path === "/episodes" ? "arrival" : path.endsWith("/identity") ? "identity" : path.endsWith("/triage") ? "triage" : path.endsWith("/vitals") ? "vitals" : path.endsWith("/medical-evaluation") ? "evaluation" : path.endsWith("/tasks") ? "order" : path.startsWith("/tasks/") ? "lab" : undefined;
    const updated = result as Episode;
    if (!updated || typeof updated.id !== "number") { writes.forget(path); return; }
    const payload = typeof body === "string" ? JSON.parse(body) as Record<string, unknown> : {};
    const savedForm = [...(draftRoot.current?.querySelectorAll<HTMLFormElement>("form[data-draft-kind]") ?? [])].find(form =>
      form.dataset.draftKind === kind &&
      (!form.dataset.episodeId || Number(form.dataset.episodeId) === updated.id) &&
      (!form.dataset.taskId || path === `/tasks/${form.dataset.taskId}/complete`) &&
      matchesSubmittedFields(new FormData(form), payload));
    // A receipt can return later changes by another session. Do not silently
    // adopt their triage version underneath local edits still awaiting review.
    if (!["triage", "identity"].includes(kind ?? "") || savedForm || Object.entries(payload).every(([name, value]) => String((updated as unknown as Record<string, unknown>)[name] ?? "") === String(value ?? ""))) writes.forget(path);
    if (savedForm && kind) {
      savedForm.reset();
      recovery.remove(kind, kind === "arrival" ? undefined : updated.id, savedForm.dataset.taskId ? Number(savedForm.dataset.taskId) : undefined);
      if (kind === "evaluation") leave.trackEvaluation(false);
      if (kind === "order") leave.trackOrder(false);
    }
    if (path === "/episodes" && page === "new" && savedForm) {
      setEpisode(updated);
      setPage("episode");
      setRestoredForms([]);
      setRetainedDrafts([]);
      void loadDashboard();
    } else if ((page === "episode" && episode?.id === updated.id) || page === "laboratory") {
      reviewChanges(updated, savedForm);
      if (page === "laboratory" && laboratoryFilter === "PENDING") setLaboratoryQueue(previous => previous ? { ...previous, orders: previous.orders.filter(order => !updated.tasks.some(task => task.id === order.id && task.status === "COMPLETED")) } : previous);
    }
  }

  useEffect(() => {
    function sessionExpired() {
      suspendRecovery(draft => {
        const path = draft.kind === "identity" ? `/episodes/${draft.episodeId}/identity` : draft.kind === "triage" ? `/episodes/${draft.episodeId}/triage` : draft.kind === "discharge" ? `/episodes/${draft.episodeId}/discharge` : draft.kind === "lab" ? `/tasks/${draft.taskId}/complete` : null;
        return path ? rememberVersion(path, draft.baseVersion) : undefined;
      });
      clearWrites();
      clearLeave();
      setRecoveredNote("");
      setRestoredForms([]);
      setRetainedDrafts([]);
      setUser(null);
      setEpisode(null);
      setDashboard(null);
      setLaboratoryQueue(null);
      setSupervisorData(null);
      setHistoryData(null);
      setPage("dashboard");
      setRestoringSession(false);
      setRulesMessage("");
      setWriteNotice("");
      setError("Tu sesión expiró. Inicia sesión nuevamente.");
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
  }, [suspendRecovery, clearLeave, clearWrites, rememberVersion]);

  async function restoreNote() {
    if (!user) return;
    const result = await recovery.check(user, true);
    if (result) {
      setEpisode(result.episode);
      setRecoveredNote(result.note);
      if (result.versionNotice) setWriteNotice(result.versionNotice);
      applyRestoration.current = true;
      setRestoredForms(result.drafts);
      for (const draft of result.drafts) {
        const path = draft.kind === "identity" ? `/episodes/${draft.episodeId}/identity` : draft.kind === "triage" ? `/episodes/${draft.episodeId}/triage` : draft.kind === "discharge" ? `/episodes/${draft.episodeId}/discharge` : draft.kind === "lab" ? `/tasks/${draft.taskId}/complete` : null;
        if (path) writes.remember(path, draft.baseVersion ?? '"unversioned-draft"');
      }
      trackLeave(result.note);
      leave.trackEvaluation(result.drafts.some(draft => draft.kind === "evaluation"));
      leave.trackOrder(result.drafts.some(draft => draft.kind === "order"));
      if (result.drafts[0].kind === "arrival") setPage("new");
      else if (result.drafts[0].kind === "lab") { setLaboratoryQueue(result.laboratoryQueue); setPage("laboratory"); }
      else setPage("episode");
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
  if (!user || user.role === "ACCOUNT_ADMIN") {
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
    .then(async (session) => {
      if (cancelled) return;
      await bindWriteRecovery(session);
      if (!cancelled) {
        setUser({
          username: session.username,
          display_name: session.display_name,
          role: session.role,
          access_token: storedToken,
        });
        if (session.role !== "ACCOUNT_ADMIN") await checkRecovery(session);
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
}, [checkRecovery]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);

    const release = operations.start("login");
    if (!release) return;

    try {
      const result = await api<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });

      establishSession(result.access_token);
      await bindWriteRecovery(result);
      setUser(result);
      if (result.role !== "ACCOUNT_ADMIN") await recovery.check(result);
    } catch (exception) {
      if (isSessionInterruption(exception)) return;
      setError((exception as Error).message);
    } finally {
      release();
    }
  }

  async function createEpisode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const release = operations.start("arrival");
    if (!release) return;

    try {
      const result = await api<Episode>("/episodes", {
        method: "POST",
        body: JSON.stringify({
          ...(form.get("patient_id") ? { patient_id: Number(form.get("patient_id")) } : {}),
          ...(form.get("provisional") === "true" ? { provisional: true } : {}),
          name: form.get("provisional") === "true" && !String(form.get("name") ?? "").trim() ? null : form.get("name"),
          birth_date: form.get("provisional") === "true" && !form.get("birth_date") ? null : form.get("birth_date"),
          document: form.get("provisional") === "true" && !String(form.get("document") ?? "").trim() ? null : form.get("document"),
          priority: Number(form.get("priority")),
          location: form.get("location"),
        }),
      });

      recovery.remove("arrival");
      setRestoredForms([]);
      setEpisode(result);
      setPage("episode");
      loadDashboard();
    } catch (exception) {
      if (isSessionInterruption(exception)) return;
      if (exception instanceof AdmissionReviewError) throw exception;
      setError((exception as Error).message);
    } finally {
      release();
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

  async function scanEpisode(token: string) {
    clearRecovery();
    setRecoveredNote("");
    try {
      setEpisode(await api<Episode>(`/scan/${encodeURIComponent(token)}`));
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
  const release = operations.start("demo");
  if (!release) return;
  const revision = getSessionRevision();
  const confirmed = window.confirm(
    "Se agregarán 12 pacientes ficticios sin borrar los datos actuales. " +
      "¿Deseas continuar?",
  );

  if (!confirmed) {
    release();
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
  } finally {
    release();
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
  const release = operations.start("rules");
  if (!release) return;
  const revision = getSessionRevision();
  setError("");
  setRulesMessage("");

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
    release();
  }
}

async function openLaboratoryQueue(filter: "PENDING" | "COMPLETED" | "ALL" = laboratoryFilter) {
  if (page !== "laboratory") { clearRecovery(); setRecoveredNote(""); }
  try {
    const result = await api<LaboratoryQueue>(`/lab/orders?status=${filter}`);

    applyLaboratoryQueue(result);
    setLaboratoryFilter(filter);
    setPage("laboratory");
  } catch (exception) {
    if (isSessionInterruption(exception)) return;
    setError((exception as Error).message);
  }
}

async function changeLaboratoryResult(taskId: number, action: "CORRECT" | "ANNUL", reason: string, value?: string): Promise<boolean> {
  const order = laboratoryQueue?.orders.find(item => item.id === taskId);
  if (!order || order.status !== "COMPLETED" || user?.role !== "LAB") return false;
  const release = operations.start(`task:${taskId}`);
  if (!release) return false;
  try {
    await writes.write(`/tasks/${taskId}/result`, {
      method: "PATCH", body: JSON.stringify({ action, reason, ...(value ? { value } : {}) }),
    }, order.episode_id, order.version);
    await openLaboratoryQueue();
    return true;
  } catch (exception) {
    if (!isSessionInterruption(exception)) setError((exception as Error).message);
    return false;
  } finally { release(); }
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

  const order = laboratoryQueue?.orders.find(item => item.id === taskId);
  if (!order || order.status !== "PENDING" || order.episode_status !== "ACTIVE" || user?.role !== "LAB") return;
  const formElement = event.currentTarget;
  const form = new FormData(formElement);

  const release = operations.start(`task:${taskId}`);
  if (!release) return;

  try {
    const completed = await writes.write(`/tasks/${taskId}/complete`, {
      method: "PATCH",
      body: JSON.stringify({
        result: form.get("result"),
      }),
    }, order?.episode_id ?? 0, order?.version);

    formElement.reset();
    recovery.remove("lab", completed.id, taskId);
    setRestoredForms(previous => previous.filter(draft => draft.taskId !== taskId));
    await openLaboratoryQueue();
  } catch (exception) {
    if (isSessionInterruption(exception)) return;
    setError((exception as Error).message);
  } finally {
    release();
  }
}

async function logout() {
  const release = operations.start("logout");
  if (!release) return;
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
  try {
    await request;
  } catch (exception) {
    if (!isSessionInterruption(exception)) {
      console.warn("No fue posible cerrar la sesión en el servidor.", exception);
    }
  } finally {
    release();
  }
}

  if (restoringSession || !user) {
    return (
      <LoginPage
        submitting={operations.isPending("login")}
        restoringSession={restoringSession}
        error={error}
        onSubmit={login}
      />
    );
  }

  if (user.role === "ACCOUNT_ADMIN") return <AccountsPage key={`${user.username}:${getSessionRevision()}`}
    user={user} operations={operations} onLogout={logout} />;

  return (
    <div style={{ display: "contents" }} ref={draftRoot} onChangeCapture={captureDraft}
      onInputCapture={event => { const target = event.target; if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) target.setCustomValidity(""); }}
      onSubmitCapture={event => { if (event.target instanceof HTMLFormElement && !validateOperationalForm(event.target)) { event.preventDefault(); event.stopPropagation(); } }}>
      <AppHeader
        onIdentity={() => guardLifecycle(() => leave.run(() => navigate("identity")))}
        user={user}
        onDashboard={() => page === "dashboard" ? void live.refresh() : guardLifecycle(() => leave.run(() => {
          navigate("dashboard");
          void loadDashboard();
        }))}
        onSupervisor={async () => page === "supervisor" ? await live.refresh() : guardLifecycle(() => leave.run(() => { void openSupervisorDashboard(); }))}
        onScan={() => guardLifecycle(() => leave.run(() => navigate("scan")))}
        onHistory={async () => guardLifecycle(() => leave.run(() => { void openEpisodeHistory(); }))}
        onLaboratory={async () => page === "laboratory" ? await live.refresh() : guardLifecycle(() => leave.run(() => { void openLaboratoryQueue(); }))}
        onNewEpisode={() => guardLifecycle(() => leave.run(() => navigate("new")))}
        onLogout={async () => guardLifecycle(() => leave.run(() => { void logout(); }))}
      />

      {leave.confirming && (
        <section className="panel" role="dialog" aria-labelledby="unsaved-note-title">
          <h2 id="unsaved-note-title">{leave.evaluationDirty || leave.orderDirty ? "Cambios médicos sin guardar" : "Nota de alta sin enviar"}</h2>
          <p>{leave.evaluationDirty || leave.orderDirty ? "Si sales, perderás los cambios de evaluación, órdenes y notas de alta que no hayas enviado." : "Si sales, perderás esta nota de alta."}</p>
          <button type="button" autoFocus onClick={leave.cancel}>Seguir editando</button>
          <button type="button" onClick={leave.discard}>Descartar y salir</button>
        </section>
      )}

      {recovery.storageWarning && <p role="alert" className="error-banner">{recovery.storageWarning}</p>}

      {recovery.status !== "idle" && recovery.status !== "waiting" && (
        <section className="panel" aria-label={recovery.noteOnly ? "Recuperación de nota de alta" : "Recuperación de formularios"}>
          {recovery.status === "checking" ? (
            <p role="status">{recovery.noteOnly ? "Comprobando el episodio para recuperar la nota…" : "Comprobando los formularios pendientes…"}</p>
          ) : (
            <>
              <p>{recovery.error || (recovery.noteOnly ? "Hay una nota de alta pendiente de recuperar tras una recarga o interrupción de sesión." : "Hay formularios pendientes de recuperar tras una recarga o interrupción de sesión.")}</p>
              {recovery.status === "offer" ? (
                <button type="button" onClick={restoreNote}>{recovery.noteOnly ? "Restaurar nota de alta" : "Restaurar formularios"}</button>
              ) : (
                <button type="button" onClick={() => recovery.check(user)}>Reintentar recuperación</button>
              )}
            </>
          )}
          {recovery.versionNotice && <p role="status">{recovery.versionNotice}</p>}
          <button type="button" onClick={clearRecovery}>Descartar</button>
        </section>
      )}

      {error && (
        <div className="error-banner" onClick={() => setError("")}>
          {error} ×
        </div>
      )}
      <WriteConflicts writes={writes} onReviewed={latest => { reviewChanges(latest); if (page === "laboratory") void openLaboratoryQueue(); }} />
      <RecoveredWrites user={user} operations={operations} onConfirmed={() => {
        setWriteNotice("El servidor confirmó un envío anterior. No se ha reenviado ni se han borrado los campos actuales; consulta los registros actualizados.");
        void live.refresh();
      }} />
      <UncertainWrites operations={operations} onConfirmed={confirmedWrite} onRejected={(path, exception) => {
        setError(exception.message);
        if (exception instanceof VersionConflictError) {
          const id = Number(path.match(/^\/episodes\/(\d+)/)?.[1]) || (page === "episode" ? episode?.id : laboratoryQueue?.orders.find(order => path === `/tasks/${order.id}/complete` || path === `/tasks/${order.id}/result`)?.episode_id);
          if (id) writes.reportConflict(path, id, exception);
        }
      }} />
      {writeNotice && <p role="status">{writeNotice}</p>}
      {liveContext && (
        <section className="panel" aria-label="Actualización entre sesiones">
          {live.error ? <p role="alert">No se pudieron actualizar los datos. La información puede estar desactualizada. {live.error}</p> : <p>Actualización automática cada 15 segundos mientras esta pestaña esté visible.{live.updated ? ` Última actualización: ${new Date(live.updated).toLocaleTimeString()}.` : ""}</p>}
          {live.error && <button type="button" onClick={live.refresh}>Reintentar actualización</button>}
        </section>
      )}
      <RetainedDrafts drafts={retainedDrafts} />

      {page === "dashboard" && dashboard && (
        <DashboardPage
          dashboard={dashboard}
          onRefresh={live.refresh}
          onOpenEpisode={async (id) => guardLifecycle(() => leave.run(() => { void openEpisode(id); }))}
        />
      )}

      {page === "new" && <NewEpisodePage key={`arrival:${restoredForms.find(draft => draft.kind === "arrival")?.fields.provisional ?? "false"}`}
        initialProvisional={restoredForms.some(draft => draft.kind === "arrival" && draft.fields.provisional === "true")}
        onOpenEpisode={openEpisode} submitting={operations.isPending("arrival")} onSubmit={createEpisode} />}

      {page === "scan" && <ScanPage onSubmit={scanEpisode} />}
      {page === "identity" && <IdentityQueuePage user={user}
        onOpenEpisode={async id => guardLifecycle(() => leave.run(() => { void openEpisode(id); }))} />}

      {page === "history" && historyData && (
        <EpisodeHistoryPage
          historyData={historyData}
          onRefresh={openEpisodeHistory}
          onOpenEpisode={async (id) => guardLifecycle(() => leave.run(() => { void openEpisode(id); }))}
        />
      )}

      {page === "supervisor" && supervisorData && (
        <SupervisorPage
          supervisorData={supervisorData}
          supervisorFilter={supervisorFilter}
          rulesMessage={rulesMessage}
          evaluatingRules={evaluatingRules}
          loadingDemo={operations.isPending("demo")}
          onLoadDemo={loadDemoData}
          onEvaluateRules={evaluateTemporalRules}
          onRefresh={live.refresh}
          onFilterChange={setSupervisorFilter}
          onOpenEpisode={async (id) => guardLifecycle(() => leave.run(() => { void openEpisode(id); }))}
        />
      )}

      {page === "laboratory" && laboratoryQueue && (
        <LaboratoryPage
          laboratoryQueue={laboratoryQueue}
          canPublish={user.role === "LAB"}
          onRefresh={live.refresh}
          isCompleting={(id) => operations.isPending(`task:${id}`)}
          onCompleteOrder={completeLaboratoryOrder}
          onFilterChange={async (filter) => {
            if ((lifecycleDirty() || visibleDrafts().some(draft => draft.kind === "lab")) &&
                !window.confirm("Hay campos sin guardar. ¿Cambiar el filtro y conservarlos solo para revisión?")) return;
            await openLaboratoryQueue(filter);
          }}
          onChangeResult={changeLaboratoryResult}
        />
      )}

      {page === "episode" && episode?.status === "ACTIVE" && <EpisodePresence episodeId={episode.id} user={user} root={draftRoot} isEditing={() => visibleDrafts().some(draft => draft.episodeId === episode.id)} />}

      {page === "episode" && episode && (
        <EpisodePage
          key={`${user.username}:${episode.id}`}
          onOpenLaboratory={() => guardLifecycle(() => leave.run(() => { void openLaboratoryQueue(); }))}
          onDraftSaved={(kind) => { recovery.remove(kind, episode.id); setRestoredForms(previous => previous.filter(draft => draft.kind !== kind)); }}
          pendingOperations={operations}
          versionedWrites={writes}
          episode={episode}
          user={user}
          updateEpisode={updateEpisode}
          showError={setError}
          initialDischargeNote={recoveredNote}
          onMedicalEvaluationChange={leave.trackEvaluation}
          onClinicalOrderChange={leave.trackOrder}
          onDischargeNoteChange={(note) => {
            recovery.track(user.username, episode.id, note, note.trim() ? writes.remember(`/episodes/${episode.id}/discharge`, episode.clinical_version) : undefined);
            trackLeave(note);
          }}
        />
      )}
    </div>
  );
}

export default App;
