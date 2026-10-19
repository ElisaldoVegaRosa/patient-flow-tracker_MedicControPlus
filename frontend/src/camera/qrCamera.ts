/** Decode locally. Frames never leave the browser and never trigger API calls. */
export async function startQrCamera(
  video: HTMLVideoElement,
  signal: AbortSignal,
  onRead: (value: string) => void,
  onError: (message: string) => void,
): Promise<void> {
  if (signal.aborted) return;
  if (!window.isSecureContext) throw new Error("La cámara requiere HTTPS o localhost. Puedes usar la entrada manual.");
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no ofrece acceso a cámara. Usa la entrada manual.");
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    signal.removeEventListener("abort", stop);
  };
  signal.addEventListener("abort", stop, { once: true });
  try {
    const { default: decode } = await import("jsqr");
    if (stopped) return;
    const acquired = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
    });
    if (stopped) {
      acquired.getTracks().forEach(track => track.stop());
      return;
    }
    stream = acquired;
    stream.getVideoTracks().forEach(track => track.addEventListener("ended", () => {
      if (!stopped) {
        stop();
        onError("La cámara se desconectó. Puedes volver a activarla o usar la entrada manual.");
      }
    }, { once: true }));
    video.srcObject = stream;
    await video.play();
    if (stopped) return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas no disponible");
    const frame = () => {
      if (stopped) return;
      try {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          const ratio = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
          canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = decode(pixels.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
          if (code?.data) {
            stop();
            onRead(code.data);
            return;
          }
        }
        timer = setTimeout(frame, 250);
      } catch {
        stop();
        onError("No se pudo leer la imagen. Vuelve a activar la cámara o usa la entrada manual.");
      }
    };
    timer = setTimeout(frame, 250);
  } catch (error) {
    const cancelled = stopped;
    stop();
    if (cancelled) return;
    const name = error instanceof DOMException ? error.name : "";
    if (["NotAllowedError", "SecurityError"].includes(name)) {
      throw new Error("Permiso de cámara denegado. Revisa los permisos del navegador o usa la entrada manual.", { cause: error });
    }
    if (["NotFoundError", "OverconstrainedError"].includes(name)) {
      throw new Error("No se encontró una cámara disponible. Puedes usar la entrada manual.", { cause: error });
    }
    throw new Error("No se pudo iniciar la cámara. Comprueba que esté disponible o usa la entrada manual.", { cause: error });
  }
}
