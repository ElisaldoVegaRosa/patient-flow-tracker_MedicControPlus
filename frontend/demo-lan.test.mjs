import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createHandler, privateAddress, loadSettings } from "../scripts/demo_lan_gateway.mjs";

const cleanup = [];
afterEach(async () => { for (const action of cleanup.splice(0).reverse()) await action(); });

function directory() {
  const parent = realpathSync(tmpdir());
  const root = mkdtempSync(join(parent, "mediccontrol-lan-"));
  cleanup.push(() => {
    if (dirname(root) !== parent || !basename(root).startsWith("mediccontrol-lan-") || realpathSync(root) !== root) throw new Error("Destino temporal inesperado.");
    rmSync(root, { recursive: true, force: true });
  });
  writeFileSync(join(root, "index.html"), "<h1>Demo ficticio</h1>");
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets", "main.js"), "export default 'ficticio'");
  return root;
}

async function listen(handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return server.address().port;
}

function get(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const call = request({ hostname: "127.0.0.1", port, path, method: options.method ?? "GET",
      headers: { host: "192.168.100.7:5443", ...options.headers } }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    call.on("error", reject);
    call.end(options.body);
  });
}

async function gateway(backendPort = 8000, dist = directory()) {
  return listen(createHandler({ dist, origin: "https://192.168.100.7:5443", backendPort }));
}

it("limita las direcciones a IPv4 RFC1918", () => {
  for (const value of ["192.168.100.7", "10.0.0.1", "172.16.0.1", "172.31.255.254"]) expect(privateAddress(value)).toBe(true);
  for (const value of ["0.0.0.0", "127.0.0.1", "8.8.8.8", "172.32.0.1", "::1", "example.com", "192.168.1.999"]) expect(privateAddress(value)).toBe(false);
});

it("sirve compilacion y rutas de la app con tipos MIME y HEAD", async () => {
  const port = await gateway();
  expect((await get(port, "/")).body).toContain("Demo ficticio");
  const asset = await get(port, "/assets/main.js");
  expect(asset.headers["content-type"]).toContain("javascript");
  expect(asset.headers["cache-control"]).toBe("no-store");
  expect((await get(port, "/episodio", { headers: { accept: "text/html" } })).status).toBe(200);
  expect((await get(port, "/assets/missing.js")).status).toBe(404);
  expect((await get(port, "/assets/main.js", { method: "HEAD" })).body).toBe("");
  expect((await get(port, "/", { method: "POST" })).status).toBe(405);
});

it("deniega host y origen externos antes de acceder al backend", async () => {
  const port = await gateway();
  expect((await get(port, "/api/health", { headers: { host: "externo.example" } })).status).toBe(403);
  expect((await get(port, "/api/health", { headers: { origin: "https://externo.example" } })).status).toBe(403);
});

it("rechaza traversal, escapes invalidos y enlaces fuera de la compilacion", async () => {
  const root = directory();
  const outside = directory();
  symlinkSync(join(outside, "assets"), join(root, "outside"), "junction");
  const port = await gateway(8000, root);
  for (const path of ["/../secret", "/%2e%2e/secret", "/%5csecret", "/%00", "/outside/main.js"]) expect((await get(port, path)).status).toBe(403);
  expect((await get(port, "/%invalid")).status).toBe(400);
  expect((await get(port, "//externo.example")).status).toBe(400);
});

it("conserva cuerpo, version, idempotencia y errores de la API en un destino fijo", async () => {
  let observed;
  const backend = await listen((req, res) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      observed = { url: req.url, method: req.method, headers: req.headers, body };
      res.writeHead(409, { "Content-Type": "application/json", ETag: '"actual"' });
      res.end('{"detail":"Conflicto ficticio"}');
    });
  });
  const port = await gateway(backend);
  const response = await get(port, "/api/episodes/25?mode=demo", { method: "POST", body: '{"reason":"ficticio"}',
    headers: { authorization: "Bearer token-ficticio", "if-match": '"v1"', "idempotency-key": "ficticio", origin: "https://192.168.100.7:5443", "content-type": "application/json" } });
  expect(observed.url).toBe("/episodes/25?mode=demo");
  expect(observed.method).toBe("POST");
  expect(observed.body).toBe('{"reason":"ficticio"}');
  expect(observed.headers.authorization).toBe("Bearer token-ficticio");
  expect(observed.headers["if-match"]).toBe('"v1"');
  expect(observed.headers["idempotency-key"]).toBe("ficticio");
  expect(response.status).toBe(409);
  expect(response.headers.etag).toBe('"actual"');
  expect(response.body).toContain("Conflicto ficticio");
});

it("responde 502 controlado si el backend no esta disponible", async () => {
  const stopped = createServer();
  await new Promise(resolve => stopped.listen(0, "127.0.0.1", resolve));
  const backendPort = stopped.address().port;
  await new Promise(resolve => stopped.close(resolve));
  const port = await gateway(backendPort);
  const response = await get(port, "/api/health");
  expect(response.status).toBe(502);
  expect(JSON.parse(response.body).detail).toContain("No se pudo confirmar la respuesta de la API local");
});

it("mantiene las redirecciones de la API dentro del mismo origen HTTPS", async () => {
  const backend = await listen((_req, res) => {
    res.writeHead(307, { location: "/episodes/?offset=1" });
    res.end();
  });
  const port = await gateway(backend);
  const response = await get(port, "/api/episodes");
  expect(response.status).toBe(307);
  expect(response.headers.location).toBe("https://192.168.100.7:5443/api/episodes/?offset=1");
});

it("rechaza configuraciones publicas o incompletas antes de crear HTTPS", () => {
  const root = directory();
  const config = join(root, "network.json");
  writeFileSync(config, JSON.stringify({ schema: 1, host: "0.0.0.0" }));
  expect(() => loadSettings(config)).toThrow(/invalida/);
  writeFileSync(config, JSON.stringify({ schema: 1, host: "192.168.100.7" }));
  expect(() => loadSettings(config)).toThrow();
});
