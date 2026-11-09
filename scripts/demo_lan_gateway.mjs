import { X509Certificate } from "node:crypto";
import { createReadStream, readFileSync, realpathSync, statSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:https";
import { isIP } from "node:net";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { createSecureContext } from "node:tls";
import { pathToFileURL } from "node:url";

export function privateAddress(host) {
  if (isIP(host) !== 4) return false;
  const [a, b] = host.split(".").map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function inside(root, file) {
  const path = relative(root, file);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export function loadSettings(path) {
  const directory = dirname(resolve(path));
  const settings = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  if (settings.schema !== 1 || !privateAddress(settings.host)) throw new Error("Configuracion LAN invalida.");
  const files = {};
  for (const name of ["server.pfx", "server.cer", "ca.pem", "dist"]) {
    files[name] = realpathSync(resolve(directory, name));
    if (!inside(directory, files[name])) throw new Error("Archivo fuera del directorio LAN.");
  }
  const certificate = new X509Certificate(readFileSync(files["server.cer"]));
  const ca = new X509Certificate(readFileSync(files["ca.pem"]));
  for (const cert of [certificate, ca]) {
    if (Date.parse(cert.validFrom) > Date.now() || Date.parse(cert.validTo) <= Date.now()) throw new Error("Certificado LAN fuera de vigencia.");
  }
  if (!ca.ca || certificate.ca || !certificate.verify(ca.publicKey) || !certificate.checkIP(settings.host)) throw new Error("Certificado LAN incompatible con la direccion o CA.");
  const tls = { pfx: readFileSync(files["server.pfx"]), passphrase: "", minVersion: "TLSv1.2" };
  createSecureContext(tls);
  if (!statSync(resolve(files.dist, "index.html")).isFile()) throw new Error("Falta compilacion LAN.");
  return { host: settings.host, tls, dist: files.dist, origin: `https://${settings.host}:5443`, fingerprint: ca.fingerprint256 };
}

const mimeTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const hopHeaders = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);

function forwardedHeaders(headers) {
  const excluded = new Set([...hopHeaders, ...(headers.connection ?? "").toLowerCase().split(",").map(value => value.trim())]);
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !excluded.has(name)));
}

function sendError(response, status) {
  if (response.headersSent) { response.destroy(); return; }
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  const detail = status === 502 ? "No se pudo confirmar la respuesta de la API local. Consulta el estado del demo." : `Solicitud rechazada por la entrada HTTPS (${status}).`;
  response.end(JSON.stringify({ detail }));
}

export function createHandler({ dist, origin, backendPort = 8000 }) {
  const root = realpathSync(dist);
  const expectedHost = new URL(origin).host;
  return (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    response.setHeader("Cache-Control", "no-store");
    if (request.headers.host !== expectedHost || (request.headers.origin && request.headers.origin !== origin)) {
      sendError(response, 403); return;
    }
    const raw = request.url ?? "/";
    if (!raw.startsWith("/") || raw.startsWith("//")) { sendError(response, 400); return; }
    const queryAt = raw.indexOf("?");
    const pathname = queryAt < 0 ? raw : raw.slice(0, queryAt);
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      const path = (pathname.slice(4) || "/") + (queryAt < 0 ? "" : raw.slice(queryAt));
      const upstream = httpRequest({ hostname: "127.0.0.1", port: backendPort, path,
        agent: false, // Use a direct local connection independently of the global agent.
        method: request.method, headers: { ...forwardedHeaders(request.headers), host: `127.0.0.1:${backendPort}` } }, incoming => {
        const headers = forwardedHeaders(incoming.headers);
        if (headers.location) {
          const target = new URL(headers.location, `http://127.0.0.1:${backendPort}`);
          if (target.origin === `http://127.0.0.1:${backendPort}`) headers.location = `${origin}/api${target.pathname}${target.search}${target.hash}`;
        }
        response.writeHead(incoming.statusCode ?? 502, { ...headers, "Cache-Control": "no-store" });
        incoming.on("error", () => response.destroy());
        incoming.pipe(response);
      });
      upstream.setTimeout(30000, () => upstream.destroy());
      upstream.on("error", () => sendError(response, 502));
      request.on("aborted", () => upstream.destroy());
      response.on("close", () => { if (!response.writableFinished) upstream.destroy(); });
      request.pipe(upstream);
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) { sendError(response, 405); return; }
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { sendError(response, 400); return; }
    if (decoded.includes("\0") || decoded.includes("\\") || decoded.split("/").includes("..")) { sendError(response, 403); return; }
    let file = resolve(root, `.${decoded}`);
    if (!inside(root, file)) { sendError(response, 403); return; }
    try {
      if (statSync(file).isDirectory()) file = resolve(file, "index.html");
      file = realpathSync(file);
      if (!inside(root, file) || !statSync(file).isFile()) { sendError(response, 403); return; }
    } catch {
      if (extname(decoded) || !(request.headers.accept ?? "").includes("text/html")) { sendError(response, 404); return; }
      file = realpathSync(resolve(root, "index.html"));
      if (!inside(root, file)) { sendError(response, 403); return; }
    }
    response.setHeader("Content-Type", mimeTypes[extname(file)] ?? "application/octet-stream");
    if (request.method === "HEAD") { response.end(); return; }
    const stream = createReadStream(file);
    stream.on("error", () => sendError(response, 404));
    stream.pipe(response);
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const check = process.argv[2] === "--check";
    const settings = loadSettings(process.argv[check ? 3 : 2]);
    if (check) {
      console.log(`CA SHA-256: ${settings.fingerprint}`);
    } else {
      const server = createServer(settings.tls, createHandler(settings));
      server.on("error", () => { console.error("No se pudo iniciar la entrada HTTPS LAN."); process.exitCode = 1; });
      server.listen(5443, settings.host, () => console.log(`Demo LAN en ${settings.origin}`));
    }
  } catch {
    console.error("Configuracion, certificado o compilacion LAN invalidos. Revisa la preparacion.");
    process.exitCode = 1;
  }
}
