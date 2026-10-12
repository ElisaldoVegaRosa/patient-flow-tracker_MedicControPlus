const configuredTimeout = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS);
export const REQUEST_TIMEOUT_MS = Number.isSafeInteger(configuredTimeout) && configuredTimeout > 0 && configuredTimeout <= 2_147_483_647 ? configuredTimeout : 30_000;

export class RequestTimeoutError extends Error {
  constructor() { super("Se agotó el tiempo de espera de la solicitud. Puedes volver a consultar."); }
}

/** One budget covers headers and body; rejection also works if a transport ignores abort. */
export function requestLifetime(external?: AbortSignal | null) {
  const controller = new AbortController();
  let failure: Error | undefined;
  let reject!: (error: Error) => void;
  const interrupted = new Promise<never>((_, fail) => { reject = fail; });
  // Cancellation can precede the first await (e.g. an already aborted signal).
  void interrupted.catch(() => {});
  const cancel = (error: Error) => {
    if (failure) return;
    failure = error;
    reject(error);
    controller.abort(error);
  };
  const externalAbort = () => cancel(new DOMException("La solicitud fue cancelada.", "AbortError"));
  external?.addEventListener("abort", externalAbort, { once: true });
  if (external?.aborted) externalAbort();
  const timer = setTimeout(() => cancel(new RequestTimeoutError()), REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    cancel,
    async wait<T>(action: () => Promise<T>): Promise<T> {
      if (failure) throw failure;
      return Promise.race([action(), interrupted]);
    },
    dispose() { clearTimeout(timer); external?.removeEventListener("abort", externalAbort); },
  };
}
