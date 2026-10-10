import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { establishSession, invalidateSession } from '../api/client';
import { RECOVERY_DURATION_MS } from './dischargeDraft';
import { useDischargeRecovery } from './useDischargeRecovery';

const doctor = { username: 'medico', role: 'DOCTOR' };

describe('Eliminación de recuperación pendiente', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); invalidateSession(); });

  it('vence automáticamente en memoria aunque no haya reautenticación', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useDischargeRecovery());
    act(() => { result.current.track('medico', 42, 'Ficticio'); result.current.suspend(); });
    expect(result.current.status).toBe('waiting');
    act(() => vi.advanceTimersByTime(RECOVERY_DURATION_MS));
    expect(result.current.status).toBe('idle');
    await act(async () => { await result.current.check(doctor); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['descartar', 'desmontar'])('una consulta tardía no revive el borrador al %s', async (action) => {
    establishSession('ficticio');
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const { result, unmount } = renderHook(() => useDischargeRecovery());
    act(() => { result.current.track('medico', 42, 'Ficticio'); result.current.suspend(); });
    let checking!: ReturnType<typeof result.current.check>;
    act(() => { checking = result.current.check(doctor, true); });
    if (action === 'descartar') act(() => result.current.clear());
    else unmount();
    let restored: Awaited<typeof checking>;
    await act(async () => {
      finish({ ok: true, status: 200, json: async () => ({ id: 42, status: 'ACTIVE' }) } as Response);
      restored = await checking;
    });
    expect(restored!).toBeNull();
  });
});
