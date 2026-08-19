import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../../../core/api', () => ({
  default: { get: (...args: unknown[]) => getMock(...args), post: (...args: unknown[]) => postMock(...args) }
}));

import * as commercantApi from './commercantApi';

const BASE_CONTRACTS = 'http://127.0.0.1:8000/api/commercant/contracts';
const BASE_WORKSPACE = 'http://127.0.0.1:8000/api/commercant/workspace';

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
});

describe('contrats', () => {
  it('getLatestContract recupere le dernier contrat', async () => {
    getMock.mockResolvedValue({ data: { dossierId: 1, dossierStatus: 'ACTIF' } });
    const result = await commercantApi.getLatestContract();
    expect(getMock).toHaveBeenCalledWith(`${BASE_CONTRACTS}/latest`);
    expect(result).toEqual({ dossierId: 1, dossierStatus: 'ACTIF' });
  });

  it('downloadLatestContract demande un blob', async () => {
    const blob = new Blob(['pdf']);
    getMock.mockResolvedValue({ data: blob });
    const result = await commercantApi.downloadLatestContract();
    expect(getMock).toHaveBeenCalledWith(`${BASE_CONTRACTS}/latest/download`, { responseType: 'blob' });
    expect(result).toBe(blob);
  });

  it('verifyContractSignature envoie le fichier dans un FormData', async () => {
    const file = new File(['contenu'], 'signature.pdf', { type: 'application/pdf' });
    postMock.mockResolvedValue({ data: { signed: true, message: 'ok' } });

    const result = await commercantApi.verifyContractSignature(file);

    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe(`${BASE_CONTRACTS}/verify-signature`);
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).not.toBeNull();
    expect(result).toEqual({ signed: true, message: 'ok' });
  });

  it('uploadSignedContract envoie le fichier dans un FormData', async () => {
    const file = new File(['contenu'], 'signe.pdf', { type: 'application/pdf' });
    postMock.mockResolvedValue({ data: { message: 'uploaded' } });

    await commercantApi.uploadSignedContract(file);

    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe(`${BASE_CONTRACTS}/latest/upload-signed`);
    expect(body).toBeInstanceOf(FormData);
    expect(((body as FormData).get('file') as File).name).toBe('signe.pdf');
  });
});

describe('workspace commercant', () => {
  it('createSubMerchant poste le payload complet', async () => {
    const payload = { pdvId: 1, nom: 'Doe', prenom: 'Jane', email: 'j@d.com', telephone: '0600000000' };
    postMock.mockResolvedValue({ data: { id: 1, message: 'ok', activationEmailSent: true, activationMessage: 'sent' } });

    const result = await commercantApi.createSubMerchant(payload);

    expect(postMock).toHaveBeenCalledWith(`${BASE_WORKSPACE}/sub-merchants`, payload);
    expect(result.id).toBe(1);
  });

  it('activateSubMerchant cible le bon sous-commercant', async () => {
    postMock.mockResolvedValue({ data: { id: 2, active: true, statut: 'ACTIF', message: 'ok' } });
    await commercantApi.activateSubMerchant(2);
    expect(postMock).toHaveBeenCalledWith(`${BASE_WORKSPACE}/sub-merchants/2/activate`, {});
  });

  it('deactivateSubMerchant cible le bon sous-commercant', async () => {
    postMock.mockResolvedValue({ data: { id: 2, active: false, statut: 'INACTIF', message: 'ok' } });
    await commercantApi.deactivateSubMerchant(2);
    expect(postMock).toHaveBeenCalledWith(`${BASE_WORKSPACE}/sub-merchants/2/deactivate`, {});
  });

  it('moveSubMerchantToPdv envoie le pdvId cible', async () => {
    postMock.mockResolvedValue({ data: { id: 2, pdvId: 9, message: 'ok' } });
    await commercantApi.moveSubMerchantToPdv(2, 9);
    expect(postMock).toHaveBeenCalledWith(`${BASE_WORKSPACE}/sub-merchants/2/pdv`, { pdvId: 9 });
  });

  it('assignTpeToPdv envoie le pdvId cible', async () => {
    postMock.mockResolvedValue({ data: { tpeId: '3', pdvId: 9, message: 'ok' } });
    await commercantApi.assignTpeToPdv('3', 9);
    expect(postMock).toHaveBeenCalledWith(`${BASE_WORKSPACE}/tpes/3/pdv`, { pdvId: 9 });
  });

  it('assignTpeToPdv fonctionne aussi avec un id TPE Oracle (chaine non numerique)', async () => {
    postMock.mockResolvedValue({ data: { tpeId: 'TPE-000123', pdvId: 9, message: 'ok' } });
    await commercantApi.assignTpeToPdv('TPE-000123', 9);
    expect(postMock).toHaveBeenCalledWith(`${BASE_WORKSPACE}/tpes/TPE-000123/pdv`, { pdvId: 9 });
  });

  it('requestNewPdvProduct poste le payload de demande de PDV', async () => {
    const payload = {
      nom: 'Boutique', adresse: 'Rue 1', ville: 'Casablanca', quartier: 'Maarif', codePostal: '20000',
      telephone: '0600000000', email: 'x@x.com', typeAffiliation: 'TPE', nombreTpe: '1',
      equipementTpe: '', connectiviteTpe: '', modeMiseADispositionTpe: '', modeleQrSoftpos: '', nombreQrSoftpos: '',
      modeServiceEcommerce: '', siteMarchandUrl: '', applicationMobile: '', latitude: null, longitude: null,
      existingPdvId: null
    };
    postMock.mockResolvedValue({ data: { message: 'ok' } });

    await commercantApi.requestNewPdvProduct(payload);

    expect(postMock).toHaveBeenCalledWith(`${BASE_WORKSPACE}/pdvs/product-requests`, payload);
  });
});
