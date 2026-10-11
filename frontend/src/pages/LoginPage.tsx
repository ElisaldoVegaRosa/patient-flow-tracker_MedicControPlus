import type { FormEvent } from "react";

type LoginPageProps = {
  submitting?: boolean;
  restoringSession: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function LoginPage({ restoringSession, error, onSubmit, submitting = false }: LoginPageProps) {
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

          <form onSubmit={onSubmit}>
            <label>
              Usuario
              <select disabled={submitting} name="username">
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
                disabled={submitting}
                name="password"
                type="password"
                defaultValue="demo123"
              />
            </label>

            <button type="submit" disabled={submitting}>{submitting ? "Iniciando sesión…" : "Entrar"}</button>
          </form>

          {error && <p className="error">{error}</p>}
          <small>Contraseña de demostración: demo123</small>
        </section>
      </main>
  );
}
