import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAffiliationRequests,
  getCommercialInteractions,
  addCommercialInteraction,
  AffiliationRequestItem,
  CommercialInteractionItem,
  CommercialInteractionPayload
} from '../../../supervisor/services/supervisorApi';
import { useSessionStore } from '../../../../store/sessionStore';
import {
  extractApiErrorMessage,
  formatEnumLabel,
  getAffiliationStatusLabel,
  resolveAffiliationStatusKey
} from '../../../supervisor/services/supervisorUiUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/commercial-direct-requests.scss';
import { buildCorrectionEmailBody, summarizeCorrectionRequest } from '../../services/correctionRequestUtils';

type DirectStatusFilter =
  | 'all'
  | 'draft'
  | 'correction'
  | 'progress'
  | 'sent'
  | 'active'
  | 'refused'
  | 'reminder-today'
  | 'stale';

type InteractionForm = CommercialInteractionPayload;

const INTERACTION_TYPE_OPTIONS = [
  { value: 'APPEL', label: 'Appel' },
  { value: 'VISITE', label: 'Visite' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'RDV', label: 'RDV' },
  { value: 'RELANCE', label: 'Relance' }
];

const PROSPECT_STATUS_OPTIONS = [
  { value: 'NOUVEAU', label: 'Nouveau' },
  { value: 'CONTACTE', label: 'Contacté' },
  { value: 'RDV_PLANIFIE', label: 'RDV planifié' },
  { value: 'EN_NEGOCIATION', label: 'En négociation' },
  { value: 'A_RELANCER', label: 'À relancer' },
  { value: 'CONVERTI', label: 'Converti' },
  { value: 'ABANDONNE', label: 'Abandonné' }
];

const ALLOWED_PROSPECT_BY_TYPE: Record<string, string[]> = {
  APPEL: ['CONTACTE', 'EN_NEGOCIATION', 'A_RELANCER', 'ABANDONNE'],
  EMAIL: ['CONTACTE', 'EN_NEGOCIATION', 'A_RELANCER', 'ABANDONNE'],
  RDV: ['RDV_PLANIFIE', 'EN_NEGOCIATION', 'A_RELANCER', 'ABANDONNE'],
  VISITE: ['EN_NEGOCIATION', 'A_RELANCER', 'ABANDONNE'],
  RELANCE: ['A_RELANCER', 'CONTACTE', 'EN_NEGOCIATION', 'ABANDONNE']
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateKey(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return toDateInputValue(date);
}

function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function buildDistinctOptions(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value?.trim()))).sort(
    (a, b) => a.localeCompare(b, 'fr')
  );
}

function createInteractionForm(request?: AffiliationRequestItem, interactionType = 'APPEL'): InteractionForm {
  const defaultType = interactionType;
  const allowedStatuses = ALLOWED_PROSPECT_BY_TYPE[defaultType] ?? ['CONTACTE'];
  const requestedStatus = request?.prospectStatus || '';
  // The dossier's current prospectStatus may come from a different interaction type
  // (e.g. "RDV planifié" from a RDV or the initial "Nouveau"),
  // none of which are valid for the default "Appel" type. Falling back keeps the <select>
  // value in sync with what's actually displayed, instead of silently submitting a status
  // the user never saw selected.
  const prospectStatus = allowedStatuses.includes(requestedStatus) ? requestedStatus : allowedStatuses[0];

  return {
    typeInteraction: defaultType,
    resultat: '',
    commentaire: '',
    statut: 'FAIT',
    dateInteraction: toDateInputValue(new Date()),
    prochaineRelanceDate: '',
    prochaineRelanceType: prospectStatus === 'A_RELANCER' ? 'RELANCE' : '',
    prospectStatus
  };
}

