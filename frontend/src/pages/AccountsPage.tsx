import { useEffect, useRef, useState } from "react";
import { api, getSessionRevision, isSessionInterruption } from "../api/client";
import type { PendingOperations } from "../hooks/usePendingOperations";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import UncertainWrites from "../components/UncertainWrites";
import RecoveredWrites from "../components/RecoveredWrites";
import OperationalWriteForm from "../components/OperationalWriteForm";
import { notifyOperationalConfirmation, operationalFormDirty } from "../session/operationalWrites";
import { clinicalLabel } from "../presentation/clinicalLabels";
import type { Account, AccountsData, User } from "../types/clinical";

const roles = ["RECEPTION", "ADMISSION", "NURSE", "DOCTOR", "LAB", "SUPERVISOR", "ACCOUNT_ADMIN"];
const roleLabel = (role: string) => role === "ACCOUNT_ADMIN" ? "Administrador de cuentas" : clinicalLabel("role", role);
const passwordInput = <label>Contraseña nueva<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>;


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
    setDirty([...(root.current?.querySelectorAll<HTMLFormElement>("form[data-operational]") ?? [])].some(operationalFormDirty));
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
    notifyOperationalConfirmation(path, body);
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
        <OperationalWriteForm path="/accounts" label="Crear cuenta" operations={operations} onApplied={confirmed} onConflict={() => void reload()} onDirty={updateDirty}>
          <label>Usuario único<input name="username" required minLength={3} maxLength={40} pattern="[a-z][a-z0-9_.\-]{2,39}" autoComplete="off" /></label>
          <label>Nombre visible<input name="display_name" required maxLength={200} /></label>
          <label>Perfil<select name="role">{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          {passwordInput}
          <p>Contraseña de 12 a 128 caracteres. Comunícala fuera de esta pantalla; no se mostrará en la auditoría.</p>
        </OperationalWriteForm>
      </section>
      {!data && <p role="status">Consultando cuentas…</p>}
      <section aria-label="Cuentas registradas"><h2>Cuentas registradas</h2>
        {data?.accounts.map(account => <article key={account.id} className="panel" aria-label={`Cuenta ${account.username}`}>
          <h3>{account.display_name || account.username} · {account.username}</h3>
          <p>{roleLabel(account.role)} · {account.active ? "Activa" : "Inactiva"}</p>
          {account.username === user.username ? <p>Tu cuenta está protegida. Otro administrador debe restablecer su contraseña.</p> : <>
            <OperationalWriteForm path={`/accounts/${account.id}/status`} version={account.version} label={account.active ? "Desactivar cuenta" : "Activar cuenta"} operations={operations} onApplied={confirmed} onConflict={() => void reload()} onDirty={updateDirty}>
              <input type="hidden" name="active" value={String(!account.active)} />
              {!account.active ? <p>Reactivar no recupera sesiones antiguas.</p> : <p>Desactivar revoca todas las sesiones de esta cuenta.</p>}
            </OperationalWriteForm>
            {account.role !== "ACCOUNT_ADMIN" && (account.display_name || account.can_coordinate) && <OperationalWriteForm
              path={`/accounts/${account.id}/coordination`} version={account.version}
              label={account.can_coordinate ? "Retirar permiso de coordinación" : "Conceder permiso de coordinación"}
              operations={operations} onApplied={confirmed} onConflict={() => void reload()} onDirty={updateDirty}>
              <input type="hidden" name="can_coordinate" value={String(!account.can_coordinate)} />
              <p>Solo concede coordinación; no amplía el rol clínico. Revoca las sesiones para renovar permisos.</p>
            </OperationalWriteForm>}
            <OperationalWriteForm path={`/accounts/${account.id}/password`} version={account.version} label="Restablecer contraseña" operations={operations} onApplied={confirmed} onConflict={() => void reload()} onDirty={updateDirty}>
              {passwordInput}<p>Esta acción revoca todas las sesiones de la cuenta.</p>
            </OperationalWriteForm>
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
