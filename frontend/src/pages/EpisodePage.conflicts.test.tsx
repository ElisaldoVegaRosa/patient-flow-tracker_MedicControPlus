import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EpisodePage from './EpisodePage';
import type { Episode } from '../types/clinical';
import { establishSession } from '../api/client';

const episode: Episode = { id: 42, name: 'Paciente ficticio 55', birth_date: '1990-01-01', document: 'TEST55', qr_token: 'qr55', status: 'ACTIVE', priority: 3, location: 'Observación', started_at: '2026-10-12', vitals: [], tasks: [], alerts: [], events: [], triage_version: '"old"', clinical_version: '"old-clinical"' };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const rejected = response({ detail: { code: 'version_conflict', message: 'Cambios de otra sesión' } }, 409);

describe('Revisión de datos concurrentes en el episodio', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('conserva triaje local, consulta, exige revisión y envía únicamente al guardar otra vez', async () => {
    establishSession('ficticio');
    const fetchMock = vi.fn().mockResolvedValueOnce(rejected);
    vi.stubGlobal('fetch', fetchMock);
    const update = vi.fn();
    render(<EpisodePage episode={episode} user={{ username: 'enfermeria', role: 'NURSE', access_token: 'ficticio' }} updateEpisode={update} showError={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Personal responsable'), { target: { value: 'Responsable local' } });
    fireEvent.change(screen.getByLabelText('Área o ubicación'), { target: { value: 'Triaje' } });
    const save = screen.getByRole('button', { name: 'Guardar triaje y asignación' });
    fireEvent.click(save);
    await screen.findByRole('region', { name: 'Cambios de otra sesión' });
    expect(screen.getByLabelText('Personal responsable')).toHaveValue('Responsable local');
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(save);
    await waitFor(() => expect(save).toBeEnabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({ ...episode, location: 'Sala de espera', assigned_to: 'Responsable remoto', triage_version: '"new"' }));
    fireEvent.click(screen.getByRole('button', { name: 'Consultar cambios actuales' }));
    const accept = await screen.findByRole('button', { name: 'He revisado los cambios; continuar editando' });
    expect(screen.getByText(/Responsable remoto/)).toBeVisible();
    expect(screen.getByText(/Estado actual: Activo\./)).toBeVisible();
    fireEvent.click(accept);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Personal responsable')).toHaveValue('Responsable local');
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(save);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('If-Match')).toBe('"new"');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).assigned_to).toBe('Responsable local');
  });
  it('alta conserva nota y muestra episodio cerrado sin ofrecer continuar', async () => {
    establishSession('ficticio');
    const fetchMock = vi.fn().mockResolvedValueOnce(rejected).mockResolvedValueOnce(response({ ...episode, status: 'CLOSED' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<EpisodePage episode={episode} user={{ username: 'medico', role: 'DOCTOR', access_token: 'ficticio' }} updateEpisode={vi.fn()} showError={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nota de alta'), { target: { value: 'Nota local ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar episodio · Alta médica' }));
    await screen.findByRole('region', { name: 'Cambios de otra sesión' });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar cambios actuales' }));
    await screen.findByText(/Este recurso ya no admite/);
    expect(screen.getByText(/Estado actual: Cerrado\./)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'He revisado los cambios; continuar editando' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nota de alta')).toHaveValue('Nota local ficticia');
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('If-Match')).toBe('"old-clinical"');
  });
});
