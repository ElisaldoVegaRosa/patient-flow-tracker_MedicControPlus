import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';
import type { Episode } from './types/clinical';

const initial: Episode = { id: 42, name: 'Paciente ficticio 55', birth_date: '1990-01-01', document: 'TEST55', qr_token: 'qr55', status: 'ACTIVE', priority: 3, location: 'Observación', started_at: '2026-10-12', vitals: [], tasks: [], alerts: [], events: [], triage_version: '"old"', clinical_version: '"clinical-old"' };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
afterEach(() => vi.unstubAllGlobals());

it('restaurar tras 401 mantiene la versión original; revisar datos nuevos conserva todos los campos locales', async () => {
  localStorage.setItem('token', 'ficticio');
  const identity = { username: 'enfermeria', role: 'NURSE' };
  const server = { detail: initial, expire: true };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === '/auth/me') return response(identity);
    if (path === '/auth/login') return response({ ...identity, access_token: 'nueva' });
    if (path === '/dashboard') return response({ active: 1, open_alerts: 0, patients: [server.detail], requested_by: identity.username });
    if (path === '/episodes/42' || path === '/scan/qr55') return response(server.detail);
    if (path === '/episodes/42/triage') {
      if (server.expire) return response({}, 401);
      if (new Headers(init?.headers).get('If-Match') !== server.detail.triage_version) return response({ detail: { code: 'version_conflict', message: 'Datos modificados por otra sesión' } }, 409);
      return response({ ...server.detail, ...JSON.parse(String(init?.body)), triage_version: '"saved"' });
    }
    throw new Error(`Petición inesperada: ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Escanear pulsera' }));
  fireEvent.change(screen.getByPlaceholderText('Token de la pulsera'), { target: { value: 'qr55' } });
  await user.click(screen.getByRole('button', { name: 'Identificar paciente' }));
  fireEvent.change(await screen.findByLabelText('Personal responsable'), { target: { value: 'Responsable local' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar triaje y asignación' }));
  await screen.findByRole('button', { name: 'Entrar' });
  server.expire = false;
  server.detail = { ...initial, priority: 4, location: 'Sala de espera', assigned_to: 'Responsable remoto', triage_version: '"new"' };
  await user.selectOptions(screen.getByRole('combobox', { name: 'Usuario' }), 'enfermeria');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  await user.click(await screen.findByRole('button', { name: 'Restaurar formularios' }));
  expect(screen.getByLabelText('Personal responsable')).toHaveValue('Responsable local');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar triaje y asignación' }));
  await screen.findByRole('region', { name: 'Cambios de otra sesión' });
  const writes = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/triage'));
  expect(new Headers(writes()[1][1]?.headers).get('If-Match')).toBe('"old"');
  await user.click(screen.getByRole('button', { name: 'Consultar cambios actuales' }));
  await user.click(await screen.findByRole('button', { name: 'He revisado los cambios; continuar editando' }));
  expect(screen.getByLabelText('Personal responsable')).toHaveValue('Responsable local');
  expect(screen.getByLabelText('Prioridad')).toHaveValue('3');
  expect(screen.getByLabelText('Área o ubicación')).toHaveValue('Observación');
  expect(writes()).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar triaje y asignación' }));
  await waitFor(() => expect(writes()).toHaveLength(3));
  expect(new Headers(writes()[2][1]?.headers).get('If-Match')).toBe('"new"');
  expect(JSON.parse(String(writes()[2][1]?.body))).toMatchObject({ priority: 3, location: 'Observación', assigned_to: 'Responsable local' });
});

// Isolate existing clinical flows; presence composition has its own integration tests.
vi.mock("./components/EpisodePresence", () => ({ default: () => null }));
