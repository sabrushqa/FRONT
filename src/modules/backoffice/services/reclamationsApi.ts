import api from '../../../core/api';
import { resolveBackendApiUrl } from '../../../core/apiUrl';

const base = resolveBackendApiUrl('/api/backoffice/reclamations');

export interface ReclamationItem {
  idReclamation: number;
  referenceChat: string | null;
  typeProbleme: string;
  description: string;
  statut: string;
  priorite: string;
  dateCreation: string | null;
  dateResolution: string | null;
  commentaire: string | null;
  tpeId: number | null;
  tpeNumeroSerie: string | null;
  tpeModele: string | null;
  // Repli texte quand tpeId/tpeNumeroSerie sont absents (TPE Oracle sans
  // ligne locale correspondante) — voir BackofficeReclamationResponse.java.
  tpeReference: string | null;
  commercantId: number | null;
  commercantNom: string | null;
  region: string | null;
  typeAffiliation: string | null;
  backOfficeTraitant: string | null;
  backOfficeId: number | null;
  backOfficeUtilisateurId: number | null;
  dureeTraitementJours: number | null;
  // Label court (2-4 mots, ex: "Ecran noir TPE") genere par le chatbot —
  // voir BackofficeReclamationResponse.java::resumeCourt. Absent pour les
  // reclamations qui ne passent pas par le chatbot.
  resumeCourt: string | null;
}

export interface ReclamationStats {
  total: number;
  EN_COURS: number;
  EN_ATTENTE: number;
  RESOLU: number;
  ESCALADE: number;
  CRITIQUE: number;
  HAUTE: number;
  CONNECTIVITE: number;
  TRANSACTION: number;
  MATERIEL: number;
  LOGICIEL: number;
  RESEAU: number;
  AUTRE: number;
}

export async function getReclamations(params?: { statut?: string; priorite?: string; type?: string }): Promise<ReclamationItem[]> {
  const query = new URLSearchParams();
  if (params?.statut)   query.set('statut',   params.statut);
  if (params?.priorite) query.set('priorite', params.priorite);
  if (params?.type)     query.set('type',     params.type);
  const url = query.toString() ? `${base}?${query}` : base;
  const res = await api.get<ReclamationItem[]>(url);
  return res.data;
}

export async function getReclamationStats(): Promise<ReclamationStats> {
  const res = await api.get<ReclamationStats>(`${base}/stats`);
  return res.data;
}

export interface ReclamationDayCount {
  date: string;
  count: number;
  enAttente: number;
  enCours: number;
  resolu: number;
  escalade: number;
}

export interface ReclamationOverdueItem {
  idReclamation: number;
  referenceChat: string | null;
  typeProbleme: string;
  statut: string;
  commercantNom: string | null;
  dateCreation: string;
  joursEnAttente: number;
}

export interface ReclamationDashboard {
  parJour: ReclamationDayCount[];
  parEtat: Record<string, number>;
  enRetardCount: number;
  enRetard: ReclamationOverdueItem[];
}

export async function getReclamationDashboard(params?: { days?: number; type?: string }): Promise<ReclamationDashboard> {
  const query = new URLSearchParams();
  if (params?.days) query.set('days', String(params.days));
  if (params?.type) query.set('type', params.type);
  const url = query.toString() ? `${base}/dashboard?${query}` : `${base}/dashboard`;
  const res = await api.get<ReclamationDashboard>(url);
  return res.data;
}

export async function updateReclamationStatut(id: number, statut: string): Promise<ReclamationItem> {
  const res = await api.patch<ReclamationItem>(`${base}/${id}/statut`, { statut });
  return res.data;
}

// Fiche PDF imprimable (une page, A4) d'une reclamation — voir
// BackofficeReclamationController::pdf / ReclamationPdfService cote demo.
// responseType 'blob' : reponse binaire (application/pdf), pas du JSON.
export async function fetchReclamationPdfBlob(id: number): Promise<Blob> {
  const res = await api.get<Blob>(`${base}/${id}/pdf`, { responseType: 'blob' });
  return res.data;
}
