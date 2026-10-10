import { afterEach, describe, expect, it, vi } from "vitest";
import { DischargeDraftRecovery, RECOVERY_DURATION_MS } from "./dischargeDraft";

const doctor = { username: 'medico', role: 'DOCTOR' };

describe('Vigencia del borrador en memoria', () => {
  afterEach(() => vi.restoreAllMocks());

  it('preserva el texto y no renueva el plazo ante interrupciones repetidas', () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const draft = new DischargeDraftRecovery();
    draft.track('medico', 42, '  Nota ficticia\nsegunda línea  ');
    draft.suspend();
    now += 10000;
    draft.suspend();
    expect(draft.remainingMs()).toBe(RECOVERY_DURATION_MS - 10000);
    expect(draft.forUser(doctor)?.episodeId).toBe(42);
    expect(draft.take(doctor)).toBe('  Nota ficticia\nsegunda línea  ');
    expect(draft.forUser(doctor)).toBeNull();
  });

  it.each(['vencido', 'reloj retrocede', 'otra identidad', 'otro rol', 'eliminado', 'instancia nueva'])(
    'impide recuperación: %s', (condition) => {
      let now = 1000;
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      let draft = new DischargeDraftRecovery();
      draft.track('medico', 42, 'Ficticio');
      draft.suspend();
      let user = doctor;
      if (condition === 'vencido') now += RECOVERY_DURATION_MS;
      if (condition === 'reloj retrocede') now -= 1;
      if (condition === 'otra identidad') user = { ...doctor, username: 'otro' };
      if (condition === 'otro rol') user = { ...doctor, role: 'NURSE' };
      if (condition === 'eliminado') draft.clear();
      if (condition === 'instancia nueva') draft = new DischargeDraftRecovery();
      expect(draft.forUser(user)).toBeNull();
      expect(draft.take(doctor)).toBeNull();
    },
  );

  it('no conserva notas vacías', () => {
    const draft = new DischargeDraftRecovery();
    draft.track('medico', 42, ' \n ');
    draft.suspend();
    expect(draft.forUser(doctor)).toBeNull();
  });
});
