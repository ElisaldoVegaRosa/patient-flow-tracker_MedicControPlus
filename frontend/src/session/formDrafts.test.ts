import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormDraftRecovery } from './formDrafts';
import type { DraftKind } from './formDrafts';
import { RECOVERY_DURATION_MS } from './dischargeDraft';

const doctor = { username: 'medico', role: 'DOCTOR' };
describe('Política común de borradores', () => {
  afterEach(() => vi.restoreAllMocks());
  it.each<[DraftKind, string]>([
    ['arrival', 'RECEPTION'], ['triage', 'NURSE'], ['vitals', 'NURSE'],
    ['evaluation', 'DOCTOR'], ['order', 'DOCTOR'], ['lab', 'LAB'], ['discharge', 'DOCTOR'],
  ])('conserva %s para su identidad y rol sin persistencia', (kind, role) => {
    const store = new FormDraftRecovery();
    const user = { username: 'demo', role };
    const fields = { text: 'Ficticio' };
    store.track(user, { kind, fields });
    fields.text = 'Cambio externo';
    store.suspend();
    expect(store.forUser(user)?.drafts[0].fields.text).toBe('Ficticio');
    store.forUser(user)!.drafts[0].fields.text = 'Otra copia';
    expect(store.forUser(user)?.drafts[0].fields.text).toBe('Ficticio');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it('conserva varios formularios y retira solo el guardado confirmado', () => {
    const store = new FormDraftRecovery();
    for (const kind of ['evaluation', 'order', 'discharge'] as const) store.track(doctor, { kind, episodeId: 42, fields: { text: kind } });
    store.remove('evaluation', 42);
    store.suspend();
    expect(store.forUser(doctor)?.drafts.map(draft => draft.kind)).toEqual(['order', 'discharge']);
    store.remove('order', 42);
    expect(store.forUser(doctor)?.drafts.map(draft => draft.kind)).toEqual(['discharge']);
  });
  it('volver al original elimina el borrador y un rol ajeno no lo captura', () => {
    const store = new FormDraftRecovery();
    store.track(doctor, { kind: 'evaluation', fields: { text: 'Ficticio' } });
    store.track(doctor, { kind: 'evaluation', fields: {} }, false);
    store.track(doctor, { kind: 'arrival', fields: { text: 'Ficticio' } });
    store.suspend();
    expect(store.forUser(doctor)).toBeNull();
  });
  it.each([{ ...doctor, username: 'otro' }, { ...doctor, role: 'NURSE' }])('descarta otra identidad o rol', user => {
    const store = new FormDraftRecovery();
    store.track(doctor, { kind: 'order', fields: { title: 'Ficticio' } });
    store.suspend();
    expect(store.forUser(user)).toBeNull();
    expect(store.forUser(doctor)).toBeNull();
  });
  it('otra interrupción no renueva treinta minutos', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const store = new FormDraftRecovery();
    store.track(doctor, { kind: 'order', fields: { title: 'Ficticio' } });
    store.suspend();
    vi.mocked(Date.now).mockReturnValue(now + RECOVERY_DURATION_MS - 1);
    store.suspend();
    expect(store.remainingMs()).toBe(1);
    vi.mocked(Date.now).mockReturnValue(now + RECOVERY_DURATION_MS);
    expect(store.forUser(doctor)).toBeNull();
  });
});
