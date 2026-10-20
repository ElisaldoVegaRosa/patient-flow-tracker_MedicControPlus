import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api, getSessionRevision, isSessionInterruption, VersionConflictError } from "../api/client";
import type { PendingOperations } from "../hooks/usePendingOperations";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import UncertainWrites from "../components/UncertainWrites";
import RecoveredWrites from "../components/RecoveredWrites";
import { matchesSubmittedFields } from "../session/submittedFields";
import { clinicalLabel } from "../presentation/clinicalLabels";
import type { Account, AccountsData, User } from "../types/clinical";

const roles = ["RECEPTION", "ADMISSION", "NURSE", "DOCTOR", "LAB", "SUPERVISOR", "ACCOUNT_ADMIN"];
const roleLabel = (role: string) => role === "ACCOUNT_ADMIN" ? "Administrador de cuentas" : clinicalLabel("role", role);
const passwordInput = <label>Contraseña nueva<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>;
const reasonInput = <label>Motivo<textarea name="reason" required minLength={3} maxLength={2000} /></label>;

function currentFields(form: HTMLFormElement) {
  // A pending fieldset is disabled: native FormData would omit its values.
  const fields = new FormData();
  for (const element of form.elements) {
    if ((element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && element.name)
      fields.set(element.name, element.value);
  }
  return fields;
}

function AccountWriteForm({ path, account, label, children, operations, onApplied, onConflict, onDirty }: {
  path: string; account?: Account; label: string; children: ReactNode; operations: PendingOperations;
  onApplied: (path: string, result: unknown, body?: BodyInit | null) => void;
  onConflict: () => void; onDirty: () => void;
}) {
  const [baseline, setBaseline] = useState<string | null>(null);
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const stale = baseline !== null && baseline !== account?.version;
  useEffect(() => {
    const node = form.current;
    const saved = () => { setBaseline(null); setError(""); };
    node?.addEventListener("account-saved", saved);
    return () => node?.removeEventListener("account-saved", saved);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stale) return;
    const release = operations.start(path);
    if (!release) return;
    const data: Record<string, unknown> = Object.fromEntries(new FormData(event.currentTarget));
    if (path.endsWith("/status")) data.active = data.active === "true";
    const body = JSON.stringify(data);
    setError("");
    try {
      const result = await api<Account>(path, { method: path.endsWith("/status") ? "PATCH" : "POST", body,
        headers: account ? { "If-Match": baseline ?? account.version } : undefined });
      onApplied(path, result, body);
    } catch (exception) {
      if (!isSessionInterruption(exception)) {
        setError((exception as Error).message);
        if (exception instanceof VersionConflictError) {
          setBaseline(baseline ?? account?.version ?? null);
          onConflict();
        }
      }
    } finally { release(); }
  }
  return <form ref={form} data-account-path={path} className="form-grid" onSubmit={event => void submit(event)}
    onChange={() => { if (account) setBaseline(previous => previous ?? account.version); onDirty(); }}>
    <fieldset disabled={operations.hasPending()}>
      <legend>{label}</legend>
      {children}
      {reasonInput}
      {stale && <div role="alert">
        <p>Esta cuenta cambió. Tus campos se conservan. Revisa los datos actuales antes de continuar.</p>
        <button type="button" onClick={() => { setBaseline(account?.version ?? null); setError(""); }}>He revisado esta cuenta; usar versión actual</button>
      </div>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={stale}>{operations.isPending(path) ? "Guardando…" : label}</button>
    </fieldset>
  </form>;
}

function auditValue(value: string) {
  const data = JSON.parse(value) as Account | null;
  return data ? `${data.display_name || data.username} (${data.username}) · ${roleLabel(data.role)} · ${data.active ? "Activa" : "Inactiva"} · revisión ${data.account_revision}` : "Sin cuenta anterior";
}

export default function AccountsPage({ user, operations, onLogout }: {
  user: User; operations: PendingOperations; onLogout: () => Promise<void>;
}) {
  const [data, setData] = useState<AccountsData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  function updateDirty() {
    setDirty([...(root.current?.querySelectorAll("input, textarea, select") ?? [])].some(element =>
      element instanceof HTMLSelectElement ? element.value !== (element.options[0]?.value ?? "") :
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.value !== element.defaultValue));
  }
  const { refresh, error: refreshError } = useLiveRefresh({
    context: `accounts:${user.username}:${getSessionRevision()}`,
    paused: () => dirty || operations.hasPending(),
    load: async signal => {
      const result = await api<AccountsData>("/accounts", { signal });
      return () => setData(result);
    },
  });
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function reload() {
    const revision = getSessionRevision();
    try {
      const result = await api<AccountsData>("/accounts");
      if (mounted.current && revision === getSessionRevision()) { setData(result); setError(""); }
    } catch (exception) {
      if (mounted.current && revision === getSessionRevision() && !isSessionInterruption(exception)) setError((exception as Error).message);
    }
  }
  function confirmed(path: string, _result: unknown, body?: BodyInit | null) {
    if (typeof body === "string") {
      const payload = JSON.parse(body) as Record<string, unknown>;
      for (const form of root.current?.querySelectorAll<HTMLFormElement>("form[data-account-path]") ?? []) {
        if (form.dataset.accountPath === path && matchesSubmittedFields(currentFields(form), payload)) {
          form.reset();
          form.dispatchEvent(new Event("account-saved"));
        }
      }
      updateDirty();
    }
    setNotice("Operación de cuentas confirmada. No se ha creado otra operación.");
    void reload();
  }
  return <div ref={root}>
    <header className="header"><div className="logo">✚ MedicControl+ · Cuentas</div>
      <div className="user"><strong>{user.display_name || user.username} ({user.username})</strong>
        <span>Administrador de cuentas</span><button type="button" disabled={operations.hasPending()} onClick={() => {
          if (!dirty || window.confirm("Hay campos de cuentas sin guardar. ¿Descartarlos y salir?")) void onLogout();
        }}>Salir</button></div></header>
    <main className="container">
      <h1>Administración de cuentas</h1>
      <p>Este permiso administra accesos; no concede consulta ni acciones clínicas.</p>
      <p>Usuarios y datos ficticios del demo. Las contraseñas no se conservan como borradores tras recargar o salir.</p>
      <UncertainWrites operations={operations} onConfirmed={confirmed} />
      <RecoveredWrites user={user} operations={operations} onConfirmed={() => { setNotice("Operación anterior confirmada. Los campos actuales se conservan."); void reload(); }} />
      {notice && <p role="status">{notice}</p>}
      {(error || refreshError) && <p role="alert">{error || refreshError}</p>}
      <button type="button" disabled={operations.hasPending()} onClick={() => void reload()}>Consultar cuentas actuales</button>
      <p>{dirty ? "Actualización automática pausada mientras editas." : "Actualización cada 15 segundos mientras la pestaña esté visible."}</p>
      <section className="panel"><h2>Crear cuenta personal</h2>
        <AccountWriteForm path="/accounts" label="Crear cuenta" operations={operations} onApplied={confirmed} onConflict={() => void reload()} onDirty={updateDirty}>
          <label>Usuario único<input name="username" required minLength={3} maxLength={40} pattern="[a-z][a-z0-9_.\-]{2,39}" autoComplete="off" /></label>
          <label>Nombre visible<input name="display_name" required maxLength={200} /></label>
          <label>Perfil<select name="role">{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          {passwordInput}
          <p>Contraseña de 12 a 128 caracteres. Comunícala fuera de esta pantalla; no se mostrará en la auditoría.</p>
        </AccountWriteForm>
      </section>
      {!data && <p role="status">Consultando cuentas…</p>}
      <section aria-label="Cuentas registradas"><h2>Cuentas registradas</h2>
        {data?.accounts.map(account => <article key={account.id} className="panel" aria-label={`Cuenta ${account.username}`}>
          <h3>{account.display_name || account.username} · {account.username}</h3>
          <p>{roleLabel(account.role)} · {account.active ? "Activa" : "Inactiva"}</p>
          {account.username === user.username ? <p>Tu cuenta está protegida. Otro administrador debe restablecer su contraseña.</p> : <>
            <AccountWriteForm path={`/accounts/${account.id}/status`} account={account} label={account.active ? "Desactivar cuenta" : "Activar cuenta"} operations={operations} onApplied={confirmed} onConflict={() => void reload()} onDirty={updateDirty}>
              <input type="hidden" name="active" value={String(!account.active)} />
              {!account.active ? <p>Reactivar no recupera sesiones antiguas.</p> : <p>Desactivar revoca todas las sesiones de esta cuenta.</p>}
            </AccountWriteForm>
            <AccountWriteForm path={`/accounts/${account.id}/password`} account={account} label="Restablecer contraseña" operations={operations} onApplied={confirmed} onConflict={() => void reload()} onDirty={updateDirty}>
              {passwordInput}<p>Esta acción revoca todas las sesiones de la cuenta.</p>
            </AccountWriteForm>
          </>}
        </article>)}
      </section>
      <section className="panel"><details><summary>Auditoría de cuentas</summary>
        {data?.changes.map(change => <article key={change.id}>
          <h3>Cuenta #{change.user_id} · {change.action}</h3>
          <p>Anterior: {auditValue(change.old_value)}</p><p>Nuevo: {auditValue(change.new_value)}</p>
          <p>Motivo: {change.reason}</p><p>{change.actor} · {change.created_at}</p>
        </article>)}
      </details></section>
    </main>
  </div>;
}
