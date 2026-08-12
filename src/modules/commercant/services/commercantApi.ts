import api from '../../../core/api';
import { resolveBackendApiUrl } from '../../../core/apiUrl';

/* ============================================================
   CONTRACT API
   ============================================================ */
export interface CommercantContractOverview {
  dossierId: number;
  dossierStatus: string;
  contractDisponible: boolean;
  contractFileName: string;
  contractGeneratedAt: string | null;
  signedContractDisponible: boolean;
  signedContractFileName: string;
  signedContractUploadedAt: string | null;
  commercialAttribue: string;
  motifRefus?: string;
}

export interface CommercantContractActionResponse {
  message: string;
}

export interface ContractSignatureVerificationResponse {
  signed: boolean;
  message: string;
}

const contractBase = resolveBackendApiUrl('/api/commercant/contracts');

export async function getLatestContract(): Promise<CommercantContractOverview> {
  const res = await api.get<CommercantContractOverview>(`${contractBase}/latest`);
  return res.data;
}

export async function downloadLatestContract(): Promise<Blob> {
  const res = await api.get(`${contractBase}/latest/download`, { responseType: 'blob' });
  return res.data as Blob;
}

export async function verifyContractSignature(file: File): Promise<ContractSignatureVerificationResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<ContractSignatureVerificationResponse>(`${contractBase}/verify-signature`, formData);
  return res.data;
}

export async function uploadSignedContract(file: File): Promise<CommercantContractActionResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<CommercantContractActionResponse>(`${contractBase}/latest/upload-signed`, formData);
  return res.data;
}

/* ============================================================
   WORKSPACE API
   ============================================================ */
export interface CommercantSubMerchantCreateRequest {
  pdvId?: number;
  // Used instead of pdvId for e-commerce merchants (no point de vente).
  canalEcommerce?: 'SITE_MARCHAND' | 'APPLICATION_MOBILE';
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

export interface CommercantSubMerchantCreateResponse {
  id: number;
  message: string;
  activationEmailSent: boolean;
  activationMessage: string;
}

export interface CommercantSubMerchantStatusResponse {
  id: number;
  active: boolean;
  statut: string;
  message: string;
}

export interface CommercantSubMerchantMoveResponse {
  id: number;
  pdvId: number;
  message: string;
}

export interface CommercantTpePdvAssignResponse {
  tpeId: string;
  pdvId: number;
  message: string;
}

export interface CommercantPdvProductRequest {
  nom: string;
  adresse: string;
  ville: string;
  quartier: string;
  codePostal: string;
  telephone: string;
  email: string;
  typeAffiliation: string;
  nombreTpe: string;
  equipementTpe: string;
  connectiviteTpe: string;
  modeMiseADispositionTpe: string;
  modeleQrSoftpos: string;
  modeServiceEcommerce: string;
  siteMarchandUrl: string;
  applicationMobile: string;
  latitude: number | null;
  longitude: number | null;
}

export interface CommercantActionResponse {
  message: string;
}

const workspaceBase = resolveBackendApiUrl('/api/commercant/workspace');

export async function createSubMerchant(
  payload: CommercantSubMerchantCreateRequest
): Promise<CommercantSubMerchantCreateResponse> {
  const res = await api.post<CommercantSubMerchantCreateResponse>(`${workspaceBase}/sub-merchants`, payload);
  return res.data;
}

export async function activateSubMerchant(
  subMerchantId: number
): Promise<CommercantSubMerchantStatusResponse> {
  const res = await api.post<CommercantSubMerchantStatusResponse>(
    `${workspaceBase}/sub-merchants/${subMerchantId}/activate`,
    {}
  );
  return res.data;
}

export async function deactivateSubMerchant(
  subMerchantId: number
): Promise<CommercantSubMerchantStatusResponse> {
  const res = await api.post<CommercantSubMerchantStatusResponse>(
    `${workspaceBase}/sub-merchants/${subMerchantId}/deactivate`,
    {}
  );
  return res.data;
}

export async function moveSubMerchantToPdv(
  subMerchantId: number,
  pdvId: number
): Promise<CommercantSubMerchantMoveResponse> {
  const res = await api.post<CommercantSubMerchantMoveResponse>(
    `${workspaceBase}/sub-merchants/${subMerchantId}/pdv`,
    { pdvId }
  );
  return res.data;
}

export async function assignTpeToPdv(
  tpeId: string,
  pdvId: number
): Promise<CommercantTpePdvAssignResponse> {
  const res = await api.post<CommercantTpePdvAssignResponse>(
    `${workspaceBase}/tpes/${tpeId}/pdv`,
    { pdvId }
  );
  return res.data;
}

export async function requestNewPdvProduct(
  payload: CommercantPdvProductRequest
): Promise<CommercantActionResponse> {
  const res = await api.post<CommercantActionResponse>(`${workspaceBase}/pdvs/product-requests`, payload);
  return res.data;
}
