import { afterEach, expect, it, vi } from "vitest";
import { WRITE_REFERENCE_PREFIX, WriteReferences, writeReferenceOwner } from "./writeReferences";
const owner = "a".repeat(64);
const other = "b".repeat(64);
const key = "reference-test-00001";
const reference = { owner, key, kind: "evaluation" as const, createdAt: 1_000, reviewed: false };
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

it("solo conserva metadatos permitidos y no la clave dentro del contenido", () => {
  const store = new WriteReferences(localStorage);
  store.remember({ ...reference, path: "/episodes/999", body: "Nota clínica", token: "credential", version: "private" } as typeof reference);
  expect(JSON.parse(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)!)).toEqual({ owner, kind: "evaluation", createdAt: 1_000, reviewed: false });
});
it("separa usuario, rol y API sin almacenar sus nombres", async () => {
  const first = await writeReferenceOwner("API-A", { username: "usuario", role: "DOCTOR" });
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(await writeReferenceOwner("API-A", { username: "usuario", role: "DOCTOR" })).toBe(first);
  for (const [api, username, role] of [["API-B", "usuario", "DOCTOR"], ["API-A", "otro", "DOCTOR"], ["API-A", "usuario", "NURSE"]]) expect(await writeReferenceOwner(api, { username, role })).not.toBe(first);
});
it("dos instancias conservan sus claves sin sobrescribir una lista compartida", () => {
  const a = new WriteReferences(localStorage);
  const b = new WriteReferences(localStorage);
  a.remember(reference);
  b.remember({ ...reference, key: key + "2" });
  expect(a.list(owner)).toHaveLength(2);
  a.remove(owner, key);
  expect(b.list(owner).map(item => item.key)).toEqual([key + "2"]);
});
it("aisla propietarios y no elimina referencias de otro usuario", () => {
  const store = new WriteReferences(localStorage);
  store.remember(reference);
  expect(store.list(other)).toEqual([]);
  store.remove(other, key);
  expect(store.list(owner)).toHaveLength(1);
  expect(() => store.remember({ ...reference, owner: other })).toThrow("otra sesión");
});
it("no renueva la fecha ni borra automáticamente referencias antiguas", () => {
  const store = new WriteReferences(localStorage);
  store.remember(reference);
  store.review(owner, key);
  store.remember({ ...reference, createdAt: Date.now() });
  expect(store.list(owner)).toEqual([{ ...reference, reviewed: true }]);
});
it("limita el registro sin desalojar referencias pendientes", () => {
  const store = new WriteReferences(localStorage);
  for (let index = 0; index < 256; index++) store.remember({ ...reference, key: `${key}-${index}` });
  expect(() => store.remember({ ...reference, key: `${key}-overflow` })).toThrow("demasiadas");
  expect(store.list(owner)).toHaveLength(256);
});
it.each(["{", JSON.stringify({ owner, kind: "evaluation", createdAt: 0, reviewed: false }), JSON.stringify({ owner, kind: "evaluation", createdAt: 1_000, reviewed: false, body: "No permitido" })])("rechaza un registro dañado sin borrarlo: %s", raw => {
  localStorage.setItem(WRITE_REFERENCE_PREFIX + key, raw);
  expect(() => new WriteReferences(localStorage).list(owner)).toThrow();
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBe(raw);
});
