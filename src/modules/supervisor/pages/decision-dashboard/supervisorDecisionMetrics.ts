import {
  AffiliationRequestItem,
  PdvMapItem,
  SupervisorOverviewResponse,
  SupervisorTpeStockItem
} from '../../services/supervisorApi';
import {
  formatEnumLabel,
  isAutoAffiliationRequest,
  isCommercialDirectRequest,
  isNewPdvRequest
} from '../../../workspace/workspaceUtils';

export type ChartPoint = { label: string; value: number };
export type MultiChartPoint = { label: string; values: Record<string, number> };

export type PipelineKey =
  | 'EN_ATTENTE_ASSIGNATION'
  | 'ASSIGNE_COMMERCIAL'
  | 'A_COMPLETER'
  | 'EN_ATTENTE_VALIDATION_BOA'
  | 'INCOMPLET'
  | 'ABANDONNE'
  | 'CONTRAT_GENERE'
  | 'CONTRAT_SIGNE'
  | 'ACCEPTE';

export interface PerformanceRow {
  id: string;
  label: string;
  assigned: number;
  completed: number;
  sentBoa: number;
  refusedOrIncomplete: number;
  validated: number;
  conversionRate: number;
  averageDays: number | null;
}

export interface BoaPerformanceRow {
  id: string;
  label: string;
  treated: number;
  validated: number;
  refused: number;
  correction: number;
  averageDays: number | null;
}

export interface GlobalCard {
  label: string;
  value: number;
  helper: string;
}

export interface TopCommercialDirectRow {
  id: string;
  label: string;
  created: number;
  converted: number;
  conversionRate: number;
}

export interface TopCommercialAutoRegionRow {
  id: string;
  label: string;
  region: string;
  treated: number;
  validated: number;
  correction: number;
}

export interface SupervisorDecisionMetrics {
  globalCards: GlobalCard[];
  pipelinePoints: ChartPoint[];
  originPoints: ChartPoint[];
  commercialRows: PerformanceRow[];
  boaRows: BoaPerformanceRow[];
  refusalMotifPoints: ChartPoint[];
  monthlyAutoStatusPoints: ChartPoint[];
  monthlyProspectionStatusPoints: ChartPoint[];
  monthlyProspectionRegionPoints: ChartPoint[];
  conversionByOriginPoints: MultiChartPoint[];
  topCommercialDirectRows: TopCommercialDirectRow[];
  topCommercialAutoRegionRows: TopCommercialAutoRegionRow[];
  affiliationTypePoints: MultiChartPoint[];
  merchantNaturePoints: MultiChartPoint[];
}

export const EMPTY_OVERVIEW: SupervisorOverviewResponse = {
  backOffices: [],
  commerciales: [],
  commercants: []
};

export const pipelineLabels: Record<PipelineKey, string> = {
  EN_ATTENTE_ASSIGNATION: "En attente assignation",
  ASSIGNE_COMMERCIAL: 'Assigné commercial',
  A_COMPLETER: 'À compléter',
  EN_ATTENTE_VALIDATION_BOA: 'En attente validation BOA',
  INCOMPLET: 'Incomplet / document manquant',
  ABANDONNE: 'Abandonné',
  CONTRAT_GENERE: 'Contrat généré',
  CONTRAT_SIGNE: 'Contrat signé déposé',
  ACCEPTE: 'Accepté / actif'
};

export const chartColors = {
  navy: '#0d2b45',
  blue: '#2563eb',
  sky: '#38bdf8',
  yellow: '#facc15',
  pink: '#ec4899',
  green: '#16a34a',
  red: '#ef4444',
  slate: '#64748b'
};

export function isDarkTheme(): boolean {
  return (
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    document.body.getAttribute('data-theme') === 'dark'
  );
}

export function formatDays(value: number | null): string {
  if (value === null) return '-';
  return `${value} j`;
}

export function formatRate(value: number): string {
  return `${value}%`;
}

function daysBetween(startValue: string | null | undefined, endValue: string | null | undefined): number | null {
  if (!startValue || !endValue) return null;
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.max(0, Math.ceil((end - start) / 86_400_000));
}

function average(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => value !== null);
  if (!validValues.length) return null;
  return Math.round((validValues.reduce((sum, value) => sum + value, 0) / validValues.length) * 10) / 10;
}

