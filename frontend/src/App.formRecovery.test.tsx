import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Episode, LaboratoryQueue } from './types/clinical';

const episode: Episode = {
  id: 42, name: 'Paciente ficticio 54', birth_date: '1990-01-01', document: 'TEST-54',
  qr_token: 'qr54', status: 'ACTIVE', triage_version: '"triage-old"', priority: 3, location: 'Observación',
  started_at: '2026-10-12T12:00:00Z', vitals: [], alerts: [], events: [],
  tasks: [{ id: 71, episode_id: 42, title: 'Hemograma', service: 'LAB', status: 'PENDING', result: null }],
};
const queue: LaboratoryQueue = {
  total: 1, status_filter: 'PENDING', requested_by: 'laboratorio', orders: [{
    ...episode.tasks[0], created_at: '2026-10-12T12:00:00Z', patient_name: episode.name,
    priority: 3, location: episode.location, episode_status: 'ACTIVE',
  }],
};
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;

describe('Recuperación de todos los formularios en App', () => {
  afterEach(() => vi.unstubAllGlobals());
  async function setup(role = 'DOCTOR', username = 'medico') {
    localStorage.setItem('token', 'anterior');
    const server = { writesFail: true, refreshFails: false };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === '/auth/me') return response({ username, role });
      if (path === '/auth/login') return response({ username, role, access_token: 'nueva' });
      if (path === '/dashboard') return server.refreshFails ? response({}, 401) : response({ active: 1, open_alerts: 0, patients: [episode], requested_by: username });
      if (init?.method === 'POST' || init?.method === 'PATCH') return response(episode, server.writesFail ? 401 : 200);
      if (path === '/lab/orders') return server.refreshFails ? response({}, 401) : response(queue);
      if (path === '/episodes/42' || path === '/scan/qr54') return response(episode);
      throw new Error(`Petición inesperada: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const view = render(<App />);
    await screen.findByRole('heading', { name: 'Centro de control' });
    async function openEpisode() {
      await user.click(screen.getByRole('button', { name: 'Escanear pulsera' }));
      fireEvent.change(screen.getByPlaceholderText('Token de la pulsera'), { target: { value: 'qr54' } });
      await user.click(screen.getByRole('button', { name: 'Identificar paciente' }));
      await screen.findByText('Paciente ficticio 54');
    }
    async function relogin() {
      await screen.findByRole('button', { name: 'Entrar' });
      await user.selectOptions(screen.getByRole('combobox', { name: 'Usuario' }), username);
      await user.click(screen.getByRole('button', { name: 'Entrar' }));
    }
    async function restore() {
      await relogin();
      const restoreButton = await screen.findByRole('button', { name: 'Restaurar formularios' });
      await user.click(restoreButton);
    }
    return { server, fetchMock, user, openEpisode, relogin, restore, ...view };
  }
  function change(kind: string, field: string, value: string) {
    const form = document.querySelector<HTMLFormElement>(`form[data-draft-kind="${kind}"]`)!;
    fireEvent.change(form.elements.namedItem(field) as Element, { target: { value } });
  }
  function submit(kind: string) { fireEvent.submit(document.querySelector(`form[data-draft-kind="${kind}"]`)!); }
  function writes(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls.filter(([, init]) => init?.method && !String(init?.body).includes('password'));
  }

  it.each([
    ['arrival', 'RECEPTION', 'recepcion', 'name', 'Ingreso tras recarga'],
    ['triage', 'NURSE', 'enfermeria', 'location', 'Sala de espera'],
    ['vitals', 'NURSE', 'enfermeria', 'temperature', '38.2'],
    ['evaluation', 'DOCTOR', 'medico', 'clinical_note', 'Nota tras recarga'],
    ['order', 'DOCTOR', 'medico', 'title', 'Orden tras recarga'],
    ['lab', 'LAB', 'laboratorio', 'result', 'Resultado tras recarga'],
    ['discharge', 'DOCTOR', 'medico', 'note', 'Alta tras recarga'],
  ])('recarga %s y ofrece restauración explícita sin enviar', async (kind, role, username, field, value) => {
    const { user, openEpisode, unmount, fetchMock } = await setup(role, username);
    if (kind === 'arrival') await user.click(screen.getByRole('button', { name: 'Nuevo ingreso' }));
    else if (kind === 'lab') { await user.click(screen.getByRole('button', { name: 'Bandeja de laboratorio' })); await screen.findByLabelText('Resultado de laboratorio'); }
    else await openEpisode();
    change(kind, field, value);
    expect(sessionStorage.length).toBe(1);
    unmount();
    render(<App />);
    const restore = await screen.findByRole('button', { name: kind === 'discharge' ? 'Restaurar nota de alta' : 'Restaurar formularios' });
    expect(document.querySelector(`form[data-draft-kind="${kind}"]`)).not.toBeInTheDocument();
    await user.click(restore);
    await waitFor(() => {
      const form = document.querySelector<HTMLFormElement>(`form[data-draft-kind="${kind}"]`)!;
      expect(form.elements.namedItem(field)).toHaveValue(kind === 'vitals' ? Number(value) : value);
    });
    expect(writes(fetchMock)).toHaveLength(0);
    expect(sessionStorage.length).toBe(1);
  });

  it('revalida el estado tras recargar y descarta un episodio ya cerrado', async () => {
    const { openEpisode, unmount, fetchMock } = await setup();
    await openEpisode();
    change('evaluation', 'clinical_note', 'Texto sin enviar');
    unmount();
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => new URL(String(input)).pathname === '/episodes/42' ? response({ ...episode, status: 'CLOSED' }) : original(input, init));
    render(<App />);
    await screen.findByRole('heading', { name: 'Centro de control' });
    await waitFor(() => expect(sessionStorage.length).toBe(0));
    expect(screen.queryByRole('button', { name: 'Restaurar formularios' })).not.toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(0);
  });

  it('tras recarga envía If-Match original y exige revisión ante conflicto', async () => {
    const { openEpisode, unmount, fetchMock, user } = await setup('NURSE', 'enfermeria');
    await openEpisode();
    change('triage', 'location', 'Triaje');
    change('triage', 'assigned_to', 'Prueba ficticia');
    unmount();
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === '/episodes/42') return response({ ...episode, triage_version: '"triage-new"' });
      if (path.endsWith('/triage')) {
        expect(new Headers(init?.headers).get('If-Match')).toBe('"triage-old"');
        return response({ detail: { code: 'version_conflict', message: 'Otra sesión modificó estos datos.' } }, 409);
      }
      return original(input, init);
    });
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Restaurar formularios' }));
    submit('triage');
    expect(await screen.findByText('Datos modificados durante la edición')).toBeVisible();
    expect(writes(fetchMock)).toHaveLength(1);
    expect(sessionStorage.length).toBe(1);
  });

  it.each([
    ['triage', 'NURSE', 'enfermeria', 'location', 'Sala de espera'],
    ['vitals', 'NURSE', 'enfermeria', 'temperature', '38.2'],
    ['evaluation', 'DOCTOR', 'medico', 'diagnosis', 'Diagnóstico ficticio'],
    ['order', 'DOCTOR', 'medico', 'title', 'Orden ficticia'],
  ])('restaura %s con valores exactos sin reenviar', async (kind, role, username, field, value) => {
    const { openEpisode, restore, fetchMock } = await setup(role, username);
    await openEpisode();
    change(kind, field, value);
    if (kind === 'triage') change(kind, 'assigned_to', 'Enfermería ficticia');
    if (kind === 'evaluation') change(kind, 'clinical_note', 'Nota ficticia');
    submit(kind);
    await restore();
    const form = document.querySelector<HTMLFormElement>(`form[data-draft-kind="${kind}"]`)!;
    await waitFor(() => expect(form.elements.namedItem(field)).toHaveValue(kind === 'vitals' ? Number(value) : value));
    expect(writes(fetchMock)).toHaveLength(1);
    expect(localStorage.length).toBe(1);
    expect(sessionStorage.length).toBe(1);
  });

  it('restaura ingreso y retira el borrador al confirmar el alta de ingreso antes de un GET 401', async () => {
    const { user, restore, relogin, server, fetchMock } = await setup('RECEPTION', 'recepcion');
    await user.click(screen.getByRole('button', { name: 'Nuevo ingreso' }));
    change('arrival', 'name', 'Paciente ficticio');
    change('arrival', 'birth_date', '1990-01-01');
    change('arrival', 'document', 'DEMO54');
    change('arrival', 'priority', '2');
    submit('arrival');
    await restore();
    expect(await screen.findByLabelText('Nombre completo')).toHaveValue('Paciente ficticio');
    expect(screen.getByLabelText('Prioridad inicial')).toHaveValue('2');
    expect(writes(fetchMock)).toHaveLength(1);
    server.writesFail = false;
    server.refreshFails = true;
    submit('arrival');
    await screen.findByRole('button', { name: 'Entrar' });
    server.refreshFails = false;
    await relogin();
    await screen.findByRole('heading', { name: 'Centro de control' });
    expect(screen.queryByRole('button', { name: 'Restaurar formularios' })).not.toBeInTheDocument();
  });

  it('restaura resultado de laboratorio y no lo revive si el PATCH fue confirmado y luego GET falla', async () => {
    const { user, restore, relogin, server, fetchMock } = await setup('LAB', 'laboratorio');
    await user.click(screen.getByRole('button', { name: 'Bandeja de laboratorio' }));
    await screen.findByLabelText('Resultado de laboratorio');
    change('lab', 'result', 'Resultado ficticio');
    submit('lab');
    await restore();
    expect(await screen.findByLabelText('Resultado de laboratorio')).toHaveValue('Resultado ficticio');
    expect(writes(fetchMock)).toHaveLength(1);
    server.writesFail = false;
    server.refreshFails = true;
    submit('lab');
    await screen.findByRole('button', { name: 'Entrar' });
    server.refreshFails = false;
    await relogin();
    await screen.findByRole('heading', { name: 'Centro de control' });
    expect(screen.queryByRole('button', { name: 'Restaurar formularios' })).not.toBeInTheDocument();
  });

  it('restaura evaluación, orden y nota juntas; guardar una no sobrescribe las otras', async () => {
    const { openEpisode, restore, server, user } = await setup();
    await openEpisode();
    change('evaluation', 'diagnosis', 'Diagnóstico ficticio');
    change('evaluation', 'clinical_note', 'Nota ficticia');
    change('order', 'title', 'Orden ficticia');
    fireEvent.change(screen.getByLabelText('Nota de alta'), { target: { value: 'Alta ficticia' } });
    submit('evaluation');
    await restore();
    expect(screen.getByLabelText('Nota de alta')).toHaveValue('Alta ficticia');
    change('order', 'title', 'Orden corregida después de restaurar');
    server.writesFail = false;
    submit('evaluation');
    await screen.findByText('Evaluación guardada');
    expect(screen.getByLabelText('Orden o procedimiento solicitado')).toHaveValue('Orden corregida después de restaurar');
    server.writesFail = true;
    submit('order');
    await restore();
    expect(screen.getByLabelText('Orden o procedimiento solicitado')).toHaveValue('Orden corregida después de restaurar');
    expect(screen.getByLabelText('Diagnóstico o impresión clínica')).toHaveValue('');
    expect(screen.getByLabelText('Nota de alta')).toHaveValue('Alta ficticia');
    await user.click(screen.getByRole('button', { name: 'Centro de control' }));
    expect(screen.getByRole('dialog', { name: 'Cambios médicos sin guardar' })).toBeVisible();
  });
});

// Isolate existing clinical flows; presence composition has its own integration tests.
vi.mock("./components/EpisodePresence", () => ({ default: () => null }));
