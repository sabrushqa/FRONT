import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'chart.js/auto';
import { useSessionStore } from '../../../../store/sessionStore';
import {
  getAffiliationRequests,
  getOverview,
  AffiliationRequestItem,
  SupervisorOverviewResponse
} from '../../../supervisor/services/supervisorApi';
import {
  formatEnumLabel,
  resolveAffiliationStatusKey,
  isCommercialDirectRequest,
  isSameRegionAsCommercial,
  getWorkspaceRoleLabel
} from '../../../workspace/workspaceUtils';
import '../../../../styles/commercial-page.scss';
import '../../../../styles/commercial-overview.scss';

const chartColors = {
  green: '#16a34a',
  red: '#ef4444',
  blue: '#f8c526',
  yellow: '#f8c526',
  pink: '#ec4899',
  sky: '#d6a900',
  violet: '#7c3aed',
  teal: '#0d9488'
};

type StatusKey = 'pending' | 'progress' | 'sent' | 'active' | 'refused';

function isCorrectionRequest(request: AffiliationRequestItem): boolean {
  return request.status === 'INCOMPLET';
}

function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const AFFILIATION_TYPES = [
  { key: 'TPE', label: 'TPE' },
  { key: 'E_COMMERCE', label: 'E-commerce' },
  { key: 'SOFTPOS', label: 'SoftPOS' },
  { key: 'QR_CODE', label: 'QR Code' },
  { key: 'ENCAISSEMENT_ET_ECOMMERCE', label: 'TPE + E-commerce' }
];

// Lundi de la semaine contenant `date` (bornes de semaine ISO).
function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diffToMonday);
  return result;
}

function isSameWeek(date: Date, weekStart: Date): boolean {
  const diffDays = Math.round((startOfWeek(date).getTime() - weekStart.getTime()) / 86400000);
  return diffDays === 0;
}

// Semaines (lundis) qui recouvrent le mois `month` (0-11) de l'annee `year`.
function weeksOfMonth(year: number, month: number): { start: Date; label: string }[] {
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: { start: Date; label: string }[] = [];
  let cursor = startOfWeek(firstDay);
  const lastWeekStart = startOfWeek(lastDay);
  while (cursor.getTime() <= lastWeekStart.getTime()) {
    weeks.push({ start: new Date(cursor), label: formatter.format(cursor) });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index,
  label: new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(2000, index, 1))
}));

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    || document.body.getAttribute('data-theme') === 'dark';
}

