export type CorrectionRequest = {
  categories: string[];
  fields: string[];
  documents: string[];
  detail: string;
};

export const CORRECTION_CATEGORY_OPTIONS = [
  { value: 'DOCUMENTS', label: 'Documents manquants / incorrects' },
  { value: 'DONNEES_COMMERCANT', label: 'Données commerçant' },
  { value: 'CONDITIONS_COMMERCIALES', label: 'Conditions commerciales / contrat' },
  { value: 'COMPTE_RENDU', label: 'Compte rendu commercial' },
  { value: 'AUTRE', label: 'Autre' }
];

export const CORRECTION_FIELD_OPTIONS = [
  { value: 'typeCommercant', label: 'Type commerçant' },
  { value: 'typeAffiliation', label: "Type d'affiliation" },
  { value: 'nom', label: 'Nom' },
  { value: 'prenom', label: 'Prénom' },
  { value: 'cin', label: 'CIN' },
  { value: 'dateNaissance', label: 'Date de naissance' },
  { value: 'nationalite', label: 'Nationalité' },
  { value: 'raisonSociale', label: 'Raison sociale' },
  { value: 'nomEntite', label: 'Nom entité' },
  { value: 'rc', label: 'RC' },
  { value: 'ice', label: 'ICE' },
  { value: 'formeJuridique', label: 'Forme juridique' },
  { value: 'representantLegal', label: 'Représentant légal' },
  { value: 'numeroAutoEntrepreneur', label: 'Numéro auto-entrepreneur' },
  { value: 'objet', label: 'Objet' },
  { value: 'patente', label: 'Taxe professionnelle' },
  { value: 'fonction', label: 'Fonction du signataire' },
  { value: 'beneficiairesEffectifs', label: 'Bénéficiaires effectifs' },
  { value: 'email', label: 'E-mail' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'adresse', label: 'Adresse' },
  { value: 'ville', label: 'Ville' },
  { value: 'region', label: 'Région' },
  { value: 'rib', label: 'RIB' },
  { value: 'mcc', label: 'MCC' },
  { value: 'chainePointVente', label: 'Chaîne point de vente' },
  { value: 'pointVente', label: 'Points de vente' },
  { value: 'modeMiseADispositionTpe', label: 'Mode mise à disposition TPE' },
  { value: 'nombreTpe', label: 'Nombre TPE' },
  { value: 'equipementTpe', label: 'Équipement TPE' },
  { value: 'connectiviteTpe', label: 'Connectivité TPE' },
  { value: 'modeServiceEcommerce', label: 'Mode service e-commerce' },
  { value: 'siteMarchandUrl', label: 'Site marchand' },
  { value: 'applicationMobile', label: 'Application mobile' },
  { value: 'modeleQrSoftpos', label: 'Modèle QR / SoftPOS' },
  { value: 'services', label: 'Services LANA CASH' },
  { value: 'abonnementPackage', label: 'Abonnement' },
  { value: 'commissions', label: 'Commissions / frais' },
  { value: 'compteRendu', label: 'Compte rendu commercial' }
];

export const CORRECTION_DOCUMENT_OPTIONS = [
  { value: 'cinDocument', label: 'CIN' },
  { value: 'ribDocument', label: 'RIB' },
  { value: 'patenteDocument', label: 'Taxe professionnelle' },
  { value: 'statutsDocument', label: 'Statuts' },
  { value: 'rcDocument', label: 'RC' },
  { value: 'iceDocument', label: 'ICE' },
  { value: 'cinRepresentantDocument', label: 'CIN représentant' },
  { value: 'pvNominationDocument', label: 'PV nomination' },
  { value: 'attestationAeDocument', label: 'Attestation auto-entrepreneur' },
  { value: 'cinSignataireDocument', label: 'CIN signataire' },
  { value: 'pvAssociationDocument', label: 'PV association' },
  { value: 'listeMembresDocument', label: 'Liste membres' }
];

function labelsFor(values: string[], options: Array<{ value: string; label: string }>): string {
  return values
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .join(', ');
}

export function serializeCorrectionRequest(request: CorrectionRequest): string {
  return [
    `Types de problème: ${labelsFor(request.categories, CORRECTION_CATEGORY_OPTIONS) || '-'}`,
    `Champs concernés: ${labelsFor(request.fields, CORRECTION_FIELD_OPTIONS) || '-'}`,
    `Documents concernés: ${labelsFor(request.documents, CORRECTION_DOCUMENT_OPTIONS) || '-'}`,
    `Motif: ${request.detail.trim()}`
  ].join('\n');
}

export function parseCorrectionRequest(value: string | null | undefined): CorrectionRequest {
  const raw = value ?? '';
  const readLine = (prefix: string) => {
    const line = raw.split(/\r?\n/).find((item) => item.startsWith(prefix));
    return line ? line.slice(prefix.length).trim() : '';
  };
  const readLabels = (prefix: string, options: Array<{ value: string; label: string }>) => {
    const labels = readLine(prefix);
    if (!labels || labels === '-') return [];
    return labels
      .split(',')
      .map((label) => label.trim())
      .map((label) => options.find((option) => option.label === label)?.value ?? label)
      .filter(Boolean);
  };

  const detail = readLine('Motif: ');
  if (!detail && raw.trim() && !raw.includes('Types de problème:')) {
    return { categories: [], fields: [], documents: [], detail: raw.trim() };
  }

  return {
    categories: readLabels('Types de problème: ', CORRECTION_CATEGORY_OPTIONS),
    fields: readLabels('Champs concernés: ', CORRECTION_FIELD_OPTIONS),
    documents: readLabels('Documents concernés: ', CORRECTION_DOCUMENT_OPTIONS),
    detail
  };
}

export function buildCorrectionEmailBody(request: {
  dossierId: number;
  nomCommercant?: string;
  motifRefus?: string;
}): string {
  const correction = parseCorrectionRequest(request.motifRefus);
  const documents = labelsFor(correction.documents, CORRECTION_DOCUMENT_OPTIONS);
  const fields = labelsFor(correction.fields, CORRECTION_FIELD_OPTIONS);
  return [
    `Bonjour,`,
    '',
    `Suite au contrôle de votre dossier #${request.dossierId}${request.nomCommercant ? ` (${request.nomCommercant})` : ''}, un complément est demandé avant validation.`,
    documents ? `Documents à corriger/transmettre: ${documents}.` : '',
    fields ? `Informations à vérifier: ${fields}.` : '',
    correction.detail ? `Motif BOA: ${correction.detail}` : '',
    '',
    `Merci de nous transmettre les éléments manquants afin que nous puissions renvoyer le dossier au back office.`,
    '',
    `Cordialement,`
  ].filter((line, index, lines) => line || lines[index - 1]).join('\n');
}

export function summarizeCorrectionRequest(value: string | null | undefined): string {
  const correction = parseCorrectionRequest(value);
  const chunks = [
    correction.categories.length ? labelsFor(correction.categories, CORRECTION_CATEGORY_OPTIONS) : '',
    correction.documents.length ? `Documents: ${labelsFor(correction.documents, CORRECTION_DOCUMENT_OPTIONS)}` : '',
    correction.fields.length ? `Champs: ${labelsFor(correction.fields, CORRECTION_FIELD_OPTIONS)}` : '',
    correction.detail
  ].filter(Boolean);
  return chunks.join(' | ') || (value ?? '');
}