function normalizeKey(value: string | number | null | undefined): string {
  return String(value ?? '').trim() || 'Non renseigné';
}

function displayLabel(value: string | null | undefined): string {
  if (value === 'ABANDONNE') return 'Abandonné';
  return formatEnumLabel(value || 'NON_RENSEIGNE') || 'Non renseigné';
}

function isCurrentMonth(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function isValidated(request: AffiliationRequestItem): boolean {
  return request.status === 'ACCEPTE' || request.status === 'ACTIF' || request.compteActif;
}

function isConverted(request: AffiliationRequestItem): boolean {
  return isValidated(request) || request.prospectStatus === 'CONVERTI';
}

function isRefusedOrIncomplete(request: AffiliationRequestItem): boolean {
  return request.status === 'ABANDONNE' || request.status === 'INCOMPLET';
}

function isSentToBoa(request: AffiliationRequestItem): boolean {
  return request.status === 'EN_ATTENTE_VALIDATION_BOA' || Boolean(request.backOfficeTraitant);
}

function resolvePipelineKey(request: AffiliationRequestItem): PipelineKey {
  if (isValidated(request)) return 'ACCEPTE';
  if (request.status === 'ABANDONNE') return 'ABANDONNE';
  if (request.status === 'INCOMPLET') return 'INCOMPLET';
  if (request.signedContractDisponible) return 'CONTRAT_SIGNE';
  if (request.contractDisponible || request.status === 'CONTRAT_A_SIGNER' || request.status === 'CONTRAT_ENVOYE') {
    return 'CONTRAT_GENERE';
  }
  if (request.status === 'EN_ATTENTE_VALIDATION_BOA') {
    return 'EN_ATTENTE_VALIDATION_BOA';
  }
  if (request.commercialAttribueId || request.commercialAttribue) {
    return 'ASSIGNE_COMMERCIAL';
  }
  if (request.status === 'BROUILLON' || request.status === 'SOUMIS' || request.status === 'EN_ATTENTE') {
    return 'A_COMPLETER';
  }
  return 'EN_ATTENTE_ASSIGNATION';
}

function topCounts(values: string[], limit: number): ChartPoint[] {
  const counts = values.reduce((map, rawValue) => {
    const value = rawValue.trim() || 'Non renseigné';
    map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function buildSupervisorDecisionMetrics(
  overview: SupervisorOverviewResponse,
  affiliationRequests: AffiliationRequestItem[],
  pdvs: PdvMapItem[] = [],
  tpes: SupervisorTpeStockItem[] = []
): SupervisorDecisionMetrics {
  const autoRequests = affiliationRequests.filter(isAutoAffiliationRequest);
  const commercialDirectRequests = affiliationRequests.filter(isCommercialDirectRequest);
  const extensionRequests = affiliationRequests.filter(isNewPdvRequest);

  const pipelineCounts = Object.keys(pipelineLabels).reduce((map, key) => {
    map[key as PipelineKey] = 0;
    return map;
  }, {} as Record<PipelineKey, number>);
  affiliationRequests.forEach((request) => {
    pipelineCounts[resolvePipelineKey(request)] += 1;
  });

  const pipelinePoints = (Object.keys(pipelineLabels) as PipelineKey[]).map((key) => ({
    label: pipelineLabels[key],
    value: pipelineCounts[key]
  }));

  const commercialRows = buildCommercialRows(affiliationRequests);
  const boaRows = buildBoaRows(affiliationRequests);
  const currentMonthAutoRequests = autoRequests.filter((request) => isCurrentMonth(request.dateSoumission));
  const currentMonthDirectRequests = commercialDirectRequests.filter((request) => isCurrentMonth(request.dateSoumission));

  return {
    globalCards: [
      { label: "Total demandes d'affiliation", value: affiliationRequests.length, helper: 'Auto, prospection et extensions' },
      { label: 'Auto-affiliation', value: autoRequests.length, helper: 'Demandes créées par commerçant' },
      { label: 'Prospection directe', value: commercialDirectRequests.length, helper: 'Créées par commerciale' },
      { label: 'Extension PDV', value: extensionRequests.length, helper: 'Nouveaux points ou produits' },
      { label: 'Commerçants actifs', value: overview.commercants.filter((item) => item.active).length, helper: 'Portefeuille actif' },
      { label: 'Commerciales', value: overview.commerciales.length, helper: `${overview.commerciales.filter((item) => item.active).length} actives` },
      { label: 'Back office', value: overview.backOffices.length, helper: `${overview.backOffices.filter((item) => item.active).length} actifs` },
      { label: 'PDV', value: pdvs.length, helper: `${pdvs.filter((item) => item.statut === 'ACTIF').length} actifs` },
      { label: 'TPE', value: tpes.length, helper: `${tpes.filter((item) => item.actif).length} actifs` }
    ],
    pipelinePoints,
    originPoints: [
      { label: 'Auto-affiliation', value: autoRequests.length },
      { label: 'Prospection directe', value: commercialDirectRequests.length },
      { label: 'Extension PDV', value: extensionRequests.length }
    ],
    commercialRows,
    boaRows,
    refusalMotifPoints: topCounts(
      affiliationRequests
        .filter((request) => request.status === 'ABANDONNE' || request.status === 'INCOMPLET')
        .map((request) => request.motifRefus || 'Motif non renseigné'),
      8
    ),
    monthlyAutoStatusPoints: topCounts(
      currentMonthAutoRequests.map((request) => displayLabel(request.status)),
      12
    ),
    monthlyProspectionStatusPoints: topCounts(
      currentMonthDirectRequests.map((request) => displayLabel(request.prospectStatus || request.status)),
      12
    ),
    monthlyProspectionRegionPoints: topCounts(
      currentMonthDirectRequests.map((request) => request.region || 'Région non renseignée'),
      12
    ),
    conversionByOriginPoints: [
      buildConversionPoint('Auto-affiliation', autoRequests),
      buildConversionPoint('Prospection directe', commercialDirectRequests)
    ],
    topCommercialDirectRows: buildTopCommercialDirectRows(commercialDirectRequests),
    topCommercialAutoRegionRows: buildTopCommercialAutoRegionRows(autoRequests),
    affiliationTypePoints: buildSegmentPoints(affiliationRequests, 'typeAffiliation'),
    merchantNaturePoints: buildSegmentPoints(affiliationRequests, 'typeCommercant')
  };
}

function buildCommercialRows(affiliationRequests: AffiliationRequestItem[]): PerformanceRow[] {
  const map = new Map<string, { label: string; requests: AffiliationRequestItem[] }>();
  affiliationRequests.forEach((request) => {
    const key = normalizeKey(request.commercialAttribueId ?? request.commercialAttribue);
    const label = request.commercialAttribue?.trim() || 'Non attribué';
    const entry = map.get(key) ?? { label, requests: [] };
    entry.requests.push(request);
    map.set(key, entry);
  });

  return [...map.entries()]
    .map(([id, entry]) => {
      const assigned = entry.requests.length;
      const completed = entry.requests.filter((request) => Boolean(request.commercialReportDisponible || request.commercialReportGeneratedAt)).length;
      const sentBoa = entry.requests.filter(isSentToBoa).length;
      const refusedOrIncomplete = entry.requests.filter(isRefusedOrIncomplete).length;
      const validated = entry.requests.filter(isValidated).length;
      const conversionRate = assigned ? Math.round((validated / assigned) * 100) : 0;
      const averageDays = average(
        entry.requests.map((request) => daysBetween(request.dateSoumission, request.commercialReportGeneratedAt))
      );
      return { id, label: entry.label, assigned, completed, sentBoa, refusedOrIncomplete, validated, conversionRate, averageDays };
    })
    .sort((a, b) => b.assigned - a.assigned)
    .slice(0, 10);
}

function buildBoaRows(affiliationRequests: AffiliationRequestItem[]): BoaPerformanceRow[] {
  const handledRequests = affiliationRequests.filter((request) =>
    request.backOfficeTraitant
    || request.backOfficeId
    || request.dateTraitementBackOffice
    || isValidated(request)
    || request.status === 'ABANDONNE'
  );
  const map = new Map<string, { label: string; requests: AffiliationRequestItem[] }>();
  handledRequests.forEach((request) => {
    const key = normalizeKey(request.backOfficeId ?? request.backOfficeTraitant);
    const label = request.backOfficeTraitant?.trim() || 'Non attribué';
    const entry = map.get(key) ?? { label, requests: [] };
    entry.requests.push(request);
    map.set(key, entry);
  });

  return [...map.entries()]
    .map(([id, entry]) => {
      const treated = entry.requests.length;
      const validated = entry.requests.filter(isValidated).length;
      const refused = entry.requests.filter((request) => request.status === 'ABANDONNE').length;
      const correction = entry.requests.filter((request) => request.status === 'INCOMPLET').length;
      const averageDays = average(
        entry.requests.map((request) => daysBetween(request.dateSoumission, request.dateTraitementBackOffice))
      );
      return { id, label: entry.label, treated, validated, refused, correction, averageDays };
    })
    .sort((a, b) => b.treated - a.treated)
    .slice(0, 10);
}

function buildConversionPoint(label: string, requests: AffiliationRequestItem[]): MultiChartPoint {
  return {
    label,
    values: {
      Actives: requests.filter((request) => request.compteActif || request.status === 'ACTIF').length,
      Validées: requests.filter(isValidated).length,
      Converties: requests.filter(isConverted).length
    }
  };
}

function buildTopCommercialDirectRows(requests: AffiliationRequestItem[]): TopCommercialDirectRow[] {
  const map = new Map<string, { label: string; requests: AffiliationRequestItem[] }>();
  requests.forEach((request) => {
    const key = normalizeKey(request.commercialAttribueId ?? request.commercialAttribue);
    const label = request.commercialAttribue?.trim() || 'Non attribué';
    const entry = map.get(key) ?? { label, requests: [] };
    entry.requests.push(request);
    map.set(key, entry);
  });

  return [...map.entries()]
    .map(([id, entry]) => {
      const created = entry.requests.length;
      const converted = entry.requests.filter(isConverted).length;
      return {
        id,
        label: entry.label,
        created,
        converted,
        conversionRate: created ? Math.round((converted / created) * 100) : 0
      };
    })
    .sort((a, b) => b.created - a.created)
    .slice(0, 10);
}

function buildTopCommercialAutoRegionRows(requests: AffiliationRequestItem[]): TopCommercialAutoRegionRow[] {
  const map = new Map<string, { label: string; region: string; requests: AffiliationRequestItem[] }>();
  requests.forEach((request) => {
    const label = request.commercialAttribue?.trim() || 'Non attribué';
    const region = request.region?.trim() || 'Région non renseignée';
    const key = `${normalizeKey(request.commercialAttribueId ?? label)}::${region}`;
    const entry = map.get(key) ?? { label, region, requests: [] };
    entry.requests.push(request);
    map.set(key, entry);
  });

  return [...map.entries()]
    .map(([id, entry]) => ({
      id,
      label: entry.label,
      region: entry.region,
      treated: entry.requests.filter((request) => Boolean(request.commercialReportDisponible || request.commercialReportGeneratedAt || isSentToBoa(request))).length,
      validated: entry.requests.filter(isValidated).length,
      correction: entry.requests.filter(isRefusedOrIncomplete).length
    }))
    .sort((a, b) => b.treated - a.treated)
    .slice(0, 12);
}

function buildSegmentPoints(
  requests: AffiliationRequestItem[],
  field: 'typeAffiliation' | 'typeCommercant'
): MultiChartPoint[] {
  const map = new Map<string, { label: string; auto: number; prospection: number }>();
  requests
    .filter((request) => !isNewPdvRequest(request))
    .forEach((request) => {
      const label = displayLabel(request[field]);
      const entry = map.get(label) ?? { label, auto: 0, prospection: 0 };
      if (isCommercialDirectRequest(request)) {
        entry.prospection += 1;
      } else {
        entry.auto += 1;
      }
      map.set(label, entry);
    });

  return [...map.values()]
    .map((entry) => ({
      label: entry.label,
      values: {
        'Auto-affiliation': entry.auto,
        'Prospection directe': entry.prospection
      }
    }))
    .sort((a, b) => {
      const totalA = a.values['Auto-affiliation'] + a.values['Prospection directe'];
      const totalB = b.values['Auto-affiliation'] + b.values['Prospection directe'];
      return totalB - totalA;
    })
    .slice(0, 12);
}