export default function CommercialDirectRequestsPage({
  scope
}: {
  scope?: 'supervisor' | 'commercial';
}) {
  const navigate = useNavigate();
  const { session } = useSessionStore();
  const role = session?.role;

  const isSupervisorMode = scope === 'supervisor' || role === 'SUPERVISEUR';
  const isCommercialMode = role === 'COMMERCIAL' && !isSupervisorMode;
  const hasAccess = isCommercialMode || isSupervisorMode;

  const [requests, setRequests] = useState<AffiliationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DirectStatusFilter>('all');
  const [prospectStatusFilter, setProspectStatusFilter] = useState('all');
  const [interactionTypeFilter, setInteractionTypeFilter] = useState('all');
  const [commercialFilter, setCommercialFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  const [selectedRequest, setSelectedRequest] = useState<AffiliationRequestItem | null>(null);
  const [selectedInteractions, setSelectedInteractions] = useState<CommercialInteractionItem[]>([]);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);
  const [isSavingInteraction, setIsSavingInteraction] = useState(false);
  const [interactionForm, setInteractionForm] = useState<InteractionForm>(() => createInteractionForm());

  function getStatusKey(request: AffiliationRequestItem): DirectStatusFilter {
    if (request.status === 'BROUILLON') {
      return 'draft';
    }
    if (request.status === 'INCOMPLET') {
      return 'correction';
    }
    return resolveAffiliationStatusKey(request) as DirectStatusFilter;
  }

  function isDueForReminder(request: AffiliationRequestItem): boolean {
    const reminderDate = toDateKey(request.prochaineRelanceCommerciale);
    return !!reminderDate && reminderDate <= toDateInputValue(new Date());
  }

  function isStaleRequest(request: AffiliationRequestItem): boolean {
    if (request.status !== 'BROUILLON' && request.status !== 'SOUMIS') {
      return false;
    }
    const lastActionDate = toDateKey(request.derniereInteractionCommerciale || request.dateSoumission);
    if (!lastActionDate) {
      return true;
    }
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 7);
    return lastActionDate < toDateInputValue(threshold);
  }

  function isOwnedByConnectedCommercial(request: AffiliationRequestItem): boolean {
    const commercialLabel = normalizeForMatch(request.commercialAttribue);
    if (!commercialLabel) {
      return false;
    }
    const candidates = [session?.nom, session?.email, session?.profile?.nom, session?.profile?.email]
      .map((value) => normalizeForMatch(value))
      .filter(Boolean);
    return candidates.some(
      (candidate) =>
        commercialLabel === candidate ||
        commercialLabel.includes(candidate) ||
        candidate.includes(commercialLabel)
    );
  }

  async function loadRequests() {
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await getAffiliationRequests();
      const all = Array.isArray(response.requests) ? response.requests : [];
      const filtered = all
        .filter((request) => request.origineCreation === 'COMMERCIAL_DIRECT')
        .filter((request) => isSupervisorMode || isOwnedByConnectedCommercial(request))
        .sort((left, right) => right.dossierId - left.dossierId);
      setRequests(filtered);
      setErrorMessage('');
    } catch {
      setErrorMessage('Impossible de charger les demandes commerciales.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusOptions = useMemo<Array<{ key: DirectStatusFilter; label: string; count: number }>>(
    () => [
      { key: 'all', label: 'Toutes', count: requests.length },
      { key: 'draft', label: 'Brouillons', count: requests.filter((item) => item.status === 'BROUILLON').length },
      { key: 'correction', label: 'À corriger', count: requests.filter((item) => getStatusKey(item) === 'correction').length },
      { key: 'progress', label: 'En traitement', count: requests.filter((item) => getStatusKey(item) === 'progress').length },
      { key: 'sent', label: 'À signer', count: requests.filter((item) => getStatusKey(item) === 'sent').length },
      { key: 'active', label: 'Validés', count: requests.filter((item) => getStatusKey(item) === 'active').length },
      { key: 'refused', label: 'Refusés', count: requests.filter((item) => getStatusKey(item) === 'refused').length },
      { key: 'reminder-today', label: 'À relancer', count: requests.filter((item) => isDueForReminder(item)).length },
      { key: 'stale', label: 'Sans action', count: requests.filter((item) => isStaleRequest(item)).length }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requests]
  );

  const commercialOptions = useMemo(
    () => buildDistinctOptions(requests.map((request) => request.commercialAttribue)),
    [requests]
  );
  const regionOptions = useMemo(
    () => buildDistinctOptions(requests.map((request) => request.region)),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'draft'
          ? request.status === 'BROUILLON'
          : statusFilter === 'reminder-today'
            ? isDueForReminder(request)
            : statusFilter === 'stale'
              ? isStaleRequest(request)
              : getStatusKey(request) === statusFilter);
      if (!matchesStatus) {
        return false;
      }

      const matchesProspectStatus =
        prospectStatusFilter === 'all' || (request.prospectStatus || 'NOUVEAU') === prospectStatusFilter;
      if (!matchesProspectStatus) {
        return false;
      }

      const matchesInteractionType =
        interactionTypeFilter === 'all' ||
        request.derniereInteractionType === interactionTypeFilter ||
        request.prochaineRelanceType === interactionTypeFilter;
      if (!matchesInteractionType) {
        return false;
      }

      const matchesCommercial =
        commercialFilter === 'all' || request.commercialAttribue === commercialFilter;
      if (!matchesCommercial) {
        return false;
      }

      const matchesRegion = regionFilter === 'all' || request.region === regionFilter;
      if (!matchesRegion) {
        return false;
      }

      const searchable = [
        request.dossierId,
        request.nomCommercant,
        request.nom,
        request.prenom,
        request.email,
        request.telephone,
        request.ville,
        request.region,
        request.typeAffiliation,
        request.prospectStatus,
        request.derniereInteractionType,
        request.prochaineRelanceType
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase();

      return !term || searchable.includes(term);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, searchTerm, statusFilter, prospectStatusFilter, interactionTypeFilter, commercialFilter, regionFilter]);

  const pageHeading = isSupervisorMode ? 'Prospections commerciales' : 'Demandes créées par la commerciale';
  const pageSubheading = isSupervisorMode
    ? 'Toutes les demandes créées par les commerciales, avec statut de prospection et état du dossier.'
    : 'Brouillons, corrections demandées et dossiers finalisés depuis le poste commercial.';
  const tableHelper = isSupervisorMode
    ? 'Vue globale superviseur: toutes les commerciales et tous les statuts de prospection.'
    : "Chaque demande peut être reprise tant qu'elle est en brouillon ou renvoyée pour correction.";

  function formatProspectStatus(status: string): string {
    return PROSPECT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? formatEnumLabel(status);
  }
  function formatInteractionType(type: string): string {
    return INTERACTION_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? formatEnumLabel(type);
  }
  function getStatusLabel(request: AffiliationRequestItem): string {
    if (request.status === 'BROUILLON') {
      return 'Brouillon';
    }
    return getAffiliationStatusLabel(request);
  }
  function getProspectStatusLabel(request: AffiliationRequestItem): string {
    return formatProspectStatus(request.prospectStatus || 'NOUVEAU');
  }
  function getPrimaryActionLabel(request: AffiliationRequestItem): string {
    if (request.status === 'BROUILLON') {
      return 'Continuer brouillon';
    }
    if (request.status === 'SOUMIS') {
      return 'Compléter et finaliser';
    }
    if (request.status === 'INCOMPLET') {
      return 'Corriger';
    }
    return 'Modifier / suivre';
  }
  function canContinue(request: AffiliationRequestItem): boolean {
    return isCommercialMode && (
      request.status === 'BROUILLON' ||
      request.status === 'SOUMIS' ||
      request.status === 'INCOMPLET'
    );
  }
  function canEditInteractionsFor(request: AffiliationRequestItem): boolean {
    return isCommercialMode && (
      request.status === 'BROUILLON' ||
      request.status === 'SOUMIS' ||
      request.status === 'INCOMPLET'
    );
  }

  const canEditSelectedInteractions = !!selectedRequest && canEditInteractionsFor(selectedRequest);

  function clearFilters() {
    setSearchTerm('');
    setStatusFilter('all');
    setProspectStatusFilter('all');
    setInteractionTypeFilter('all');
    setCommercialFilter('all');
    setRegionFilter('all');
  }

  function createRequest() {
    if (!isCommercialMode) {
      return;
    }
    navigate('/commercial/dossiers/new');
  }
  function continueRequest(request: AffiliationRequestItem) {
    if (!isCommercialMode) {
      return;
    }
    // Pour un dossier renvoye "a corriger" (INCOMPLET), passer ?correction=1 :
    // c'est ce flag qui fait que seuls les champs cibles par la correction
    // restent modifiables dans CommercialDossierCreatePage (sinon tout le
    // formulaire redevient editable, cf. isCorrectionMode).
    const suffix = request.status === 'INCOMPLET' ? '?correction=1' : '';
    navigate(`/commercial/demandes-commerciales/${request.dossierId}/continue${suffix}`);
  }
  function openDetail(request: AffiliationRequestItem) {
    if (isSupervisorMode) {
      // The detail page is shared with "Demandes affiliation"; keep "Prospections
      // commerciales" highlighted in the drawer since that's where this dossier
      // was actually opened from (see SupervisorDashboard's activeUrlOverride).
      navigate(`/supervisor/affiliation-requests/${request.dossierId}`, {
        state: { activeDrawerRoute: '/supervisor/prospections' }
      });
      return;
    }
    navigate(`/commercial/demandes-commerciales/${request.dossierId}`);
  }

  function openCorrectionEmail(request: AffiliationRequestItem) {
    const recipient = request.email?.trim();
    if (!recipient) {
      setErrorMessage("Aucune adresse e-mail commerçant n'est disponible pour ce dossier.");
      return;
    }
    const subject = `Complément demandé pour votre dossier #${request.dossierId}`;
    const body = buildCorrectionEmailBody({
      dossierId: request.dossierId,
      nomCommercant: request.nomCommercant,
      motifRefus: request.motifRefus
    });
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function loadInteractions(dossierId: number) {
    setIsLoadingInteractions(true);
    try {
      const response = await getCommercialInteractions(dossierId);
      setSelectedInteractions(response.interactions);
    } catch {
      setSelectedInteractions([]);
      setErrorMessage("Impossible de charger l'historique commercial.");
    } finally {
      setIsLoadingInteractions(false);
    }
  }

  function selectInteractionRequest(request: AffiliationRequestItem, interactionType = 'APPEL') {
    setSelectedRequest(request);
    setInteractionForm(createInteractionForm(request, interactionType));
    loadInteractions(request.dossierId);
  }
  function closeInteractionPanel() {
    setSelectedRequest(null);
    setSelectedInteractions([]);
    setSuccessMessage('');
  }

  function getInteractionProspectStatusOptions(): Array<{ value: string; label: string }> {
    const allowed = ALLOWED_PROSPECT_BY_TYPE[interactionForm.typeInteraction] ?? ['CONTACTE'];
    return PROSPECT_STATUS_OPTIONS.filter((option) => allowed.includes(option.value));
  }

  function handleInteractionTypeChange(type: string) {
    setInteractionForm((prev) => {
      const next = { ...prev, typeInteraction: type };
      const allowed = ALLOWED_PROSPECT_BY_TYPE[type] ?? ['CONTACTE'];
      if (!allowed.includes(next.prospectStatus)) {
        next.prospectStatus = allowed[0] ?? 'CONTACTE';
      }
      if (next.prospectStatus === 'A_RELANCER' && !next.prochaineRelanceType) {
        next.prochaineRelanceType = 'RELANCE';
      }
      return next;
    });
  }

  function handleProspectStatusChange(status: string) {
    setInteractionForm((prev) => {
      const next = { ...prev, prospectStatus: status };
      if (status === 'A_RELANCER' && !next.prochaineRelanceType) {
        next.prochaineRelanceType = 'RELANCE';
      }
      if (status === 'CONVERTI') {
        next.prochaineRelanceDate = '';
        next.prochaineRelanceType = '';
      }
      return next;
    });
  }

  function handleReminderDateChange(value: string) {
    setInteractionForm((prev) => ({
      ...prev,
      prochaineRelanceDate: value,
      prochaineRelanceType: value && !prev.prochaineRelanceType ? 'RELANCE' : prev.prochaineRelanceType
    }));
  }

  const isReminderRequired = interactionForm.prospectStatus === 'A_RELANCER';
  const isAbandonedProspect = interactionForm.prospectStatus === 'ABANDONNE';

  function findMissingInteractionFieldLabel(): string | null {
    if (!interactionForm.resultat.trim() && !['EMAIL', 'VISITE'].includes(interactionForm.typeInteraction)) return 'Résultat';
    if (isReminderRequired && !interactionForm.prochaineRelanceDate.trim()) return 'Date de relance';
    if (isAbandonedProspect && !interactionForm.commentaire.trim()) return 'Motif d’abandon';
    return null;
  }

  async function saveInteraction() {
    if (!selectedRequest || !canEditInteractionsFor(selectedRequest) || isSavingInteraction) {
      return;
    }
    const missingLabel = findMissingInteractionFieldLabel();
    if (missingLabel) {
      setErrorMessage(`Champ obligatoire manquant : ${missingLabel}.`);
      return;
    }
    setIsSavingInteraction(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const payload = {
        ...interactionForm,
        resultat: interactionForm.resultat.trim() || defaultInteractionResult(interactionForm.typeInteraction)
      };
      const response = await addCommercialInteraction(selectedRequest.dossierId, payload);
      setSelectedInteractions(response.interactions);
      const syncedCalendars = [
        response.googleCalendarSynced ? 'Google Calendar' : '',
        response.microsoftCalendarSynced ? 'Outlook Calendar' : ''
      ].filter(Boolean);
      const calendarMessages = [
        response.googleCalendarMessage,
        response.microsoftCalendarMessage
      ].filter((message): message is string => Boolean(message));
      setSuccessMessage(
        syncedCalendars.length > 0
          ? `Interaction commerciale enregistrée et ajoutée à ${syncedCalendars.join(' et ')}.`
          : calendarMessages.length > 0
            ? `Interaction commerciale enregistrée. ${calendarMessages.join(' ')}`
            : 'Interaction commerciale enregistrée.'
      );
      setInteractionForm(createInteractionForm(selectedRequest));
      loadRequests();
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, "Impossible d'enregistrer l'interaction commerciale."));
    } finally {
      setIsSavingInteraction(false);
    }
  }

  function defaultInteractionResult(type: string): string {
    if (type === 'EMAIL') return 'E-mail envoyé';
    if (type === 'VISITE') return 'Visite réalisée';
    return 'Interaction réalisée';
  }

  if (!hasAccess) {
    return (
      <div className="access-card">
        <strong>Accès indisponible</strong>
        <span>Cette page est réservée au poste commercial ou superviseur.</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-grid dashboard-page commercial-direct-page commercial-mode">
        <div className="page-card filter-card">
          <div className="filter-panel direct-filter-panel">
            <div className="filter-panel-head">
              <div>
                <strong>{pageHeading}</strong>
                <span>{pageSubheading}</span>
              </div>
              {isCommercialMode && (
                <button type="button" className="new-request-btn" onClick={createRequest}>
                  + Nouvelle demande
                </button>
              )}
            </div>

            <div className="filter-form-grid direct-filter-grid">
              <div className="search-field">
                <label htmlFor="direct-search">Recherche</label>
                <input
                  id="direct-search"
                  type="search"
                  className="form-input"
                  placeholder="Nom, e-mail, téléphone, ville ou dossier"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="filter-field">
                <label htmlFor="direct-prospect-status">Statut prospection</label>
                <select
                  id="direct-prospect-status"
                  className="form-input"
                  value={prospectStatusFilter}
                  onChange={(e) => setProspectStatusFilter(e.target.value)}
                >
                  <option value="all">Tous les statuts</option>
                  {PROSPECT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-field">
                <label htmlFor="direct-interaction-type">Type interaction</label>
                <select
                  id="direct-interaction-type"
                  className="form-input"
                  value={interactionTypeFilter}
                  onChange={(e) => setInteractionTypeFilter(e.target.value)}
                >
                  <option value="all">Tous les types</option>
                  {INTERACTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {isSupervisorMode && (
                <div className="filter-field">
                  <label htmlFor="direct-commercial">Commerciale</label>
                  <select
                    id="direct-commercial"
                    className="form-input"
                    value={commercialFilter}
                    onChange={(e) => setCommercialFilter(e.target.value)}
                  >
                    <option value="all">Toutes les commerciales</option>
                    {commercialOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="filter-field">
                <label htmlFor="direct-region">Région</label>
                <select
                  id="direct-region"
                  className="form-input"
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                >
                  <option value="all">Toutes les régions</option>
                  {regionOptions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="filter-status-strip">
            <div className="filter-status-copy">
              <strong>État de traitement</strong>
              <span>Filtrez les brouillons et les demandes à finaliser.</span>
            </div>

            <div className="filter-actions">
              {statusOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`status-filter status-${option.key}${statusFilter === option.key ? ' is-selected' : ''}`}
                  onClick={() => setStatusFilter(option.key)}
                >
                  {option.label} ({option.count})
                </button>
              ))}
              <button type="button" className="clear-filters-btn" onClick={clearFilters}>
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        <div className="page-card table-card">
          {errorMessage && (
            <div className="page-alert error" role="alert">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="page-alert success" role="status">
              {successMessage}
            </div>
          )}

          {isLoading ? (
            <div className="page-loading">
              <div className="page-loading-spinner" />
              <span>Chargement des demandes commerciales...</span>
            </div>
          ) : !filteredRequests.length ? (
            <div className="empty-state">Aucune demande commerciale ne correspond aux critères.</div>
          ) : (
            <>
              <div className="table-toolbar">
                <div className="table-summary">
                  <strong>{filteredRequests.length} demande(s) commerciale(s)</strong>
                  <span>{tableHelper}</span>
                </div>
              </div>

              <div className="table-scroll">
                <table className="data-table request-table direct-request-table">
                  <thead>
                    <tr>
                      <th>Dossier</th>
                      <th>Commerçant</th>
                      <th>Affiliation</th>
                      <th>État</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((item) => (
                      <tr key={item.dossierId} className={`row-${getStatusKey(item)}`}>
                        <td>
                          <strong>#{item.dossierId}</strong>
                          <span>{formatEnumLabel(item.typeCommercant)}</span>
                        </td>
                        <td>
                          <strong>{item.nomCommercant || item.email || 'Brouillon sans nom'}</strong>
                          <span>
                            {item.nom} {item.prenom}
                          </span>
                          <span>{item.email || '-'}</span>
                          <span>{item.telephone || '-'}</span>
                        </td>
                        <td>
                          <strong>{formatEnumLabel(item.typeAffiliation)}</strong>
                          <span>{item.activite || '-'}</span>
                          <span>
                            {item.ville || '-'} / {item.region || '-'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge status-${getStatusKey(item)}`}>
                            {getStatusLabel(item)}
                          </span>
                          <span className="status-badge prospect-badge">{getProspectStatusLabel(item)}</span>
                          <span className="table-meta">
                            Commercial: {item.commercialAttribue || 'Poste courant'}
                          </span>
                          <span className="table-meta">
                            Dernière action: {item.derniereInteractionCommerciale || 'Aucune'}
                          </span>
                          {item.derniereInteractionType && (
                            <span className="table-meta">
                              Dernière interaction: {formatInteractionType(item.derniereInteractionType)}
                            </span>
                          )}
                          {item.prochaineRelanceCommerciale && (
                            <span className="table-meta">Relance: {item.prochaineRelanceCommerciale}</span>
                          )}
                          {item.prochaineRelanceType && (
                            <span className="table-meta">
                              Type relance: {formatInteractionType(item.prochaineRelanceType)}
                            </span>
                          )}
                          {item.motifRefus && (
                            <span className="table-meta">
                              {item.status === 'INCOMPLET' ? 'Motif correction' : 'Motif refus'}: {summarizeCorrectionRequest(item.motifRefus)}
                            </span>
                          )}
                        </td>
                        <td>
                          <strong>
                            {item.dateSoumission
                              ? new Date(item.dateSoumission).toLocaleDateString('fr-MA')
                              : '-'}
                          </strong>
                          <span>CR: {item.commercialReportDisponible ? 'généré' : 'non généré'}</span>
                        </td>
                        <td>
                          <div className="table-actions">
                            {canContinue(item) && (
                              <button
                                type="button"
                                className="action-btn action-btn-primary"
                                onClick={() => continueRequest(item)}
                              >
                                {getPrimaryActionLabel(item)}
                              </button>
                            )}
                            {canEditInteractionsFor(item) && getStatusKey(item) === 'correction' && (
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => openCorrectionEmail(item)}
                              >
                                Email
                              </button>
                            )}
                            <button type="button" className="action-btn" onClick={() => openDetail(item)}>
                              Dossier
                            </button>
                            {getStatusKey(item) !== 'correction' && (
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => selectInteractionRequest(item)}
                              >
                                {canEditInteractionsFor(item) ? 'Interaction' : 'Historique'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedRequest && (
        <section className="interaction-overlay" onClick={closeInteractionPanel}>
          <div
            className="interaction-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="interaction-head">
              <div>
                <strong>Interaction prospection</strong>
                <span>
                  Dossier #{selectedRequest.dossierId} ·{' '}
                  {selectedRequest.nomCommercant || selectedRequest.email} ·{' '}
                  {getProspectStatusLabel(selectedRequest)}
                </span>
              </div>
              <button
                type="button"
                className="icon-action-btn"
                aria-label="Fermer"
                onClick={closeInteractionPanel}
              >
                ✕
              </button>
            </div>

            <div className={`interaction-dialog-body${canEditSelectedInteractions ? '' : ' history-only'}`}>
              {canEditSelectedInteractions && (
                <div className="interaction-form-stack">
                  <section className="interaction-step">
                    <div className="step-title">
                      <span>1</span>
                      <div>
                        <strong>Action réalisée</strong>
                        <small>Choisir ce que la commerciale vient de faire.</small>
                      </div>
                    </div>
                    <div className="interaction-form-grid">
                      <div className="filter-field">
                        <label>Type d'interaction</label>
                        <select
                          className="form-input"
                          value={interactionForm.typeInteraction}
                          onChange={(e) => handleInteractionTypeChange(e.target.value)}
                        >
                          {INTERACTION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="filter-field">
                        <label>Date de l'action</label>
                        <input
                          type="date"
                          className="form-input"
                          value={interactionForm.dateInteraction}
                          onChange={(e) =>
                            setInteractionForm((prev) => ({ ...prev, dateInteraction: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </section>

                  <section className="interaction-step">
                    <div className="step-title">
                      <span>2</span>
                      <div>
                        <strong>Résultat</strong>
                        <small>Résumer la réponse du prospect.</small>
                      </div>
                    </div>
                    <div className="filter-field field-full">
                      <label>Résultat</label>
                      <input
                        className="form-input"
                        placeholder="Répondu, RDV confirmé, pas intéressé..."
                        value={interactionForm.resultat}
                        onChange={(e) =>
                          setInteractionForm((prev) => ({ ...prev, resultat: e.target.value }))
                        }
                      />
                    </div>
                  </section>

                  <section className="interaction-step">
                    <div className="step-title">
                      <span>3</span>
                      <div>
                        <strong>Statut prospection</strong>
                        <small>Le statut disponible dépend du type d'interaction choisi.</small>
                      </div>
                    </div>
                    <div className="filter-field field-full">
                      <label>Statut du prospect</label>
                      <select
                        className="form-input"
                        value={interactionForm.prospectStatus}
                        onChange={(e) => handleProspectStatusChange(e.target.value)}
                      >
                        {getInteractionProspectStatusOptions().map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </section>

                  {interactionForm.prospectStatus !== 'CONVERTI' && (
                    <section className="interaction-step">
                      <div className="step-title">
                        <span>4</span>
                        <div>
                          <strong>Prochaine relance</strong>
                          <small>
                            {isReminderRequired
                              ? 'Obligatoire pour un prospect à relancer.'
                              : 'Optionnel si aucune relance n’est prévue.'}
                          </small>
                        </div>
                      </div>
                      <div className="interaction-form-grid">
                        <div className="filter-field">
                          <label>
                            {isReminderRequired ? 'Date de relance obligatoire' : 'Date de relance'}
                          </label>
                          <input
                            type="date"
                            className="form-input"
                            value={interactionForm.prochaineRelanceDate}
                            onChange={(e) => handleReminderDateChange(e.target.value)}
                          />
                        </div>
                        <div className="filter-field">
                          <label>Type de relance</label>
                          <select
                            className="form-input"
                            value={interactionForm.prochaineRelanceType}
                            onChange={(e) =>
                              setInteractionForm((prev) => ({
                                ...prev,
                                prochaineRelanceType: e.target.value
                              }))
                            }
                          >
                            <option value="">Aucune</option>
                            {INTERACTION_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="interaction-step">
                    <div className="step-title">
                      <span>5</span>
                      <div>
                        <strong>{isAbandonedProspect ? 'Motif obligatoire' : 'Commentaire'}</strong>
                        <small>
                          {isAbandonedProspect
                            ? 'Expliquer pourquoi le prospect est abandonné.'
                            : 'Ajouter un détail utile pour la prochaine action.'}
                        </small>
                      </div>
                    </div>
                    <div className="filter-field field-full">
                      <label>{isAbandonedProspect ? 'Motif d’abandon' : 'Commentaire'}</label>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={interactionForm.commentaire}
                        onChange={(e) =>
                          setInteractionForm((prev) => ({ ...prev, commentaire: e.target.value }))
                        }
                      />
                    </div>
                  </section>
                </div>
              )}

              <aside className="interaction-history">
                <strong>Historique</strong>
                {isLoadingInteractions ? (
                  <div className="page-loading interaction-loading">
                    <div className="page-loading-spinner" />
                    <span>Chargement...</span>
                  </div>
                ) : !selectedInteractions.length ? (
                  <div className="empty-state inline-empty">Aucune interaction commerciale.</div>
                ) : (
                  selectedInteractions.map((interaction) => (
                    <article className="interaction-item" key={interaction.interactionId}>
                      <div>
                        <strong>{formatInteractionType(interaction.typeInteraction)}</strong>
                        <span>
                          {interaction.dateInteraction || '-'} ·{' '}
                          {interaction.resultat || 'Sans résultat'}
                        </span>
                      </div>
                      <p>{interaction.commentaire || '-'}</p>
                      {interaction.prochaineRelanceDate && (
                        <small>
                          Relance {formatInteractionType(interaction.prochaineRelanceType)} le{' '}
                          {interaction.prochaineRelanceDate}
                        </small>
                      )}
                    </article>
                  ))
                )}
              </aside>
            </div>

            <div className="interaction-actions">
              <button type="button" className="action-btn" onClick={closeInteractionPanel}>
                {canEditSelectedInteractions ? 'Annuler' : 'Fermer'}
              </button>
              {canEditSelectedInteractions && (
                <button
                  type="button"
                  className="action-btn action-btn-primary"
                  disabled={isSavingInteraction}
                  onClick={saveInteraction}
                >
                  {isSavingInteraction ? 'Enregistrement...' : 'Enregistrer interaction'}
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
