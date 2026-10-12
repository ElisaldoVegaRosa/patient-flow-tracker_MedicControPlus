import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { establishSession, invalidateSession, VersionConflictError } from '../api/client';
import { useVersionedWrites } from './useVersionedWrites';
import type { Episode } from '../types/clinical';

const episode = { id: 42, status: 'ACTIVE', priority: 3, location: 'Observación', triage_version: '"new"', clinical_version: '"clinical-new"', tasks: [], alerts: [], events: [], vitals: [] } as unknown as Episode;
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const conflict = response({ detail: { code: 'version_conflict', message: 'Cambios de otra sesión' } }, 409);
const path = '/episodes/42/triage';
const options = { method: 'POST', body: JSON.stringify({ priority: 2, location: 'Triaje' }) };

describe('Escrituras con revisión explícita de conflictos', () => {
  afterEach(() => { vi.unstubAllGlobals(); invalidateSession(); });
  function setup() {
    establishSession('ficticio');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const hook = renderHook(() => useVersionedWrites());
    return { ...hook, fetchMock };
  }
  async function reject(result: ReturnType<typeof setup>['result'], fetchMock: ReturnType<typeof vi.fn>) {
    fetchMock.mockResolvedValueOnce(conflict);
    await act(async () => { await expect(result.current.write(path, options, 42, '"old"')).rejects.toBeInstanceOf(VersionConflictError); });
  }
  it('bloquea reenvío hasta consultar y revisar; cambia versión y clave sin enviar al aceptar', async () => {
    const { result, fetchMock } = setup();
    await reject(result, fetchMock);
    const original = fetchMock.mock.calls[0][1];
    await act(async () => { await expect(result.current.write(path, options, 42, '"new"')).rejects.toBeInstanceOf(VersionConflictError); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response(episode));
    await act(async () => { await result.current.inspect(result.current.conflicts[path]); });
    act(() => { expect(result.current.accept(result.current.conflicts[path])).toBe(true); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockResolvedValueOnce(response(episode));
    await act(async () => { await result.current.write(path, options, 42, '"old"'); });
    const revised = fetchMock.mock.calls[2][1];
    expect(new Headers(original.headers).get('If-Match')).toBe('"old"');
    expect(new Headers(revised.headers).get('If-Match')).toBe('"new"');
    expect(new Headers(revised.headers).get('Idempotency-Key')).not.toBe(new Headers(original.headers).get('Idempotency-Key'));
    expect(revised.body).toBe(options.body);
  });
  it('un cambio de props no renueva una versión capturada al empezar a editar', async () => {
    const { result, fetchMock } = setup();
    act(() => { result.current.remember(path, '"editing"'); });
    fetchMock.mockResolvedValueOnce(response(episode));
    await act(async () => { await result.current.write(path, options, 42, '"new-props"'); });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('If-Match')).toBe('"editing"');
  });
  it('una respuesta perdida reusa clave y versión aunque se actualice otra operación', async () => {
    const { result, fetchMock } = setup();
    fetchMock.mockRejectedValueOnce(new Error('Red'));
    await act(async () => { await expect(result.current.write(path, options, 42, '"old"')).rejects.toThrow('Red'); });
    fetchMock.mockResolvedValueOnce(response(episode));
    await act(async () => { await result.current.write(path, options, 42, '"new"'); });
    expect(fetchMock.mock.calls[1][1].headers).toEqual(fetchMock.mock.calls[0][1].headers);
  });
  it.each(['cerrado', 'completado'])('no permite continuar si el recurso está %s', async condition => {
    const { result, fetchMock } = setup();
    await reject(result, fetchMock);
    const target = condition === 'cerrado' ? path : '/tasks/71/complete';
    if (target !== path) {
      fetchMock.mockResolvedValueOnce(conflict);
      await act(async () => { await expect(result.current.write(target, options, 42, '"old"')).rejects.toBeInstanceOf(VersionConflictError); });
    }
    fetchMock.mockResolvedValueOnce(response(condition === 'cerrado' ? { ...episode, status: 'CLOSED' } : { ...episode, tasks: [{ id: 71, status: 'COMPLETED', version: '"new"' }] }));
    await act(async () => { await result.current.inspect(result.current.conflicts[target]); });
    act(() => { expect(result.current.accept(result.current.conflicts[target])).toBe(false); });
    const count = fetchMock.mock.calls.length;
    await act(async () => { await expect(result.current.write(target, options, 42, '"new"')).rejects.toBeInstanceOf(VersionConflictError); });
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });
  it('conflicto de triaje no bloquea una nueva evaluación', async () => {
    const { result, fetchMock } = setup();
    await reject(result, fetchMock);
    fetchMock.mockResolvedValueOnce(response(episode));
    await act(async () => { await result.current.write('/episodes/42/medical-evaluation', options, 42); });
    expect(result.current.conflicts[path]).toBeDefined();
  });
  it('consulta fallida admite reintento y nunca emite una escritura adicional', async () => {
    const { result, fetchMock } = setup();
    await reject(result, fetchMock);
    fetchMock.mockRejectedValueOnce(new Error('Fallo al consultar'));
    await act(async () => { await result.current.inspect(result.current.conflicts[path]); });
    expect(result.current.conflicts[path].message).toBe('Fallo al consultar');
    fetchMock.mockResolvedValueOnce(response(episode));
    await act(async () => { await result.current.inspect(result.current.conflicts[path]); });
    expect(result.current.conflicts[path].latest?.triage_version).toBe('"new"');
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  });
  it('una consulta tardía no revive un conflicto descartado', async () => {
    const { result, fetchMock } = setup();
    await reject(result, fetchMock);
    let finish!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { finish = resolve; }));
    let checking!: Promise<void>;
    act(() => { checking = result.current.inspect(result.current.conflicts[path]); });
    act(() => result.current.clear());
    await act(async () => { finish(response(episode)); await checking; });
    expect(result.current.conflicts).toEqual({});
  });
});
