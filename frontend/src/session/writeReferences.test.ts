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

it("separa referencias sanas, daño propio y daño sin propietario sin exponer contenido", () => {
  const store = new WriteReferences(localStorage);
  store.remember(reference);
  localStorage.setItem(WRITE_REFERENCE_PREFIX + key + "-damage", JSON.stringify({ owner, kind: "evaluation", createdAt: 0, reviewed: false }));
  localStorage.setItem(WRITE_REFERENCE_PREFIX + key + "-unknown", "{");
  localStorage.setItem(WRITE_REFERENCE_PREFIX + key + "-other", JSON.stringify({ owner: other, createdAt: 0 }));
  expect(store.scan(owner).references).toEqual([reference]);
  expect(store.scan(owner).damaged.map(({ key, consultable }) => ({ key, consultable }))).toEqual([
    { key: key + "-damage", consultable: true }, { key: key + "-unknown", consultable: false },
  ]);
  store.review(owner, key);
  store.remove(owner, key);
  expect(store.scan(owner).references).toEqual([]);
  expect(store.scan(owner).damaged).toHaveLength(2);
});
it("no retira daño cambiado ni daño de otro propietario", () => {
  const store = new WriteReferences(localStorage);
  const raw = JSON.stringify({ owner, createdAt: 0 });
  localStorage.setItem(WRITE_REFERENCE_PREFIX + key, raw);
  expect(() => store.removeConfirmedDamage(other, key, raw)).toThrow();
  localStorage.setItem(WRITE_REFERENCE_PREFIX + key, raw + " ");
  expect(() => store.removeConfirmedDamage(owner, key, raw)).toThrow("cambió");
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBe(raw + " ");
});
it("un identificador inválido nunca es consultable", () => {
  localStorage.setItem(WRITE_REFERENCE_PREFIX + "invalid", JSON.stringify({ owner }));
  expect(new WriteReferences(localStorage).scan(owner).damaged[0].consultable).toBe(false);
});
