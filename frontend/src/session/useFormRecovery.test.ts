import { FormDraftRecovery } from "./formDrafts";
import { TabDraftStorage } from "./tabDraftStorage";
import { RECOVERY_DURATION_MS } from "./dischargeDraft";
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { establishSession, invalidateSession } from '../api/client';
import { useFormRecovery } from './useFormRecovery';

const lab = { username: 'laboratorio', role: 'LAB' };
const episode = { id: 42, status: 'ACTIVE', tasks: [{ id: 71, service: 'LAB', status: 'PENDING' }] };
const queue = { orders: [{ id: 71, episode_id: 42, status: 'PENDING', episode_status: 'ACTIVE' }] };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
describe('Comprobación actual de recuperación común', () => {
  afterEach(() => { vi.unstubAllGlobals(); invalidateSession(); });
  function setup() {
    establishSession('ficticio');
    const server = { detail: episode, queue, status: 200 };
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => response(String(url).includes('/lab/orders') ? server.queue : server.detail, server.status));
    vi.stubGlobal('fetch', fetchMock);
    const hook = renderHook(() => useFormRecovery());
    act(() => {
      hook.result.current.trackForm(lab, { kind: 'lab', episodeId: 42, taskId: 71, fields: { result: 'Ficticio' } });
      hook.result.current.suspend();
    });
    return { ...hook, server, fetchMock };
  }
  it('consulta episodio y bandeja antes de ofrecer y confirmar sin escribir', async () => {
    const { result, fetchMock } = setup();
    await act(async () => { await result.current.check(lab); });
    expect(result.current.status).toBe('offer');
    await act(async () => { expect(await result.current.check(lab, true)).toMatchObject({ drafts: [{ fields: { result: 'Ficticio' } }] }); });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it.each(['cerrado', 'completado', 'otro servicio', 'fuera de bandeja', '403', '404'])('descarta si cambia %s al confirmar', async condition => {
    const { result, server } = setup();
    await act(async () => { await result.current.check(lab); });
    if (condition === 'cerrado') server.detail = { ...episode, status: 'CLOSED' };
    if (condition === 'completado') server.detail = { ...episode, tasks: [{ ...episode.tasks[0], status: 'COMPLETED' }] };
    if (condition === 'otro servicio') server.detail = { ...episode, tasks: [{ ...episode.tasks[0], service: 'NURSING' }] };
    if (condition === 'fuera de bandeja') server.queue = { orders: [] };
    if (condition === '403' || condition === '404') server.status = Number(condition);
    await act(async () => { expect(await result.current.check(lab, true)).toBeNull(); });
    expect(result.current.status).toBe('idle');
  });
  it('503 permite reintentar sin perder el resultado', async () => {
    const { result, server } = setup();
    server.status = 503;
    await act(async () => { await result.current.check(lab); });
    expect(result.current.status).toBe('retry');
    server.status = 200;
    await act(async () => { expect(await result.current.check(lab, true)).toMatchObject({ drafts: [{ fields: { result: 'Ficticio' } }] }); });
  });
  it('ingreso no necesita episodio existente', async () => {
    const { result, fetchMock } = setup();
    const reception = { username: 'recepcion', role: 'RECEPTION' };
    act(() => { result.current.clear(); result.current.trackForm(reception, { kind: 'arrival', fields: { name: 'Ficticio' } }); result.current.suspend(); });
    await act(async () => { expect(await result.current.check(reception, true)).toMatchObject({ episode: null, drafts: [{ fields: { name: 'Ficticio' } }] }); });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('otra sesión impide restaurar una respuesta tardía', async () => {
    const { result, fetchMock } = setup();
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    let checking!: ReturnType<typeof result.current.check>;
    act(() => { checking = result.current.check(lab, true); });
    establishSession('otra');
    await act(async () => { finish(response(episode)); expect(await checking).toBeNull(); });
  });
  it('recarga conserva la versión original y avisa antes de restaurar datos modificados', async () => {
    const now = Date.now();
    const nurse = { username: 'enfermeria', role: 'NURSE' };
    const journal = new TabDraftStorage('http://localhost:8000');
    new FormDraftRecovery(journal).track(nurse, { kind: 'triage', episodeId: 42, baseVersion: '"old"', fields: { location: 'Triaje' } }, true, now);
    establishSession('actual');
    vi.stubGlobal('fetch', vi.fn(async () => response({ ...episode, triage_version: '"new"' })));
    const { result, unmount } = renderHook(() => useFormRecovery());
    await act(async () => { await result.current.check(nurse); });
    expect(result.current.versionNotice).toContain('Otra sesión modificó');
    await act(async () => {
      expect(await result.current.check(nurse, true)).toMatchObject({ drafts: [{ baseVersion: '"old"', editedAt: now }] });
    });
    unmount();
    expect(new FormDraftRecovery(journal).forUser(nurse)?.drafts[0].editedAt).toBe(now);
  });
  it('retira el contenido caducado mientras la pestaña permanece abierta', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useFormRecovery());
      act(() => result.current.trackForm(lab, { kind: 'lab', episodeId: 42, taskId: 71, fields: { result: 'Prueba' } }));
      expect(sessionStorage.length).toBe(1);
      act(() => vi.advanceTimersByTime(RECOVERY_DURATION_MS));
      expect(sessionStorage.length).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('el cierre de sesión en otra pestaña borra también el borrador local', () => {
    const { result } = renderHook(() => useFormRecovery());
    act(() => result.current.trackForm(lab, { kind: 'lab', episodeId: 42, taskId: 71, fields: { result: 'Prueba' } }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: null })));
    expect(sessionStorage.length).toBe(0);
  });

  it('no restaura una respuesta que llega después de caducar el borrador', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { result, fetchMock } = setup();
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    let checking!: ReturnType<typeof result.current.check>;
    act(() => { checking = result.current.check(lab, true); });
    vi.mocked(Date.now).mockReturnValue(now + RECOVERY_DURATION_MS);
    await act(async () => { finish(response(episode)); expect(await checking).toBeNull(); });
    expect(result.current.status).toBe('idle');
    expect(sessionStorage.length).toBe(0);
  });

});
