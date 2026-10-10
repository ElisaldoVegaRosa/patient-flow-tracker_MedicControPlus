import type { FormEvent } from "react";

type ScanPageProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function ScanPage({ onSubmit }: ScanPageProps) {
  return (
    <main className="container narrow">
      <section className="panel scan-panel">
        <h1>Escanear pulsera</h1>
        <p>Pega el token seguro impreso bajo el QR.</p>

        <form onSubmit={onSubmit}>
          <input
            name="token"
            placeholder="Token de la pulsera"
            required
          />
          <button type="submit">Identificar paciente</button>
        </form>
      </section>
    </main>
  );
}
