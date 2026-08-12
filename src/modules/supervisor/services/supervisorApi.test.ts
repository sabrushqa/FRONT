import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../../../core/api', () => ({
  default: { get: (...args: unknown[]) => getMock(...args), post: (...args: unknown[]) => postMock(...args) }
}));

import * as supervisorApi from './supervisorApi';

const BASE_SUPERVISOR = 'http://127.0.0.1:8000/api/supervisor';
const BASE_STAFF = 'http://127.0.0.1:8000/api/staff/affiliations';
const BASE_NOTIF = 'http://127.0.0.1:8000/api/notifications';

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
});

describe('appels GET simples', () => {
  it.each([
    ['getNotifications', BASE_NOTIF],
    ['getOverview', `${BASE_SUPERVISOR}/overview`],
    ['getPdvMap', `${BASE_SUPERVISOR}/pdvs/map`],
    ['getTpeStock', `${BASE_SUPERVISOR}/tpes`],
    ['getAffiliationRequests', BASE_STAFF]
  ] as const)('%s appelle GET %s et renvoie res.data', async (fnName, url) => {
    getMock.mockResolvedValue({ data: { ok: fnName } });
    const result = await (supervisorApi[fnName] as () => Promise<unknown>)();
    expect(getMock).toHaveBeenCalledWith(url);
    expect(result).toEqual({ ok: fnName });
  });

  it('getEligibleTpes passe dossierId en query param', async () => {
    getMock.mockResolvedValue({ data: { tpes: [] } });
    await supervisorApi.getEligibleTpes(42);
    expect(getMock).toHaveBeenCalledWith(`${BASE_SUPERVISOR}/tpes/eligible`, { params: { dossierId: 42 } });
  });

  it('getCommercialInteractions cible le bon dossier', async () => {
    getMock.mockResolvedValue({ data: { interactions: [] } });
    await supervisorApi.getCommercialInteractions(7);
    expect(getMock).toHaveBeenCalledWith(`${BASE_STAFF}/7/interactions`);
  });
});

describe('appels POST simples sans corps significatif', () => {
  it.each([
    ['markAllNotificationsAsRead', `${BASE_NOTIF}/read-all`],
    ['regeocoderPdvs', `${BASE_SUPERVISOR}/pdvs/regeocoder`]
  ] as const)('%s appelle POST %s avec un corps vide', async (fnName, url) => {
    postMock.mockResolvedValue({ data: { success: true } });
    const result = await (supervisorApi[fnName] as () => Promise<unknown>)();
    expect(postMock).toHaveBeenCalledWith(url, {});
    expect(result).toEqual({ success: true });
  });
});

describe('actions POST parametrees par id', () => {
  it.each([
    ['deactivateBackOffice', (id: number) => supervisorApi.deactivateBackOffice(id), `${BASE_SUPERVISOR}/back-offices/1/deactivate`],
    ['sendBackOfficeActivation', (id: number) => supervisorApi.sendBackOfficeActivation(id), `${BASE_SUPERVISOR}/back-offices/1/send-activation`],
    ['deactivateCommerciale', (id: number) => supervisorApi.deactivateCommerciale(id), `${BASE_SUPERVISOR}/commerciales/1/deactivate`],
    ['sendCommercialeActivation', (id: number) => supervisorApi.sendCommercialeActivation(id), `${BASE_SUPERVISOR}/commerciales/1/send-activation`],
    ['deactivateCommercant', (id: number) => supervisorApi.deactivateCommercant(id), `${BASE_SUPERVISOR}/commercants/1/deactivate`],
    ['sendCommercantActivation', (id: number) => supervisorApi.sendCommercantActivation(id), `${BASE_SUPERVISOR}/commercants/1/send-activation`],
    ['forwardAffiliationToBackOffice', (id: number) => supervisorApi.forwardAffiliationToBackOffice(id), `${BASE_STAFF}/1/forward-backoffice`]
  ] as const)('%s cible la bonne route', async (_name, call, expectedUrl) => {
    postMock.mockResolvedValue({ data: { success: true } });
    await call(1);
    expect(postMock).toHaveBeenCalledWith(expectedUrl, {});
  });

  it.each([
    ['activateTpe', (id: string) => supervisorApi.activateTpe(id), `${BASE_SUPERVISOR}/tpes/TPE-000001/activate`],
    ['deactivateTpe', (id: string) => supervisorApi.deactivateTpe(id), `${BASE_SUPERVISOR}/tpes/TPE-000001/deactivate`]
  ] as const)('%s cible la bonne route', async (_name, call, expectedUrl) => {
    postMock.mockResolvedValue({ data: { success: true } });
    await call('TPE-000001');
    expect(postMock).toHaveBeenCalledWith(expectedUrl, {});
  });
});

