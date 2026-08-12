export interface CommercialReportOption {
  value: string;
  label: string;
}

export const COMMERCIAL_REPORT_QUALIFICATION_OPTIONS: CommercialReportOption[] = [
  { value: 'AFFILIE', label: 'Affilié' },
  { value: 'PROSPECT', label: 'Prospect' }
];

export const COMMERCIAL_REPORT_ORIGIN_OPTIONS: CommercialReportOption[] = [
  { value: 'CIH_BANK', label: 'CIH Bank' },
  { value: 'UMNIA_BANK', label: 'Umnia Bank' },
  { value: 'APPORTEUR_AFFAIRES', label: "Apporteur d'affaires" },
  { value: 'MANDATAIRES', label: 'Mandataires' },
  { value: 'PROSPECTION_DIRECTE', label: 'Prospection directe' }
];

export const COMMERCIAL_REPORT_SURFACE_OPTIONS: CommercialReportOption[] = [
  { value: 'DE_10_A_30_M2', label: 'De 10 à 30 m2' },
  { value: 'ENTRE_30_ET_100_M2', label: 'Entre 30 et 100 m2' },
  { value: 'AU_DELA_100_M2', label: 'Au-delà de 100 m2' }
];

export const COMMERCIAL_REPORT_LOCAL_STATUS_OPTIONS: CommercialReportOption[] = [
  { value: 'ACHETE', label: 'Acheté' },
  { value: 'LOUE', label: 'Loué' }
];

export const COMMERCIAL_REPORT_CA_OPTIONS: CommercialReportOption[] = [
  { value: 'MOINS_0_5_MDHS', label: 'Moins de 0.5 MDHS' },
  { value: 'DE_0_5_A_1_MDHS', label: 'De 0.5 à 1 MDHS' },
  { value: 'DE_1_A_5_MDHS', label: 'De 1 à 5 MDHS' },
  { value: 'PLUS_5_MDHS', label: 'Plus de 5 MDHS' }
];

export const COMMERCIAL_REPORT_PROFILE_OPTIONS: CommercialReportOption[] = [
  { value: 'OFF_SHORE_VIREMENT', label: 'Off Shore virement' },
  { value: 'IN_SHORE_VIREMENT', label: 'In Shore virement' }
];

export const COMMERCIAL_REPORT_APPRECIATION_OPTIONS: CommercialReportOption[] = [
  { value: 'FAVORABLE', label: 'Favorable' },
  { value: 'DEFAVORABLE', label: 'Défavorable' }
];
