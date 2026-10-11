import type { FormEvent } from "react";

type NewEpisodePageProps = {
  submitting?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function NewEpisodePage({ onSubmit, submitting = false }: NewEpisodePageProps) {
  return (
    <main className="container narrow">
      <section className="panel">
        <h1>Registrar llegada</h1>

        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Nombre completo
            <input disabled={submitting} name="name" required />
          </label>

          <label>
            Fecha de nacimiento
            <input disabled={submitting} name="birth_date" type="date" required />
          </label>

          <label>
            Documento
            <input disabled={submitting} name="document" required />
          </label>

          <label>
            Prioridad inicial
            <select disabled={submitting} name="priority" defaultValue="3">
              <option value="1">P1 · Crítica</option>
              <option value="2">P2 · Alta</option>
              <option value="3">P3 · Media</option>
              <option value="4">P4 · Baja</option>
              <option value="5">P5 · No urgente</option>
            </select>
          </label>

          <label>
            Ubicación
            <input disabled={submitting} name="location" defaultValue="Recepción" />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? "Registrando llegada…" : "Crear episodio y pulsera"}
          </button>
        </form>
      </section>
    </main>
  );
}
