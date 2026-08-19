import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { useSessionStore } from '../../../../store/sessionStore';
import { AffiliationRequestItem, getAffiliationRequests } from '../../../supervisor/services/supervisorApi';
import { isHandledByCurrentBackOffice, needsManualAssignment } from '../../../workspace/workspaceUtils';
import { ReclamationItem, getReclamations } from '../../services/reclamationsApi';
import '../../../../styles/page.shared.scss';
import '../../../../styles/backoffice-overview.scss';

Chart.register(...registerables);

// Palette commune aux 4 graphes de pilotage : bleu, jaune, rose, orange
// (repetee si une serie compte plus de 4 categories).
const PALETTE = ['#2E86DE', '#F1C40F', '#ec4899', '#F97316'];

const AFFILIATION_TYPES = [
  { key: 'TPE', label: 'TPE', color: PALETTE[0] },
  { key: 'E_COMMERCE', label: 'E-commerce', color: PALETTE[1] },
  { key: 'SOFTPOS', label: 'SoftPOS', color: PALETTE[2] },
  { key: 'QR_CODE', label: 'QR Code', color: PALETTE[3] },
  { key: 'ENCAISSEMENT_ET_ECOMMERCE', label: 'TPE + E-commerce', color: PALETTE[0] }
];

const PROBLEME_TYPES = [
  { key: 'CONNECTIVITE', label: 'Connectivité', color: PALETTE[0] },
  { key: 'TRANSACTION', label: 'Transaction', color: PALETTE[1] },
  { key: 'MATERIEL', label: 'Matériel', color: PALETTE[2] },
  { key: 'LOGICIEL', label: 'Logiciel', color: PALETTE[3] },
  { key: 'RESEAU', label: 'Réseau', color: PALETTE[0] },
  { key: 'AUTRE', label: 'Autre', color: PALETTE[1] }
];

const ETAT_META = {
  resolu:   { label: 'Résolu',    color: '#27AE60' },
  escalade: { label: 'Escaladé',  color: '#E74C3C' }
};

