import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Episode } from './types/clinical';
import { RECOVERY_DURATION_MS } from './session/dischargeDraft';

const episode: Episode = {
  id: 42, name: 'Paciente ficticio 37A', birth_date: '1990-01-01',
  document: 'TEST-37A', qr_token: 'qr-37a', status: 'ACTIVE', priority: 3,
  location: 'Observación', started_at: '2026-10-10T12:00:00Z',
  vitals: [], alerts: [], tasks: [], events: [],
};
const response = (data: unknown, status = 200) => ({
  ok: status < 400, status, json: async () => data,
}) as Response;
const note = '  Nota ficticia pendiente.\nControl ambulatorio.  ';

async function prepare(text = note) {
  localStorage.setItem('token', 'anterior');
  const server = {
    user: { username: 'medico', role: 'DOCTOR' },
    detail: response(episode), loginFails: false, networkFails: false,
    dischargeAccepted: false,
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === '/auth/me') return response({ username: 'medico', role: 'DOCTOR' });
    if (path === '/auth/login') return server.loginFails
      ? response({ detail: 'Credenciales inválidas' }, 401)
      : response({ ...server.user, access_token: 'nueva' });
    if (path === '/dashboard') return response({ active: 0, open_alerts: 0, patients: [], requested_by: 'medico' });
    if (path === '/scan/qr-37a') return response(episode);
    if (path === '/episodes/42') {
      if (server.networkFails) throw new Error('Fallo transitorio');
      return server.detail;
    }
    if (path === '/episodes/42/discharge') return server.dischargeAccepted
      ? response({ ...episode, status: 'CLOSED', events: [] })
      : response({ detail: 'Sesión expirada' }, 401);
    if (path === '/auth/logout' && init?.method === 'POST') return response({ ok: true });
    throw new Error(`Petición inesperada: ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Escanear pulsera' }));
  fireEvent.change(screen.getByPlaceholderText('Token de la pulsera'), { target: { value: 'qr-37a' } });
  await user.click(screen.getByRole('button', { name: 'Identificar paciente' }));
  await screen.findByLabelText('Nota de alta');
  fireEvent.change(screen.getByLabelText('Nota de alta'), { target: { value: text } });
  async function expire() {
    // Any protected request can interrupt the session, not only the alta POST.
    fetchMock.mockResolvedValueOnce(response({ detail: 'Sesión expirada' }, 401));
    await user.click(screen.getByRole('button', { name: 'Cerrar episodio · Alta médica' }));
    await screen.findByRole('button', { name: 'Entrar' });
    expect(screen.queryByLabelText('Nota de alta')).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  }
  async function login() {
    await user.selectOptions(screen.getByRole('combobox', { name: 'Usuario' }), 'medico');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
  }
  return { server, fetchMock, user, view, expire, login };
}

describe('Recuperación de nota tras reautenticación', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('ofrece restauración explícita, conserva texto y no reenvía el alta', async () => {
    const { expire, login, user, fetchMock } = await prepare();
    await expire();
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    await login();
    const restore = await screen.findByRole('button', { name: 'Restaurar nota de alta' });
    expect(screen.queryByLabelText('Nota de alta')).not.toBeInTheDocument();
    await user.click(restore);
    expect(await screen.findByLabelText('Nota de alta')).toHaveValue(note);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/discharge'))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/episodes/42'))).toHaveLength(2);
    expect(localStorage.getItem('token')).toBe('nueva');
    expect(localStorage.length).toBe(1);
    expect(sessionStorage.length).toBe(0);
  });

  it('un login fallido conserva el borrador sin exponerlo', async () => {
    const { expire, login, server, user } = await prepare();
    await expire();
    server.loginFails = true;
    await login();
    expect(await screen.findByText('Credenciales inválidas')).toBeVisible();
    expect(screen.queryByLabelText('Nota de alta')).not.toBeInTheDocument();
    server.loginFails = false;
    await login();
    await user.click(await screen.findByRole('button', { name: 'Restaurar nota de alta' }));
    expect(await screen.findByLabelText('Nota de alta')).toHaveValue(note);
  });

  it.each(['Guardar evaluación médica', 'Crear y asignar orden'])(
    'conserva la nota si el 401 procede de %s', async (action) => {
      const { fetchMock, login, user } = await prepare();
      if (action === 'Guardar evaluación médica') {
        fireEvent.change(screen.getByLabelText('Diagnóstico o impresión clínica'), { target: { value: 'Control ficticio' } });
        fireEvent.change(screen.getByLabelText('Nota de evaluación'), { target: { value: 'Evaluación ficticia' } });
      } else fireEvent.change(screen.getByLabelText('Orden o procedimiento solicitado'), { target: { value: 'Orden ficticia' } });
      fetchMock.mockResolvedValueOnce(response({}, 401));
      fireEvent.submit(screen.getByRole('button', { name: action }).closest('form')!);
      await screen.findByRole('button', { name: 'Entrar' });
      await login();
      await user.click(await screen.findByRole('button', { name: 'Restaurar formularios' }));
      expect(await screen.findByLabelText('Nota de alta')).toHaveValue(note);
      expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/discharge'))).toHaveLength(0);
    },
  );

  it.each(['otra identidad', 'otro rol', 'cerrado', 'inexistente', 'vencido'])(
    'elimina el borrador tras comprobar %s', async (condition) => {
      const { expire, login, server } = await prepare();
      await expire();
      if (condition === 'otra identidad') server.user.username = 'otro-medico';
      if (condition === 'otro rol') server.user.role = 'NURSE';
      if (condition === 'cerrado') server.detail = response({ ...episode, status: 'CLOSED' });
      if (condition === 'inexistente') server.detail = response({ detail: 'No existe' }, 404);
      if (condition === 'vencido') vi.spyOn(Date, 'now').mockReturnValue(Date.now() + RECOVERY_DURATION_MS);
      await login();
      await screen.findByRole('heading', { name: 'Centro de control' });
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Recuperación de nota de alta' })).not.toBeInTheDocument());
      expect(screen.queryByLabelText('Nota de alta')).not.toBeInTheDocument();
    },
  );

  it('consulta fallida ofrece reintento y vuelve a comprobar CLOSED al restaurar', async () => {
    const { expire, login, server, user } = await prepare();
    await expire();
    server.networkFails = true;
    await login();
    const retry = await screen.findByRole('button', { name: 'Reintentar recuperación' });
    expect(screen.queryByRole('button', { name: 'Restaurar nota de alta' })).not.toBeInTheDocument();
    server.networkFails = false;
    await user.click(retry);
    const restore = await screen.findByRole('button', { name: 'Restaurar nota de alta' });
    server.detail = response({ ...episode, status: 'CLOSED' });
    await user.click(restore);
    expect(screen.queryByRole('region', { name: 'Recuperación de nota de alta' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nota de alta')).not.toBeInTheDocument();
  });

  it('comprueba el plazo también al confirmar restauración', async () => {
    const { expire, login, user } = await prepare();
    await expire();
    await login();
    const restore = await screen.findByRole('button', { name: 'Restaurar nota de alta' });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + RECOVERY_DURATION_MS);
    await user.click(restore);
    expect(screen.queryByLabelText('Nota de alta')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Recuperación de nota de alta' })).not.toBeInTheDocument();
  });

  it.each(['descartar', 'navegar', 'logout', 'recargar'])(
    'elimina la recuperación al %s', async (action) => {
      const { expire, login, user, view } = await prepare();
      await expire();
      await login();
      await screen.findByRole('button', { name: 'Restaurar nota de alta' });
      if (action === 'descartar') await user.click(screen.getByRole('button', { name: 'Descartar' }));
      if (action === 'navegar') await user.click(screen.getByRole('button', { name: 'Escanear pulsera' }));
      if (action === 'logout') await user.click(screen.getByRole('button', { name: 'Salir' }));
      if (action === 'recargar') {
        view.unmount();
        render(<App />);
        await screen.findByRole('heading', { name: 'Centro de control' });
      }
      expect(screen.queryByRole('region', { name: 'Recuperación de nota de alta' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Nota de alta')).not.toBeInTheDocument();
      if (action === 'logout') expect(localStorage.getItem('token')).toBeNull();
    },
  );

  it('alta exitosa borra la recuperación y no revive la nota', async () => {
    const { expire, login, user, server } = await prepare();
    await expire();
    await login();
    await user.click(await screen.findByRole('button', { name: 'Restaurar nota de alta' }));
    await screen.findByLabelText('Nota de alta');
    server.dischargeAccepted = true;
    await user.click(screen.getByRole('button', { name: 'Cerrar episodio · Alta médica' }));
    expect(await screen.findByRole('status')).toHaveTextContent('solo lectura');
    expect(screen.queryByLabelText('Nota de alta')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Recuperación de nota de alta' })).not.toBeInTheDocument();
  });

  it('un 401 sin borrador vuelve al login y permite volver a entrar', async () => {
    const { user, fetchMock, login } = await prepare('');
    // The empty-note validator never sends alta; interrupt via a harmless refresh.
    await user.click(screen.getByRole('button', { name: 'Centro de control' }));
    fetchMock.mockResolvedValueOnce(response({}, 401));
    await user.click(await screen.findByRole('button', { name: 'Actualizar' }));
    await screen.findByRole('button', { name: 'Entrar' });
    await login();
    await screen.findByRole('heading', { name: 'Centro de control' });
    expect(screen.queryByRole('region', { name: 'Recuperación de nota de alta' })).not.toBeInTheDocument();
  });
});

describe('Protección de orden clínica sin enviar', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const title = 'Orden ficticia 42A';
  function fillOrder() {
    fireEvent.change(screen.getByLabelText('Orden o procedimiento solicitado'), { target: { value: title } });
    fireEvent.change(screen.getByLabelText('Servicio responsable'), { target: { value: 'NURSING' } });
  }

  it.each([
    ['Orden o procedimiento solicitado', title, ''],
    ['Servicio responsable', 'NURSING', 'LAB'],
  ])('detecta cambios en %s y deja de avisar al volver al valor inicial', async (label, value, initial) => {
    const { user } = await prepare('');
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    fireEvent.change(screen.getByLabelText(label), { target: { value: initial } });
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Centro de control' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['Centro de control', 'Historial de episodios', 'Salir'])(
    'cancelar %s conserva la orden y la sesión sin peticiones adicionales', async (destination) => {
      const { user, fetchMock } = await prepare('');
      fillOrder();
      const calls = fetchMock.mock.calls.length;
      await user.click(screen.getByRole('button', { name: destination }));
      expect(screen.getByRole('dialog', { name: 'Cambios médicos sin guardar' })).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
      expect(screen.getByLabelText('Orden o procedimiento solicitado')).toHaveValue(title);
      expect(screen.getByLabelText('Servicio responsable')).toHaveValue('NURSING');
      expect(localStorage.getItem('token')).toBe('anterior');
      expect(fetchMock).toHaveBeenCalledTimes(calls);
    },
  );

  it.each(['Centro de control', 'Salir'])('descartar permite %s sin crear la orden', async (destination) => {
    const { user, fetchMock } = await prepare('');
    fillOrder();
    await user.click(screen.getByRole('button', { name: destination }));
    await user.click(screen.getByRole('button', { name: 'Descartar y salir' }));
    expect(screen.queryByLabelText('Orden o procedimiento solicitado')).not.toBeInTheDocument();
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/tasks'))).toHaveLength(0);
    expect(sessionStorage.length).toBe(0);
    if (destination === 'Salir') expect(localStorage.getItem('token')).toBeNull();
  });

  it('crear con éxito retira el aviso de orden', async () => {
    const { user, fetchMock } = await prepare('');
    fillOrder();
    fetchMock.mockResolvedValueOnce(response(episode));
    await user.click(screen.getByRole('button', { name: 'Crear y asignar orden' }));
    await waitFor(() => expect(screen.getByLabelText('Orden o procedimiento solicitado')).toHaveValue(''));
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Centro de control' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['API', 'red'])('un fallo de %s conserva campos y aviso', async (failure) => {
    const { user, fetchMock } = await prepare('');
    fillOrder();
    if (failure === 'API') fetchMock.mockResolvedValueOnce(response({ detail: 'Error ficticio 42A' }, 422));
    else fetchMock.mockRejectedValueOnce(new Error('Error ficticio 42A'));
    await user.click(screen.getByRole('button', { name: 'Crear y asignar orden' }));
    for (const message of await screen.findAllByText(/Error ficticio 42A/)) expect(message).toBeVisible();
    expect(screen.getByLabelText('Orden o procedimiento solicitado')).toHaveValue(title);
    expect(screen.getByLabelText('Servicio responsable')).toHaveValue('NURSING');
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByRole('dialog', { name: 'Cambios médicos sin guardar' })).toBeVisible();
  });

  it.each(['evaluación', 'nota de alta'])('crear orden mantiene el aviso de %s pendiente', async (pending) => {
    const { user, fetchMock } = await prepare(pending === 'nota de alta' ? note : '');
    if (pending === 'evaluación') {
      fireEvent.change(screen.getByLabelText('Diagnóstico o impresión clínica'), { target: { value: 'Diagnóstico ficticio' } });
    }
    fillOrder();
    fetchMock.mockResolvedValueOnce(response(episode));
    await user.click(screen.getByRole('button', { name: 'Crear y asignar orden' }));
    await waitFor(() => expect(screen.getByLabelText('Orden o procedimiento solicitado')).toHaveValue(''));
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Centro de control' }));
    expect(screen.getByRole('dialog', { name: pending === 'evaluación' ? 'Cambios médicos sin guardar' : 'Nota de alta sin enviar' })).toBeVisible();
  });

  it('guardar evaluación mantiene el aviso de orden pendiente', async () => {
    const { user, fetchMock } = await prepare('');
    fillOrder();
    fireEvent.change(screen.getByLabelText('Diagnóstico o impresión clínica'), { target: { value: 'Diagnóstico ficticio' } });
    fireEvent.change(screen.getByLabelText('Nota de evaluación'), { target: { value: 'Nota ficticia' } });
    fetchMock.mockResolvedValueOnce(response(episode));
    await user.click(screen.getByRole('button', { name: 'Guardar evaluación médica' }));
    await waitFor(() => expect(screen.getByLabelText('Diagnóstico o impresión clínica')).toHaveValue(''));
    expect(screen.getByLabelText('Orden o procedimiento solicitado')).toHaveValue(title);
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByRole('dialog', { name: 'Cambios médicos sin guardar' })).toBeVisible();
  });

  it('un 401 conserva la reautenticación sin recuperar ni reenviar la orden', async () => {
    const { user, fetchMock, login } = await prepare('');
    fillOrder();
    fetchMock.mockResolvedValueOnce(response({}, 401));
    await user.click(screen.getByRole('button', { name: 'Crear y asignar orden' }));
    await screen.findByRole('button', { name: 'Entrar' });
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    await login();
    await screen.findByRole('heading', { name: 'Centro de control' });
    expect(screen.queryByRole('region', { name: 'Recuperación de nota de alta' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/tasks'))).toHaveLength(1);
  });
});

describe('Protección de evaluación médica sin guardar', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const diagnosis = 'Diagnóstico ficticio 41A';

  function fillEvaluation() {
    fireEvent.change(screen.getByLabelText('Diagnóstico o impresión clínica'), { target: { value: diagnosis } });
    fireEvent.change(screen.getByLabelText('Nota de evaluación'), { target: { value: 'Evaluación ficticia pendiente.' } });
    fireEvent.change(screen.getByLabelText('Decisión médica'), { target: { value: 'ORDER_TESTS' } });
  }

  it.each([
    ['Diagnóstico o impresión clínica', diagnosis, ''],
    ['Nota de evaluación', 'Nota ficticia.', ''],
    ['Decisión médica', 'ORDER_TESTS', 'CONTINUE_OBSERVATION'],
  ])('detecta cambios en %s y retira el aviso al volver al valor inicial', async (label, value, initial) => {
    const { user } = await prepare('');
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    fireEvent.change(screen.getByLabelText(label), { target: { value: initial } });
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Centro de control' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['Centro de control', 'Historial de episodios', 'Salir'])(
    'cancelar %s mantiene todos los campos y la sesión', async (destination) => {
      const { user, fetchMock } = await prepare('');
      fillEvaluation();
      const calls = fetchMock.mock.calls.length;
      await user.click(screen.getByRole('button', { name: destination }));
      expect(screen.getByRole('dialog', { name: 'Cambios médicos sin guardar' })).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
      expect(screen.getByLabelText('Diagnóstico o impresión clínica')).toHaveValue(diagnosis);
      expect(screen.getByLabelText('Nota de evaluación')).toHaveValue('Evaluación ficticia pendiente.');
      expect(screen.getByLabelText('Decisión médica')).toHaveValue('ORDER_TESTS');
      expect(localStorage.getItem('token')).toBe('anterior');
      expect(fetchMock).toHaveBeenCalledTimes(calls);
      expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    },
  );

  it('descartar permite salir y elimina el indicador sin persistir la evaluación', async () => {
    const { user } = await prepare('');
    fillEvaluation();
    await user.click(screen.getByRole('button', { name: 'Escanear pulsera' }));
    await user.click(screen.getByRole('button', { name: 'Descartar y salir' }));
    expect(screen.queryByLabelText('Nota de evaluación')).not.toBeInTheDocument();
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    expect(localStorage.length).toBe(1);
    expect(sessionStorage.length).toBe(0);
  });

  it('guardar con éxito retira el aviso de evaluación', async () => {
    const { user, fetchMock } = await prepare('');
    fillEvaluation();
    fetchMock.mockResolvedValueOnce(response(episode));
    await user.click(screen.getByRole('button', { name: 'Guardar evaluación médica' }));
    await waitFor(() => expect(screen.getByLabelText('Diagnóstico o impresión clínica')).toHaveValue(''));
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Centro de control' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['API', 'red'])('un error de %s conserva la evaluación y el aviso', async (failure) => {
    const { user, fetchMock } = await prepare('');
    fillEvaluation();
    if (failure === 'API') fetchMock.mockResolvedValueOnce(response({ detail: 'Error ficticio 41A' }, 422));
    else fetchMock.mockRejectedValueOnce(new Error('Error ficticio 41A'));
    await user.click(screen.getByRole('button', { name: 'Guardar evaluación médica' }));
    for (const message of await screen.findAllByText(/Error ficticio 41A/)) expect(message).toBeVisible();
    expect(screen.getByLabelText('Diagnóstico o impresión clínica')).toHaveValue(diagnosis);
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Centro de control' }));
    expect(screen.getByRole('dialog', { name: 'Cambios médicos sin guardar' })).toBeVisible();
  });

  it('guardar evaluación no elimina la protección de la nota de alta', async () => {
    const { user, fetchMock } = await prepare();
    fillEvaluation();
    fetchMock.mockResolvedValueOnce(response(episode));
    await user.click(screen.getByRole('button', { name: 'Guardar evaluación médica' }));
    await waitFor(() => expect(screen.getByLabelText('Diagnóstico o impresión clínica')).toHaveValue(''));
    expect(screen.getByLabelText('Nota de alta')).toHaveValue(note);
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByRole('dialog', { name: 'Nota de alta sin enviar' })).toBeVisible();
  });

  it('un 401 mantiene la reautenticación sin recuperar la evaluación', async () => {
    const { user, fetchMock, login } = await prepare('');
    fillEvaluation();
    fetchMock.mockResolvedValueOnce(response({}, 401));
    await user.click(screen.getByRole('button', { name: 'Guardar evaluación médica' }));
    await screen.findByRole('button', { name: 'Entrar' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    await login();
    await screen.findByRole('heading', { name: 'Centro de control' });
    expect(screen.queryByRole('region', { name: 'Recuperación de nota de alta' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/medical-evaluation'))).toHaveLength(1);
  });
});

describe('Protección de nota de alta sin enviar', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it.each(['Centro de control', 'Escanear pulsera', 'Historial de episodios', 'Salir'])(
    'cancelar %s conserva la nota y no ejecuta la salida', async (destination) => {
      const { user, fetchMock } = await prepare();
      const calls = fetchMock.mock.calls.length;
      await user.click(screen.getByRole('button', { name: destination }));
      expect(screen.getByRole('dialog', { name: 'Nota de alta sin enviar' })).toBeVisible();
      expect(fetchMock).toHaveBeenCalledTimes(calls);
      await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
      expect(screen.getByLabelText('Nota de alta')).toHaveValue(note);
      expect(localStorage.getItem('token')).toBe('anterior');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(calls);
    },
  );

  it.each(['Centro de control', 'Escanear pulsera', 'Salir'])(
    'descartar permite %s y retira la protección', async (destination) => {
      const { user, fetchMock } = await prepare();
      await user.click(screen.getByRole('button', { name: destination }));
      await user.click(screen.getByRole('button', { name: 'Descartar y salir' }));
      expect(screen.queryByLabelText('Nota de alta')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
      if (destination === 'Salir') {
        await screen.findByRole('button', { name: 'Entrar' });
        expect(localStorage.getItem('token')).toBeNull();
        expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/logout'))).toHaveLength(1);
      }
      expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/discharge'))).toHaveLength(0);
      expect(sessionStorage.length).toBe(0);
    },
  );

  it('protege recarga solo con texto no vacío y elimina el listener al desmontar', async () => {
    const { view } = await prepare();
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    fireEvent.change(screen.getByLabelText('Nota de alta'), { target: { value: '  \n ' } });
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    fireEvent.change(screen.getByLabelText('Nota de alta'), { target: { value: note } });
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    view.unmount();
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
  });

  it('alta exitosa retira el aviso de recarga y permite navegar sin confirmación', async () => {
    const { user, server } = await prepare();
    server.dischargeAccepted = true;
    await user.click(screen.getByRole('button', { name: 'Cerrar episodio · Alta médica' }));
    expect(await screen.findByRole('status')).toHaveTextContent('solo lectura');
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Centro de control' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restaurar tras 401 vuelve a proteger la nota sin bloquear la reautenticación', async () => {
    const { expire, login, user } = await prepare();
    await expire();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    await login();
    await user.click(await screen.findByRole('button', { name: 'Restaurar nota de alta' }));
    expect(await screen.findByLabelText('Nota de alta')).toHaveValue(note);
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByRole('dialog', { name: 'Nota de alta sin enviar' })).toBeVisible();
  });
});

// Isolate existing clinical flows; presence composition has its own integration tests.
vi.mock("./components/EpisodePresence", () => ({ default: () => null }));
