import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const patchMock = vi.fn();

vi.mock('../../../core/api', () => ({
  default: { get: (...args: unknown[]) => getMock(...args), patch: (...args: unknown[]) => patchMock(...args) }
}));

import * as reclamationsApi from './reclamationsApi';

const BASE = 'http://127.0.0.1:8000/api/backoffice/reclamations';

beforeEach(() => {
  getMock.mockReset();
  patchMock.mockReset();
});

describe('getReclamations', () => {
  it('appelle la route de base sans parametres', async () => {
    getMock.mockResolvedValue({ data: [] });
    await reclamationsApi.getReclamations();
    expect(getMock).toHaveBeenCalledWith(BASE);
  });

  it('ajoute uniquement les parametres fournis a la query string', async () => {
    getMock.mockResolvedValue({ data: [] });
    await reclamationsApi.getReclamations({ statut: 'EN_COURS' });
    expect(getMock).toHaveBeenCalledWith(`${BASE}?statut=EN_COURS`);
  });

  it('combine plusieurs parametres dans la query string', async () => {
    getMock.mockResolvedValue({ data: [] });
    await reclamationsApi.getReclamations({ statut: 'EN_COURS', priorite: 'HAUTE', type: 'MATERIEL' });
    const calledUrl = getMock.mock.calls[0][0] as string;
    const query = new URLSearchParams(calledUrl.split('?')[1]);
    expect(query.get('statut')).toBe('EN_COURS');
    expect(query.get('priorite')).toBe('HAUTE');
    expect(query.get('type')).toBe('MATERIEL');
  });

  it('renvoie la liste de reclamations', async () => {
    getMock.mockResolvedValue({ data: [{ idReclamation: 1 }] });
    const result = await reclamationsApi.getReclamations();
    expect(result).toEqual([{ idReclamation: 1 }]);
  });
});

describe('getReclamationStats', () => {
  it('appelle la route /stats', async () => {
    getMock.mockResolvedValue({ data: { total: 5 } });
    const result = await reclamationsApi.getReclamationStats();
    expect(getMock).toHaveBeenCalledWith(`${BASE}/stats`);
    expect(result).toEqual({ total: 5 });
  });
});

describe('getReclamationDashboard', () => {
  it('appelle /dashboard sans parametres', async () => {
    getMock.mockResolvedValue({ data: { parJour: [], parEtat: {}, enRetardCount: 0, enRetard: [] } });
    await reclamationsApi.getReclamationDashboard();
    expect(getMock).toHaveBeenCalledWith(`${BASE}/dashboard`);
  });

  it('ajoute days et type a la query string quand fournis', async () => {
    getMock.mockResolvedValue({ data: { parJour: [], parEtat: {}, enRetardCount: 0, enRetard: [] } });
    await reclamationsApi.getReclamationDashboard({ days: 30, type: 'RESEAU' });
    expect(getMock).toHaveBeenCalledWith(`${BASE}/dashboard?days=30&type=RESEAU`);
  });

  it('omet days quand il vaut 0 (falsy)', async () => {
    getMock.mockResolvedValue({ data: { parJour: [], parEtat: {}, enRetardCount: 0, enRetard: [] } });
    await reclamationsApi.getReclamationDashboard({ days: 0 });
    expect(getMock).toHaveBeenCalledWith(`${BASE}/dashboard`);
  });
});

describe('updateReclamationStatut', () => {
  it('envoie une requete PATCH avec le nouveau statut', async () => {
    patchMock.mockResolvedValue({ data: { idReclamation: 4, statut: 'RESOLU' } });
    const result = await reclamationsApi.updateReclamationStatut(4, 'RESOLU');
    expect(patchMock).toHaveBeenCalledWith(`${BASE}/4/statut`, { statut: 'RESOLU' });
    expect(result).toEqual({ idReclamation: 4, statut: 'RESOLU' });
  });
});
