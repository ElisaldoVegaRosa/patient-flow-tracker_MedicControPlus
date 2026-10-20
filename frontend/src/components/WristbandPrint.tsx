import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { api, getSessionRevision, isSessionInterruption } from "../api/client";
import { usePendingOperations } from "../hooks/usePendingOperations";
import type { Episode, User } from "../types/clinical";
import "./WristbandPrint.css";

function eligible(episode: Episode, role: string) {
  return ["NURSE", "SUPERVISOR"].includes(role) && episode.status === "ACTIVE" &&
    episode.events.some(event => event.type === "TRIAGE");
}

function printableData(episode: Episode) {
  return JSON.stringify([episode.id, episode.name, episode.birth_date, episode.document,
    episode.qr_token, episode.identity_status ?? "REGISTERED"]);
}

/** A print preview is a read-only snapshot, never an issuance or delivery receipt. */
export default function WristbandPrint({ episode, user }: { episode: Episode; user: User }) {
  const [preview, setPreview] = useState<Episode | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const operations = usePendingOperations();
  const pending = operations.isPending("wristband-preview");
  const open = preview !== null;

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const root = document.getElementById("root");
    const trigger = opener.current;
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        request.current?.abort();
        setPreview(null);
      }
      if (event.key === "Tab") {
        const buttons = [...document.querySelectorAll<HTMLButtonElement>(".wristband-print-root button")].filter(button => !button.disabled);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      if (root) root.inert = wasInert;
      document.removeEventListener("keydown", escape);
      trigger?.focus();
    };
  }, [open]);

  if (!["NURSE", "SUPERVISOR"].includes(user.role)) return null;

  function close() {
    request.current?.abort();
    setPreview(null);
  }

  async function prepare(print: boolean) {
    if (!eligible(episode, user.role)) return;
    const release = operations.start("wristband-preview");
    if (!release) return;
    const controller = new AbortController();
    request.current = controller;
    const revision = getSessionRevision();
    setError("");
    setMessage("");
    try {
      const latest = await api<Episode>(`/episodes/${episode.id}`, { signal: controller.signal });
      if (controller.signal.aborted || revision !== getSessionRevision()) return;
      if (latest.id !== episode.id || !eligible(latest, user.role) || !latest.qr_token) {
        setPreview(null);
        throw new Error("La pulsera requiere un episodio activo con triaje registrado. Actualiza el episodio.");
      }
      const changed = print && preview && printableData(preview) !== printableData(latest);
      flushSync(() => setPreview(latest));
      if (changed) {
        setMessage("Los datos cambiaron. Revisa la vista actualizada y vuelve a pulsar Imprimir / guardar PDF.");
      } else if (print) {
        window.print();
      }
    } catch (exception) {
      if (!controller.signal.aborted && revision === getSessionRevision()) {
        setPreview(null);
        if (!isSessionInterruption(exception)) setError((exception as Error).message);
      }
    } finally { release(); }
  }

  return <section aria-label="Pulsera imprimible">
    {eligible(episode, user.role) ? <>
      <button ref={opener} type="button" disabled={pending} onClick={() => void prepare(false)}>
        {pending && !open ? "Consultando pulsera…" : "Preparar pulsera / PDF"}
      </button>
      <p>Vista de demostración. Abrir o guardar PDF no registra impresión ni entrega.</p>
    </> : <p>La vista imprimible requiere un episodio activo con triaje registrado.</p>}
    {error && <p role="alert">{error}</p>}
    {preview && createPortal(<div className="wristband-print-root" role="dialog" aria-modal="true" aria-labelledby="wristband-preview-title">
      <div className="wristband-preview-content">
        <div className="wristband-print-controls">
          <h2 id="wristband-preview-title">Vista previa de pulsera · EP-{preview.id}</h2>
          <p>Comprueba la identidad antes de guardar. En el diálogo de impresión elige Guardar como PDF, papel A4 y escala 100 %.</p>
          <p>Plantilla de demostración; las medidas finales dependen de la impresora y la pulsera elegidas.</p>
          {message && <p role="status">{message}</p>}
          <button type="button" disabled={pending} onClick={() => void prepare(true)}>{pending ? "Comprobando datos…" : "Imprimir / guardar PDF"}</button>{" "}
          <button ref={closeButton} type="button" onClick={close}>Cerrar vista previa</button>
        </div>
        <article className="wristband-sheet" aria-label="Contenido de la pulsera">
          <div className="wristband-identity">
            <p className="wristband-brand">MedicControl+ · EP-{preview.id}</p>
            <h3>{preview.name}</h3>
            <p>Nacimiento: {preview.birth_date ?? "No registrado"}</p>
            <p>Documento: {preview.document ?? "No registrado"}</p>
            <p className="wristband-status">{preview.identity_status === "PROVISIONAL" ? "IDENTIDAD PROVISIONAL · POR VERIFICAR" : preview.identity_status === "VERIFIED" ? "Identidad verificada por admisión/archivo" : "Datos registrados · sin constancia de verificación por archivo"}</p>
            <small>DEMO · No acredita entrega de pulsera ni atención.</small>
          </div>
          <div className="wristband-qr"><QRCodeSVG value={preview.qr_token} size={128} level="M" marginSize={4} title={`QR del episodio EP-${preview.id}`} /></div>
        </article>
      </div>
    </div>, document.body)}
  </section>;
}
