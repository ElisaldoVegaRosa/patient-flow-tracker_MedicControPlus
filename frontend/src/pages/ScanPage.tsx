import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { startQrCamera } from "../camera/qrCamera";

type ScanPageProps = { onSubmit: (token: string) => Promise<void> };
const validToken = (value: string) => /^[A-Za-z0-9_-]{1,128}$/.test(value);

export default function ScanPage({ onSubmit }: ScanPageProps) {
  const [token, setToken] = useState("");
  const [camera, setCamera] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const active = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  function stopCamera() {
    active.current?.abort();
    active.current = null;
    setCamera(false);
  }

  useEffect(() => {
    mounted.current = true;
    const stop = () => {
      active.current?.abort();
      active.current = null;
      if (mounted.current) setCamera(false);
    };
    const hidden = () => { if (document.hidden) stop(); };
    const sessionChanged = (event: StorageEvent) => {
      if (event.key === "token" || event.key === null) {
        stop();
        setToken("");
        setNotice("");
      }
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", stop);
    window.addEventListener("storage", sessionChanged);
    return () => {
      mounted.current = false;
      stop();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("storage", sessionChanged);
    };
  }, []);

  async function activate() {
    if (active.current || inFlight.current || !video.current) return;
    const controller = new AbortController();
    active.current = controller;
    setCamera(true);
    setError("");
    setNotice("");
    const finish = () => {
      if (active.current !== controller) return false;
      stopCamera();
      return true;
    };
    try {
      await startQrCamera(video.current, controller.signal, value => {
        if (!finish()) return;
        const captured = value.trim();
        if (!validToken(captured)) {
          setError("El QR no contiene un identificador de pulsera válido. No se consultó ningún episodio.");
          return;
        }
        setToken(captured);
        setNotice("QR capturado. Pulsa Identificar paciente para consultar; después confirma su identidad en la ficha.");
      }, message => { if (finish()) setError(message); });
    } catch (exception) {
      if (finish()) setError((exception as Error).message);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const value = token.trim();
    if (!validToken(value)) {
      setError("Escribe un identificador de pulsera válido, no una dirección web.");
      return;
    }
    stopCamera();
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(value);
    } catch {
      if (mounted.current) setError("No se pudo consultar el episodio. La consulta no se reintentó automáticamente.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <main className="container narrow">
      <section className="panel scan-panel">
        <h1>Escanear pulsera</h1>
        <p>Lee el QR con cámara o pega el identificador impreso bajo el QR.</p>
        <p>La cámara solo se activa al solicitarlo. Las imágenes se procesan en este navegador.</p>
        {camera ? (
          <button type="button" onClick={stopCamera}>Cancelar cámara</button>
        ) : (
          <button type="button" disabled={submitting} onClick={() => void activate()}>Activar cámara</button>
        )}
        <video ref={video} muted playsInline hidden={!camera} aria-label="Vista previa de la cámara"
          style={{ width: "100%", maxHeight: 360, objectFit: "contain" }} />
        {camera && <p role="status">Esperando cámara o buscando un QR. Puedes cancelar en cualquier momento.</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
        <form onSubmit={event => void submit(event)}>
          <label htmlFor="wristband-token">Identificador de la pulsera</label>
          <input id="wristband-token" name="token" placeholder="Token de la pulsera" required
            maxLength={128} autoComplete="off" spellCheck={false} value={token}
            disabled={submitting || camera} onChange={event => { setToken(event.target.value); setNotice(""); }} />
          <button type="submit" disabled={submitting || camera}>
            {submitting ? "Consultando episodio…" : "Identificar paciente"}
          </button>
        </form>
      </section>
    </main>
  );
}