// Lundi de la semaine contenant `date`.
function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function isSameWeek(date: Date, weekStart: Date): boolean {
  const diffDays = Math.round((startOfWeek(date).getTime() - weekStart.getTime()) / 86400000);
  return diffDays === 0;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ReclamationItem.backOfficeTraitant est nullable (contrairement a
// AffiliationRequestItem) : on normalise avant de reutiliser le meme helper
// de rattachement au BOA connecte.
function isReclamationHandledByCurrentBackOffice(
  reclamation: Pick<ReclamationItem, 'backOfficeUtilisateurId' | 'backOfficeTraitant'>,
  session: Parameters<typeof isHandledByCurrentBackOffice>[1]
): boolean {
  return isHandledByCurrentBackOffice(
    { backOfficeUtilisateurId: reclamation.backOfficeUtilisateurId, backOfficeTraitant: reclamation.backOfficeTraitant ?? '' },
    session
  );
}

// Une reclamation n'est rattachee a un BOA precis qu'au moment ou elle est
// resolue/escaladee (cf. ReclamationService#updateStatut cote backend) : tant
// qu'elle est EN_ATTENTE/EN_COURS elle n'a pas de back-office assigne et fait
// partie de la file commune, visible par tous les BOA (meme logique que
// ReclamationService#scopeReclamationsForBackOfficeDashboard). On reproduit
// cette regle cote client pour le graphe "reçues" : visible si pas encore
// traitee, ou si traitee par le BOA connecte.
function isReclamationVisibleToCurrentBackOffice(
  reclamation: Pick<ReclamationItem, 'backOfficeUtilisateurId' | 'backOfficeTraitant' | 'statut'>,
  session: Parameters<typeof isHandledByCurrentBackOffice>[1]
): boolean {
  const isHandledStatus = reclamation.statut === 'RESOLU' || reclamation.statut === 'ESCALADE';
  if (!isHandledStatus) return true;
  return isReclamationHandledByCurrentBackOffice(reclamation, session);
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

export default function BackofficeOverviewPage() {
  const navigate = useNavigate();
  const { session } = useSessionStore();
  const peutValiderDossiers = session?.peutValiderDossiers !== false;
  const peutGererReclamations = session?.peutGererReclamations !== false;
  const showDossierStats = peutValiderDossiers;
  const showReclamationStats = peutGererReclamations;
  const showPilotageCharts = showDossierStats || showReclamationStats;

  const [requests, setRequests] = useState<AffiliationRequestItem[]>([]);
  const [allReclamations, setAllReclamations] = useState<ReclamationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const availableYears = useMemo(() => {
    const years = new Set<number>([2026, 2027, 2028, now.getFullYear()]);
    return Array.from(years).sort((a, b) => a - b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const selectedMonthLabel = MONTH_OPTIONS[selectedMonth]?.label ?? '';

  const weeklyRequestsRef = useRef<HTMLCanvasElement>(null);
  const weeklyReclamationsRef = useRef<HTMLCanvasElement>(null);
  const monthlyValidationRef = useRef<HTMLCanvasElement>(null);
  const weeklyTreatedRef = useRef<HTMLCanvasElement>(null);
  const pilotageChartsRef = useRef<Chart[]>([]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    const dossiersPromise = peutValiderDossiers
      ? getAffiliationRequests()
      : Promise.resolve({ requests: [] as AffiliationRequestItem[] });

    dossiersPromise
      .then((response) => {
        if (!mounted) return;
        setRequests(Array.isArray(response.requests) ? response.requests : []);
        setErrorMessage('');
      })
      .catch(() => {
        if (mounted) setErrorMessage('Impossible de charger les indicateurs back office.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [peutValiderDossiers]);

  // Liste brute des reclamations (toutes, sans filtre date/type) pour les graphes
  // de pilotage hebdomadaires/mensuels ci-dessous, qui ont besoin du detail par
  // type de probleme et par date de creation/resolution.
  useEffect(() => {
    if (!peutGererReclamations) return;
    let mounted = true;
    getReclamations()
      .then((response) => {
        if (mounted) setAllReclamations(Array.isArray(response) ? response : []);
      })
      .catch(() => {
        if (mounted) setAllReclamations([]);
      });
    return () => {
      mounted = false;
    };
  }, [peutGererReclamations]);

  // Graphe pilotage 1 — demandes auto-affiliation + prospection a traiter
  // (a valider ou en correction) par semaine du mois/annee selectionnes, par
  // type d'affiliation.
  //
  // NB : pas de filtre isHandledByCurrentBackOffice ici. Un dossier en attente
  // de validation n'a pas encore de back-office assigne (backOffice est remis
  // a null a chaque (re)soumission cote backend — cf.
  // StaffAffiliationManagementService#completeMerchantDossier) : il appartient
  // a la file d'attente commune. Le backend (isBackOfficeVisibleRequest) ne
  // renvoie deja que les dossiers reellement visibles/actionnables par le BOA
  // connecte (dossiers d'extension restreints a leur back-office proprietaire,
  // reste de la file partagee) : appliquer un filtre d'appartenance ici
  // masquerait a tort la quasi-totalite des dossiers a traiter.
  // Dossiers dont le contrat est reellement SIGNE ET DEPOSE (ACCEPTE — pas
  // CONTRAT_A_SIGNER, qui n'est que le contrat genere/envoye : voir la page
  // dossier ou "Affecter un TPE" ne s'affiche qu'a ACCEPTE) et qui necessitent
  // encore une affectation manuelle par le BOA : reference TPE/SoftPOS/QR,
  // site e-commerce, ou les deux pour ENCAISSEMENT_ET_ECOMMERCE — meme
  // predicat que la page "TPE a affecter" (needsManualAssignment), pour que
  // ce compteur et cette liste soient toujours coherents.
  const tpeToAssignCount = useMemo(
    () => requests.filter(needsManualAssignment).length,
    [requests]
  );

  const weeklyRequestsByType = useMemo(() => {
    const weeks = weeksOfMonth(selectedYear, selectedMonth);
    const toTreat = requests.filter(
      (r) => r.status === 'EN_ATTENTE_VALIDATION_BOA' || r.status === 'INCOMPLET'
    );
    return weeks.map((week) => {
      const inWeek = toTreat.filter((r) => {
        const d = parseDate(r.dateSoumission);
        return d && isSameWeek(d, week.start);
      });
      const row: Record<string, number | string> = { label: week.label };
      AFFILIATION_TYPES.forEach((t) => {
        row[t.key] = inWeek.filter((r) => r.typeAffiliation === t.key).length;
      });
      return row;
    });
  }, [requests, selectedYear, selectedMonth]);

  // Graphe pilotage 2 — reclamations arrivees par semaine du mois/annee
  // selectionnes, par type de probleme. Une reclamation n'a pas de BOA
  // assigne tant qu'elle n'est pas resolue/escaladee (file commune) : on la
  // garde visible jusqu'a ce point, puis uniquement si traitee par le BOA
  // connecte (cf. isReclamationVisibleToCurrentBackOffice).
  const weeklyReclamationsByType = useMemo(() => {
    const weeks = weeksOfMonth(selectedYear, selectedMonth);
    const mine = allReclamations.filter((r) => isReclamationVisibleToCurrentBackOffice(r, session));
    return weeks.map((week) => {
      const inWeek = mine.filter((r) => {
        const d = parseDate(r.dateCreation);
        return d && isSameWeek(d, week.start);
      });
      const row: Record<string, number | string> = { label: week.label };
      PROBLEME_TYPES.forEach((t) => {
        row[t.key] = inWeek.filter((r) => r.typeProbleme === t.key).length;
      });
      return row;
    });
  }, [allReclamations, session, selectedYear, selectedMonth]);

  // Graphe pilotage 3 — demandes deja traitees/validees par le BOA connecte
  // (statut CONTRAT_A_SIGNER ou ACCEPTE), par type d'affiliation, sur les 12
  // mois de l'annee selectionnee.
  const monthlyValidationByType = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const months = Array.from({ length: 12 }, (_, index) => ({
      year: selectedYear,
      month: index,
      label: formatter.format(new Date(selectedYear, index, 1))
    }));
    const mine = requests.filter(
      (r) => (r.status === 'CONTRAT_A_SIGNER' || r.status === 'ACCEPTE')
        && isHandledByCurrentBackOffice(r, session)
    );
    return months.map((m) => {
      const inMonth = mine.filter((r) => {
        const d = parseDate(r.dateTraitementBackOffice ?? r.dateSoumission);
        return d && d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const row: Record<string, number | string> = { label: m.label };
      AFFILIATION_TYPES.forEach((t) => {
        row[t.key] = inMonth.filter((r) => r.typeAffiliation === t.key).length;
      });
      return row;
    });
  }, [requests, session, selectedYear]);

  // Graphe pilotage 4 — reclamations traitees (resolues ou escaladees) par
  // semaine du mois/annee selectionnes.
  const weeklyTreatedReclamations = useMemo(() => {
    const weeks = weeksOfMonth(selectedYear, selectedMonth);
    const treated = allReclamations.filter(
      (r) => (r.statut === 'RESOLU' || r.statut === 'ESCALADE') && isReclamationHandledByCurrentBackOffice(r, session)
    );
    return weeks.map((week) => {
      const inWeek = treated.filter((r) => {
        const d = parseDate(r.dateResolution ?? r.dateCreation);
        return d && isSameWeek(d, week.start);
      });
      return {
        label: week.label,
        resolu: inWeek.filter((r) => r.statut === 'RESOLU').length,
        escalade: inWeek.filter((r) => r.statut === 'ESCALADE').length
      };
    });
  }, [allReclamations, session, selectedYear, selectedMonth]);

  function pilotageBarOptions(): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: "'DM Sans', Arial, sans-serif", size: 10.5 }, color: '#3A6480', padding: 10, boxWidth: 10, boxHeight: 10 }
        },
        tooltip: { titleFont: { family: "'DM Sans', Arial, sans-serif" }, bodyFont: { family: "'DM Sans', Arial, sans-serif" } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#6A91AA', font: { size: 10 } } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: '#6A91AA', font: { size: 10 } }, grid: { color: 'rgba(205,223,233,.6)' } }
      }
    };
  }

  useEffect(() => {
    if (isLoading || !showPilotageCharts) return;

    pilotageChartsRef.current.splice(0).forEach((c) => c.destroy());

    // Graphe 1 — demandes a traiter par semaine, par type d'affiliation.
    if (weeklyRequestsRef.current) {
      pilotageChartsRef.current.push(
        new Chart(weeklyRequestsRef.current, {
          type: 'bar',
          data: {
            labels: weeklyRequestsByType.map((row) => String(row.label)),
            datasets: AFFILIATION_TYPES.map((t) => ({
              label: t.label,
              data: weeklyRequestsByType.map((row) => Number(row[t.key])),
              backgroundColor: t.color,
              borderRadius: 3,
              maxBarThickness: 28
            }))
          },
          options: pilotageBarOptions()
        } as ChartConfiguration)
      );
    }

    // Graphe 2 — reclamations arrivees par semaine, par type de probleme.
    if (weeklyReclamationsRef.current) {
      pilotageChartsRef.current.push(
        new Chart(weeklyReclamationsRef.current, {
          type: 'bar',
          data: {
            labels: weeklyReclamationsByType.map((row) => String(row.label)),
            datasets: PROBLEME_TYPES.map((t) => ({
              label: t.label,
              data: weeklyReclamationsByType.map((row) => Number(row[t.key])),
              backgroundColor: t.color,
              borderRadius: 3,
              maxBarThickness: 28
            }))
          },
          options: pilotageBarOptions()
        } as ChartConfiguration)
      );
    }

    // Graphe 3 — demandes a valider par le BOA connecte, par type, par mois.
    if (monthlyValidationRef.current) {
      pilotageChartsRef.current.push(
        new Chart(monthlyValidationRef.current, {
          type: 'bar',
          data: {
            labels: monthlyValidationByType.map((row) => String(row.label)),
            datasets: AFFILIATION_TYPES.map((t) => ({
              label: t.label,
              data: monthlyValidationByType.map((row) => Number(row[t.key])),
              backgroundColor: t.color,
              borderRadius: 3,
              maxBarThickness: 28
            }))
          },
          options: pilotageBarOptions()
        } as ChartConfiguration)
      );
    }

    // Graphe 4 — reclamations traitees (resolues / escaladees) par semaine.
    if (weeklyTreatedRef.current) {
      pilotageChartsRef.current.push(
        new Chart(weeklyTreatedRef.current, {
          type: 'bar',
          data: {
            labels: weeklyTreatedReclamations.map((row) => row.label),
            datasets: [
              {
                label: 'Résolu',
                data: weeklyTreatedReclamations.map((row) => row.resolu),
                backgroundColor: ETAT_META.resolu.color,
                borderRadius: 3,
                maxBarThickness: 28
              },
              {
                label: 'Escaladé',
                data: weeklyTreatedReclamations.map((row) => row.escalade),
                backgroundColor: ETAT_META.escalade.color,
                borderRadius: 3,
                maxBarThickness: 28
              }
            ]
          },
          options: pilotageBarOptions()
        } as ChartConfiguration)
      );
    }

    return () => {
      pilotageChartsRef.current.splice(0).forEach((c) => c.destroy());
    };
  }, [
    isLoading,
    showPilotageCharts,
    weeklyRequestsByType,
    weeklyReclamationsByType,
    monthlyValidationByType,
    weeklyTreatedReclamations
  ]);

  return (
    <div className="page-grid page-grid--compact">
      {errorMessage && <div className="page-alert error">{errorMessage}</div>}
      {!isLoading && tpeToAssignCount > 0 && (
        <div
          className="page-alert warning bo-tpe-alert"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/backoffice/tpe-a-affecter')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/backoffice/tpe-a-affecter'); }}
        >
          <strong>{tpeToAssignCount}</strong>{' '}
          {tpeToAssignCount === 1 ? 'dossier a une affectation en attente' : 'dossiers ont une affectation en attente'} — contrat
          signé, TPE/SoftPOS/QR et/ou site e-commerce restant à affecter pour débloquer l'espace du commerçant.
        </div>
      )}
      {isLoading && (
        <div className="page-loading">
          <span className="page-loading-spinner" />
          <span>Chargement des indicateurs...</span>
        </div>
      )}

      {!isLoading && showPilotageCharts && (
        <>
          <div className="bo-pilotage-filters">
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

          <section className="bo-pilotage-grid" aria-label="Graphes de pilotage">
            {showDossierStats && (
              <article className="dashboard-card bo-pilotage-card">
                <div className="card-head">
                  <div>
                    <span className="card-kicker">Semaines de {selectedMonthLabel} {selectedYear}</span>
                    <h3>Mes demandes à traiter par semaine</h3>
                  </div>
                  <button type="button" className="btn-secondary bo-pilotage-explore" onClick={() => navigate('/backoffice/dossiers')}>
                    Explorer
                  </button>
                </div>
                <p className="bo-pilotage-desc">Vos dossiers (auto-affiliation et prospection), à valider ou en correction, par type d'affiliation.</p>
                <div className="bo-pilotage-chart-wrap">
                  <canvas ref={weeklyRequestsRef}></canvas>
                </div>
              </article>
            )}

            {showReclamationStats && (
              <article className="dashboard-card bo-pilotage-card">
                <div className="card-head">
                  <div>
                    <span className="card-kicker">Semaines de {selectedMonthLabel} {selectedYear}</span>
                    <h3>Mes réclamations reçues par semaine</h3>
                  </div>
                  <button type="button" className="btn-secondary bo-pilotage-explore" onClick={() => navigate('/backoffice/reclamations')}>
                    Explorer
                  </button>
                </div>
                <p className="bo-pilotage-desc">Réclamations qui vous sont rattachées, par type de problème.</p>
                <div className="bo-pilotage-chart-wrap">
                  <canvas ref={weeklyReclamationsRef}></canvas>
                </div>
              </article>
            )}

            {showDossierStats && (
              <article className="dashboard-card bo-pilotage-card">
                <div className="card-head">
                  <div>
                    <span className="card-kicker">Mois de {selectedYear}</span>
                    <h3>Mes demandes déjà validées</h3>
                  </div>
                  <button type="button" className="btn-secondary bo-pilotage-explore" onClick={() => navigate('/backoffice/dossiers')}>
                    Explorer
                  </button>
                </div>
                <p className="bo-pilotage-desc">Demandes que vous avez déjà traitées et validées, par type d'affiliation, par mois.</p>
                <div className="bo-pilotage-chart-wrap">
                  <canvas ref={monthlyValidationRef}></canvas>
                </div>
              </article>
            )}

            {showReclamationStats && (
              <article className="dashboard-card bo-pilotage-card">
                <div className="card-head">
                  <div>
                    <span className="card-kicker">Semaines de {selectedMonthLabel} {selectedYear}</span>
                    <h3>Mes réclamations traitées par semaine</h3>
                  </div>
                  <button type="button" className="btn-secondary bo-pilotage-explore" onClick={() => navigate('/backoffice/reclamations')}>
                    Explorer
                  </button>
                </div>
                <p className="bo-pilotage-desc">Réclamations que vous avez résolues ou escaladées chaque semaine.</p>
                <div className="bo-pilotage-chart-wrap">
                  <canvas ref={weeklyTreatedRef}></canvas>
                </div>
              </article>
            )}
          </section>
        </>
      )}
    </div>
  );
}
