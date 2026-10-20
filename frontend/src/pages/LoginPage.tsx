import type { FormEvent } from "react";
import { useState } from "react";
import { clinicalLabel } from "../presentation/clinicalLabels";

type LoginPageProps = {
  submitting?: boolean;
  restoringSession: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function LoginPage({ restoringSession, error, onSubmit, submitting = false }: LoginPageProps) {
const [personal, setPersonal] = useState(false);
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

  return (
      <main className="login-page">
        <section className="login-card">
          <div className="logo">✚ MedicControl+</div>
          <h1>Seguimiento clínico</h1>
          <p>Acceso al episodio activo del paciente</p>

          <label>Acceso
            <select aria-label="Tipo de acceso" disabled={submitting} value={personal ? "personal" : "demo"}
              onChange={event => setPersonal(event.target.value === "personal")}>
              <option value="demo">Demostración por perfil</option>
              <option value="personal">Cuenta personal / administrador de cuentas</option>
            </select>
          </label>
          <form key={String(personal)} onSubmit={onSubmit}>
            <label>
              Usuario
              {personal ? <input name="username" required autoComplete="username" disabled={submitting} maxLength={40} /> : <select disabled={submitting} name="username">
                <option value="recepcion">{clinicalLabel("role", "RECEPTION")}</option>
                <option value="archivo">{clinicalLabel("role", "ADMISSION")}</option>
                <option value="enfermeria">{clinicalLabel("role", "NURSE")}</option>
                <option value="medico">{clinicalLabel("role", "DOCTOR")}</option>
                <option value="laboratorio">{clinicalLabel("role", "LAB")}</option>
                <option value="supervisor">{clinicalLabel("role", "SUPERVISOR")}</option>
              </select>}
            </label>

            <label>
              Contraseña
              <input
                disabled={submitting}
                name="password"
                type="password"
                required
                autoComplete="current-password"
                defaultValue={personal ? "" : "demo123"}
              />
            </label>

            <button type="submit" disabled={submitting}>{submitting ? "Iniciando sesión…" : "Entrar"}</button>
          </form>

          {error && <p className="error">{error}</p>}
          {!personal && <small>Contraseña de demostración: demo123. Solo datos ficticios.</small>}
        </section>
      </main>
  );
}