export default function CommercialOverviewPage() {
  const { session } = useSessionStore();

  const [overview, setOverview] = useState<SupervisorOverviewResponse>({
    backOffices: [],
    commerciales: [],
    commercants: []
  });
  const [affiliationRequests, setAffiliationRequests] = useState<AffiliationRequestItem[]>([]);
  const [commercialDirectRequests, setCommercialDirectRequests] = useState<AffiliationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const convertedDirectByTypeRef = useRef<HTMLCanvasElement>(null);
  const weeklyProspectionStatusRef = useRef<HTMLCanvasElement>(null);
  const weeklyAutoStatusRef = useRef<HTMLCanvasElement>(null);
  const convertedByTypeRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);

  const role = session?.role;
  const isCommercial = role === 'COMMERCIAL';
  const canManageStaff = role === 'SUPERVISEUR';
  const canManageAffiliationRequests =
    role === 'SUPERVISEUR' || role === 'COMMERCIAL' || role === 'BACK_OFFICE';

  const workspaceLabel = getWorkspaceRoleLabel(role);
  const dossiersRoute = isCommercial ? '/commercial/dossiers' : '/supervisor/affiliation-requests';

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const overviewPromise = canManageStaff
          ? getOverview()
          : Promise.resolve({ backOffices: [], commerciales: [], commercants: [] } as SupervisorOverviewResponse);
        const affiliationPromise = canManageAffiliationRequests
          ? getAffiliationRequests()
          : Promise.resolve({ requests: [] as AffiliationRequestItem[] });

        const [overviewData, affiliation] = await Promise.all([overviewPromise, affiliationPromise]);
        if (cancelled) return;
        const requests = Array.isArray(affiliation.requests) ? affiliation.requests : [];
        const autoAffiliationRequests = requests.filter((r) => !isCommercialDirectRequest(r));
        setOverview(overviewData);
        setAffiliationRequests(
          isCommercial
            ? autoAffiliationRequests.filter((r) => isSameRegionAsCommercial(r, session?.profile?.region))
            : autoAffiliationRequests
        );
        setCommercialDirectRequests(requests.filter((r) => isCommercialDirectRequest(r)));
      } catch {
        if (!cancelled) setErrorMessage('Les indicateurs de la page overview sont indisponibles.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [canManageStaff, canManageAffiliationRequests, isCommercial, session?.utilisateurId, session?.profile?.region]);

  // ----- Derived metrics -----
  const countByStatus = (status: StatusKey): number =>
    affiliationRequests.filter((r) => resolveAffiliationStatusKey(r) === status).length;

  const pendingCount = countByStatus('pending');
  const correctionCount = affiliationRequests.filter(isCorrectionRequest).length
    + commercialDirectRequests.filter(isCorrectionRequest).length;
  const progressCount = countByStatus('progress');
  const sentCount = countByStatus('sent');
  const activeCount = countByStatus('active');

  const isOwnedByConnectedCommercial = useMemo(() => {
    const candidates = [session?.nom, session?.email, session?.profile?.nom, session?.profile?.email]
      .map((v) => normalizeForMatch(v))
      .filter(Boolean);
    return (request: AffiliationRequestItem): boolean => {
      const label = normalizeForMatch(request.commercialAttribue);
      if (!label) return false;
      return candidates.some((c) => label === c || label.includes(c) || c.includes(label));
    };
  }, [session?.nom, session?.email, session?.profile?.nom, session?.profile?.email]);

  const commercialKpis = useMemo(() => {
    const ownedProspects = commercialDirectRequests.filter(isOwnedByConnectedCommercial);
    const convertedProspects = ownedProspects.filter(
      (request) => request.status === 'ACCEPTE' || request.prospectStatus === 'CONVERTI'
    );
    const portfolioRequests = [...affiliationRequests, ...ownedProspects];
    const currentMonthAffiliations = portfolioRequests.filter((request) => {
      if (request.status !== 'ACCEPTE') return false;
      const validationDate = parseDate(request.dateTraitementBackOffice ?? request.dateSoumission);
      return validationDate?.getFullYear() === now.getFullYear()
        && validationDate.getMonth() === now.getMonth();
    }).length;
    const processingDurations = portfolioRequests.flatMap((request) => {
      if (request.status !== 'ACCEPTE') return [];
      const createdAt = parseDate(request.dateCreation ?? request.dateSoumission);
      const validatedAt = parseDate(request.dateTraitementBackOffice);
      if (!createdAt || !validatedAt || validatedAt < createdAt) return [];
      return [(validatedAt.getTime() - createdAt.getTime()) / 86400000];
    });

    return {
      conversionRate: ownedProspects.length
        ? Math.round((convertedProspects.length / ownedProspects.length) * 100)
        : 0,
      currentMonthAffiliations,
      pendingRequests: portfolioRequests.filter(
        (request) => resolveAffiliationStatusKey(request) === 'pending'
      ).length,
      averageProcessingDays: processingDurations.length
        ? processingDurations.reduce((sum, days) => sum + days, 0) / processingDurations.length
        : null
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliationRequests, commercialDirectRequests, isOwnedByConnectedCommercial]);

  // Annees disponibles pour le filtre : annee courante +/- 2 (pour planifier ou consulter
  // l'historique proche meme sans dossier existant), completees par toute annee reellement
  // presente parmi les dossiers charges (au cas ou elle sortirait de cette fenetre).
  const availableYears = useMemo(() => {
    const currentYear = now.getFullYear();
    const years = new Set<number>([
      currentYear - 2,
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2
    ]);
    [...affiliationRequests, ...commercialDirectRequests].forEach((r) => {
      const d = parseDate(r.dateSoumission);
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliationRequests, commercialDirectRequests]);

  const selectedMonthLabel = MONTH_OPTIONS[selectedMonth]?.label ?? '';

  // Graphe 1 — prospections directes deja converties (status ACCEPTE) par la commerciale
  // connectee sur l'annee selectionnee, reparties par type d'affiliation. (StatusDossier ne
  // connait pas de statut "ACTIF" cote backend — seul ACCEPTE marque une conversion.)
  const convertedDirectByType = useMemo(() => {
    const validated = commercialDirectRequests.filter((r) => {
      const d = parseDate(r.dateSoumission);
      return r.status === 'ACCEPTE'
        && isOwnedByConnectedCommercial(r)
        && !!d && d.getFullYear() === selectedYear;
    });
    const counts = new Map<string, number>();
    validated.forEach((r) => {
      const type = r.typeAffiliation || '';
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });
    return AFFILIATION_TYPES.map((t) => ({ label: t.label, value: counts.get(t.key) ?? 0 }));
  }, [commercialDirectRequests, isOwnedByConnectedCommercial, selectedYear]);

  // Graphe 2 — prospections directes par semaine du mois/annee selectionnes, par statut de suivi.
  const PROSPECTION_WEEKLY_STATUSES = [
    { key: 'BROUILLON', label: 'Brouillon', match: (r: AffiliationRequestItem) => r.status === 'BROUILLON' },
    { key: 'A_RELANCER', label: 'À relancer', match: (r: AffiliationRequestItem) => r.prospectStatus === 'A_RELANCER' },
    { key: 'VALIDE', label: 'Validé', match: (r: AffiliationRequestItem) => r.status === 'ACCEPTE' },
    { key: 'CONTACTE', label: 'En contact', match: (r: AffiliationRequestItem) => r.prospectStatus === 'CONTACTE' },
    { key: 'EN_NEGOCIATION', label: 'En négociation', match: (r: AffiliationRequestItem) => r.prospectStatus === 'EN_NEGOCIATION' }
  ];
  const weeklyProspectionByStatus = useMemo(() => {
    const weeks = weeksOfMonth(selectedYear, selectedMonth);
    const owned = commercialDirectRequests.filter((r) => isOwnedByConnectedCommercial(r));
    return weeks.map((week) => {
      const inWeek = owned.filter((r) => {
        const d = parseDate(r.dateSoumission);
        return d && isSameWeek(d, week.start);
      });
      const row: Record<string, number | string> = { label: week.label };
      PROSPECTION_WEEKLY_STATUSES.forEach((s) => {
        row[s.key] = inWeek.filter(s.match).length;
      });
      return row;
    });
  }, [commercialDirectRequests, isOwnedByConnectedCommercial, selectedYear, selectedMonth]);

  // Graphe 3 — demandes d'auto-affiliation par semaine du mois/annee selectionnes, par statut
  // (a traiter = soumis par le commercant, a corriger = renvoye par le back office).
  const AUTO_WEEKLY_STATUSES = [
    { key: 'A_TRAITER', label: 'À traiter', match: (r: AffiliationRequestItem) => r.status === 'SOUMIS' },
    { key: 'A_CORRIGER', label: 'À corriger', match: (r: AffiliationRequestItem) => r.status === 'INCOMPLET' }
  ];
  const weeklyAutoByStatus = useMemo(() => {
    const weeks = weeksOfMonth(selectedYear, selectedMonth);
    const owned = affiliationRequests.filter((r) => isOwnedByConnectedCommercial(r));
    return weeks.map((week) => {
      const inWeek = owned.filter((r) => {
        const d = parseDate(r.dateSoumission);
        return d && isSameWeek(d, week.start);
      });
      const row: Record<string, number | string> = { label: week.label };
      AUTO_WEEKLY_STATUSES.forEach((s) => {
        row[s.key] = inWeek.filter(s.match).length;
      });
      return row;
    });
  }, [affiliationRequests, isOwnedByConnectedCommercial, selectedYear, selectedMonth]);

  // Graphe 4 — demandes d'auto-affiliation deja converties (validees), par mois de l'annee
  // selectionnee (Janvier a Decembre), reparties par type d'affiliation.
  const convertedByTypeMonthly = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const months = Array.from({ length: 12 }, (_, index) => ({
      year: selectedYear,
      month: index,
      label: formatter.format(new Date(selectedYear, index, 1))
    }));
    const converted = affiliationRequests.filter(
      (r) => r.status === 'ACCEPTE' && isOwnedByConnectedCommercial(r)
    );
    return months.map((m) => {
      const inMonth = converted.filter((r) => {
        const d = parseDate(r.dateSoumission);
        return d && d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const row: Record<string, number | string> = { label: m.label };
      AFFILIATION_TYPES.forEach((t) => {
        row[t.key] = inMonth.filter((r) => r.typeAffiliation === t.key).length;
      });
      return row;
    });
  }, [affiliationRequests, isOwnedByConnectedCommercial, selectedYear]);

  // ----- Charts -----
  function baseChartOptions(type: 'bar' | 'line' | 'doughnut'): Record<string, unknown> {
    const isCircular = type === 'doughnut';
    const textColor = isDarkTheme() ? '#cbd5e1' : '#334155';
    const mutedColor = isDarkTheme() ? '#94a3b8' : '#64748b';
    const gridColor = isDarkTheme() ? 'rgba(148, 163, 184, 0.18)' : '#e2e8f0';
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: isCircular ? 'bottom' : 'top',
          labels: { boxWidth: 10, color: textColor, font: { size: 11 } }
        },
        tooltip: { backgroundColor: '#0f172a', titleColor: '#ffffff', bodyColor: '#ffffff', padding: 10 }
      },
      scales: isCircular
        ? undefined
        : {
            x: { ticks: { color: mutedColor }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { precision: 0, color: mutedColor }, grid: { color: gridColor } }
          }
    };
  }

  function stackedBarOptions(): Record<string, unknown> {
    const base = baseChartOptions('bar') as { scales: { x: object; y: object } };
    return {
      ...base,
      scales: {
        x: { ...base.scales.x, stacked: true },
        y: { ...base.scales.y, stacked: true }
      }
    };
  }

  useEffect(() => {
    if (isLoading || !isCommercial) return;

    chartsRef.current.splice(0).forEach((c) => c.destroy());

    // Graphe 1 — prospections directes validées/actives par la commerciale, par type d'affiliation.
    if (convertedDirectByTypeRef.current) {
      chartsRef.current.push(
        new Chart(convertedDirectByTypeRef.current, {
          type: 'doughnut',
          data: {
            labels: convertedDirectByType.map((p) => p.label),
            datasets: [
              {
                data: convertedDirectByType.map((p) => p.value),
                backgroundColor: [chartColors.yellow, chartColors.sky, chartColors.pink, chartColors.green, chartColors.teal],
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 8
              }
            ]
          },
          options: { ...baseChartOptions('doughnut'), cutout: '66%' }
        })
      );
    }

    // Graphe 2 — prospections directes par semaine (8 dernières semaines), par statut de suivi.
    if (weeklyProspectionStatusRef.current) {
      const weeklyColors = [chartColors.yellow, chartColors.red, chartColors.green, chartColors.sky, chartColors.violet];
      chartsRef.current.push(
        new Chart(weeklyProspectionStatusRef.current, {
          type: 'bar',
          data: {
            labels: weeklyProspectionByStatus.map((row) => String(row.label)),
            datasets: PROSPECTION_WEEKLY_STATUSES.map((s, index) => ({
              label: s.label,
              data: weeklyProspectionByStatus.map((row) => Number(row[s.key])),
              backgroundColor: weeklyColors[index],
              borderRadius: 4,
              borderSkipped: false
            }))
          },
          options: stackedBarOptions()
        })
      );
    }

    // Graphe 3 — demandes auto-affiliation par semaine (8 dernières semaines), par statut.
    if (weeklyAutoStatusRef.current) {
      const weeklyColors = [chartColors.sky, chartColors.red];
      chartsRef.current.push(
        new Chart(weeklyAutoStatusRef.current, {
          type: 'bar',
          data: {
            labels: weeklyAutoByStatus.map((row) => String(row.label)),
            datasets: AUTO_WEEKLY_STATUSES.map((s, index) => ({
              label: s.label,
              data: weeklyAutoByStatus.map((row) => Number(row[s.key])),
              backgroundColor: weeklyColors[index],
              borderRadius: 4,
              borderSkipped: false
            }))
          },
          options: stackedBarOptions()
        })
      );
    }

    // Graphe 4 — prospections directes converties par mois (6 derniers mois), par type d'affiliation.
    if (convertedByTypeRef.current) {
      const typeColors = [chartColors.yellow, chartColors.sky, chartColors.pink, chartColors.green, chartColors.teal];
      chartsRef.current.push(
        new Chart(convertedByTypeRef.current, {
          type: 'bar',
          data: {
            labels: convertedByTypeMonthly.map((row) => String(row.label)),
            datasets: AFFILIATION_TYPES.map((t, index) => ({
              label: t.label,
              data: convertedByTypeMonthly.map((row) => Number(row[t.key])),
              backgroundColor: typeColors[index],
              borderRadius: 4,
              borderSkipped: false
            }))
          },
          options: stackedBarOptions()
        })
      );
    }

    return () => {
      chartsRef.current.splice(0).forEach((c) => c.destroy());
    };
  }, [
    isLoading,
    isCommercial,
    convertedDirectByType,
    weeklyProspectionByStatus,
    weeklyAutoByStatus,
    convertedByTypeMonthly
  ]);

  // ----- Non-commercial metric cards -----
  const metricCards = canManageStaff
    ? [
        { label: 'Back office', value: overview.backOffices.length, helper: 'Équipe de support et de validation' },
        { label: 'Commerciales', value: overview.commerciales.length, helper: 'Comptes commerciaux en production' },
        { label: 'Commerçants', value: overview.commercants.length, helper: 'Partenaires répertoriés' },
        { label: 'Demandes', value: affiliationRequests.length, helper: `${pendingCount} non traitées` }
      ]
    : [
        { label: 'À corriger', value: correctionCount, helper: 'Retours BOA avec motif' },
        { label: 'En cours', value: progressCount, helper: 'Contrat signé ou back office' },
        { label: 'Contrat à signer', value: sentCount, helper: 'Activation et contrat envoyés' },
        { label: 'Affiliations validées', value: activeCount, helper: 'Dossiers acceptés' }
      ];

  return (
    <div className={`page-grid${isCommercial ? ' commercial-mode' : ''}`}>
      {!isCommercial && (
        <div className="page-card">
          <div className="page-head">
            <div>
              <span className="page-kicker">{workspaceLabel}</span>
              <h2>Pilotage dossiers</h2>
            </div>
            {canManageAffiliationRequests && (
              <Link className="lead-primary-action" to={dossiersRoute}>
                Ouvrir les dossiers
              </Link>
            )}
          </div>

          {errorMessage && (
            <div className="page-alert error" role="alert">
              {errorMessage}
            </div>
          )}

          {isLoading ? (
            <div className="page-loading">
              <span>Chargement des indicateurs...</span>
            </div>
          ) : (
            <div className="stat-grid">
              {metricCards.map((card) => (
                <div className="stat-card" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isCommercial && (
        <>
          {errorMessage && (
            <div className="page-alert error commercial-alert" role="alert">
              <span className="material-icons">error_outline</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="page-loading commercial-loading">
              <span>Chargement de vos indicateurs...</span>
            </div>
          ) : (
            <>
              <section className="commercial-kpi-grid" aria-label="Indicateurs commerciaux globaux">
                <article className="commercial-kpi-card commercial-kpi-card--conversion">
                  <span className="material-icons" aria-hidden="true">trending_up</span>
                  <div>
                    <small>Taux de conversion des prospections</small>
                    <strong>{commercialKpis.conversionRate} %</strong>
                  </div>
                </article>
                <article className="commercial-kpi-card">
                  <span className="material-icons" aria-hidden="true">storefront</span>
                  <div>
                    <small>Commerçants affiliés ce mois</small>
                    <strong>{commercialKpis.currentMonthAffiliations}</strong>
                  </div>
                </article>
                <article className="commercial-kpi-card commercial-kpi-card--pending">
                  <span className="material-icons" aria-hidden="true">pending_actions</span>
                  <div>
                    <small>Dossiers en attente</small>
                    <strong>{commercialKpis.pendingRequests}</strong>
                  </div>
                </article>
                <article className="commercial-kpi-card">
                  <span className="material-icons" aria-hidden="true">schedule</span>
                  <div>
                    <small>Délai moyen de traitement</small>
                    <strong>
                      {commercialKpis.averageProcessingDays === null
                        ? '—'
                        : `${commercialKpis.averageProcessingDays.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`}
                    </strong>
                  </div>
                </article>
              </section>

              <div className="chart-dashboard-filters">
                <label className="form-group">
                  <span>Année</span>
                  <select
                    className="form-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
                <label className="form-group">
                  <span>Mois (graphes hebdomadaires)</span>
                  <select
                    className="form-select"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <section className="chart-dashboard-grid">
                <article className="dashboard-card analytics-card">
                  <div className="card-head">
                    <div>
                      <span className="card-kicker">Type d'affiliation — {selectedYear}</span>
                      <h3>Prospections converties</h3>
                      <p>Prospections directes déjà converties, créées par vous en {selectedYear}, par type d'affiliation.</p>
                    </div>
                  </div>
                  <div className="chart-canvas-wrap">
                    <canvas ref={convertedDirectByTypeRef}></canvas>
                  </div>
                </article>

                <article className="dashboard-card analytics-card">
                  <div className="card-head">
                    <div>
                      <span className="card-kicker">Semaines de {selectedMonthLabel} {selectedYear}</span>
                      <h3>Prospection directe par semaine</h3>
                      <p>Par statut : brouillon, à relancer, validé, en contact, en négociation.</p>
                    </div>
                  </div>
                  <div className="chart-canvas-wrap">
                    <canvas ref={weeklyProspectionStatusRef}></canvas>
                  </div>
                </article>

                <article className="dashboard-card analytics-card">
                  <div className="card-head">
                    <div>
                      <span className="card-kicker">Semaines de {selectedMonthLabel} {selectedYear}</span>
                      <h3>Auto-affiliation par semaine</h3>
                      <p>Dossiers à traiter et dossiers à corriger, par semaine de soumission.</p>
                    </div>
                  </div>
                  <div className="chart-canvas-wrap">
                    <canvas ref={weeklyAutoStatusRef}></canvas>
                  </div>
                </article>

                <article className="dashboard-card analytics-card conversion-card">
                  <div className="card-head">
                    <div>
                      <span className="card-kicker">Mois de {selectedYear}</span>
                      <h3>Auto-affiliation convertie par mois</h3>
                      <p>Demandes d'auto-affiliation déjà converties, par mois et par type d'affiliation.</p>
                    </div>
                  </div>
                  <div className="chart-canvas-wrap">
                    <canvas ref={convertedByTypeRef}></canvas>
                  </div>
                </article>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