describe('creations et actions avec payload', () => {
  it('createBackOffice envoie le payload complet', async () => {
    const payload = {
      nom: 'Doe', prenom: 'John', email: 'j@d.com', matricule: 'M1', service: 'Sup',
      peutValiderDossiers: true, peutAffecterTpe: false, peutGererReclamations: true
    };
    postMock.mockResolvedValue({ data: { success: true } });
    await supervisorApi.createBackOffice(payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE_SUPERVISOR}/back-offices`, payload);
  });

  it('createCommerciale envoie le payload complet', async () => {
    const payload = { nom: 'Doe', prenom: 'Jane', email: 'j@d.com', matricule: 'M2', region: 'Casablanca', telephone: '0600000000' };
    postMock.mockResolvedValue({ data: { success: true } });
    await supervisorApi.createCommerciale(payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE_SUPERVISOR}/commerciales`, payload);
  });

  it('changePassword envoie le payload de mot de passe', async () => {
    const payload = { currentPassword: 'a', newPassword: 'b', confirmPassword: 'b' };
    postMock.mockResolvedValue({ data: { success: true } });
    await supervisorApi.changePassword(payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE_SUPERVISOR}/change-password`, payload);
  });

  it('assignTpeToCommercant envoie le dossierId dans le corps', async () => {
    postMock.mockResolvedValue({ data: { success: true } });
    await supervisorApi.assignTpeToCommercant('TPE-000005', { dossierId: 99 });
    expect(postMock).toHaveBeenCalledWith(`${BASE_SUPERVISOR}/tpes/TPE-000005/assign-commercant`, { dossierId: 99 });
  });

  it('assignAffiliationToCommerciale envoie le commercialeId dans le corps', async () => {
    postMock.mockResolvedValue({ data: { success: true } });
    await supervisorApi.assignAffiliationToCommerciale(10, { commercialeId: 3 });
    expect(postMock).toHaveBeenCalledWith(`${BASE_SUPERVISOR}/affiliations/10/assign`, { commercialeId: 3 });
  });

  it('addCommercialInteraction poste sur la sous-ressource interactions', async () => {
    const payload = { type: 'APPEL', commentaire: 'RAS' } as never;
    postMock.mockResolvedValue({ data: { interactions: [] } });
    await supervisorApi.addCommercialInteraction(8, payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE_STAFF}/8/interactions`, payload);
  });

  it('reviewAffiliationRequest poste le payload de review', async () => {
    const payload = { approved: true } as never;
    postMock.mockResolvedValue({ data: { success: true } });
    await supervisorApi.reviewAffiliationRequest(4, payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE_STAFF}/4/review`, payload);
  });

  it('completeAffiliationRequest utilise un timeout etendu de 5 minutes', async () => {
    const payload = {} as never;
    postMock.mockResolvedValue({ data: { success: true } });
    await supervisorApi.completeAffiliationRequest(2, payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE_STAFF}/2/complète`, payload, { timeout: 300_000 });
  });
});

describe('createCommercialDraft / saveCommercialDraft (payload JSON vs FormData)', () => {
  it('envoie le payload JSON tel quel quand aucun fichier n\'est fourni', async () => {
    const payload = { nom: 'ACME' } as never;
    postMock.mockResolvedValue({ data: { success: true } });
    await supervisorApi.createCommercialDraft(payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE_STAFF}/drafts`, payload);
  });

  it('construit un FormData quand des fichiers sont fournis', async () => {
    const payload = { nom: 'ACME' } as never;
    const file = new File(['contenu'], 'piece.pdf', { type: 'application/pdf' });
    postMock.mockResolvedValue({ data: { success: true } });

    await supervisorApi.createCommercialDraft(payload, { piece: file });

    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe(`${BASE_STAFF}/drafts`);
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('payload')).toBe(JSON.stringify(payload));
    const attachedFile = (body as FormData).get('piece') as File;
    expect(attachedFile.name).toBe(file.name);
    expect(attachedFile.type).toBe(file.type);
  });

  it('saveCommercialDraft cible le dossier existant', async () => {
    const payload = { nom: 'ACME' } as never;
    postMock.mockResolvedValue({ data: { success: true } });
    await supervisorApi.saveCommercialDraft(3, payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE_STAFF}/3/draft`, payload);
  });
});

describe('telechargements de documents (blob)', () => {
  it.each([
    ['downloadAffiliationDocument', () => supervisorApi.downloadAffiliationDocument(1, 2), `${BASE_STAFF}/1/documents/2/download`],
    ['downloadGeneratedContract', () => supervisorApi.downloadGeneratedContract(1), `${BASE_STAFF}/1/contract/download`],
    ['downloadCommercialReport', () => supervisorApi.downloadCommercialReport(1), `${BASE_STAFF}/1/commercial-report/download`],
    ['downloadSignedContract', () => supervisorApi.downloadSignedContract(1), `${BASE_STAFF}/1/contract/signed/download`],
    ['downloadFullDossier', () => supervisorApi.downloadFullDossier(1), `${BASE_STAFF}/1/full-dossier/download`]
  ] as const)('%s demande un blob a la bonne route', async (_name, call, expectedUrl) => {
    const blob = new Blob(['pdf']);
    getMock.mockResolvedValue({ data: blob });

    const result = await call();

    expect(getMock).toHaveBeenCalledWith(expectedUrl, { responseType: 'blob' });
    expect(result).toBe(blob);
  });
});
