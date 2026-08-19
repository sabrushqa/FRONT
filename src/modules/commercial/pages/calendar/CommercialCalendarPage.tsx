import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  beginGoogleCalendarAuthorization,
  beginMicrosoftCalendarAuthorization,
  completeGoogleCalendarAuthorization,
  completeMicrosoftCalendarAuthorization,
  getAffiliationRequests,
  getGoogleCalendarStatus,
  getMicrosoftCalendarStatus,
  AffiliationRequestItem,
  GoogleCalendarStatusResponse,
  MicrosoftCalendarStatusResponse
} from '../../../supervisor/services/supervisorApi';
import { useSessionStore } from '../../../../store/sessionStore';
import '../../../../styles/commercial-calendar.scss';

/* ============================================================
   TYPES
   ============================================================ */
interface CalendarEvent {
  dossierId: number;
  title: string;
  type: EventType;
  status: string;
  helper: string;
  route: string;
  priority: 'high' | 'medium' | 'low';
}

interface CalendarCell {
  date: Date | null;
  dayNumber: string;
  isToday: boolean;
  isOutside: boolean;
  isWeekend: boolean;
  events: CalendarEvent[];
}

interface WeekRow {
  weekNumber: number;
  cells: CalendarCell[];
}

type EventType = 'RELANCE' | 'VISITE' | 'APPEL' | 'EMAIL' | 'NOTE';
type CalendarView = 'month' | 'week' | 'agenda';

/* ============================================================
   CONSTANTS
   ============================================================ */
const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const WEEKDAYS_LONG  = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(2026, i, 1))
}));
const YEAR_OPTIONS = Array.from({ length: 9 }, (_, i) => 2024 + i);

const EVENT_CONFIG: Record<EventType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  RELANCE:  { label: 'Relance',  icon: 'notifications_active', color: '#B45309', bg: '#FFFBEB', border: '#F59E0B' },
  VISITE:   { label: 'Visite',   icon: 'location_on', color: '#059669', bg: '#F0FDF4', border: '#10B981' },
  APPEL:    { label: 'Appel',    icon: 'call', color: '#2563EB', bg: '#EFF6FF', border: '#3B82F6' },
  EMAIL:    { label: 'E-mail',   icon: 'mail', color: '#7C3AED', bg: '#F5F3FF', border: '#8B5CF6' },
  NOTE:     { label: 'Note',     icon: 'edit_note', color: '#64748B', bg: '#F8FAFC', border: '#94A3B8' }
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  A_RELANCER:      { label: 'À relancer',   color: '#B45309', bg: '#FEF3C7' },
  EN_COURS:        { label: 'En cours',     color: '#1D4ED8', bg: '#DBEAFE' },
  AFFILIE:         { label: 'Affilié',      color: '#059669', bg: '#D1FAE5' },
  REFUSE:          { label: 'Refusé',       color: '#DC2626', bg: '#FEE2E2' },
  SANS_SUITE:      { label: 'Sans suite',   color: '#6B7280', bg: '#F3F4F6' }
};

/* ============================================================
   HELPERS
   ============================================================ */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date | null): string {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function normalizeEventType(raw: string | null | undefined): EventType {
  const upper = (raw ?? '').toUpperCase();
  if (upper === 'RELANCE')     return 'RELANCE';
  if (upper === 'VISITE')      return 'VISITE';
  if (upper === 'APPEL')       return 'APPEL';
  if (upper === 'EMAIL' || upper === 'E_MAIL' || upper === 'E-MAIL') return 'EMAIL';
  if (upper === 'NOTE')        return 'NOTE';
  return 'RELANCE';
}

function displayName(request: AffiliationRequestItem): string {
  return request.nomCommercant || request.raisonSociale || request.email || `Dossier #${request.dossierId}`;
}

function resolvePriority(request: AffiliationRequestItem): 'high' | 'medium' | 'low' {
  const status = request.prospectStatus ?? '';
  if (status === 'A_RELANCER') return 'high';
  if (status === 'EN_COURS')   return 'medium';
  return 'low';
}

/* ============================================================
   COMPONENT
   ============================================================ */
export default function CommercialCalendarPage() {
  const navigate  = useNavigate();
  const { session } = useSessionStore();

  const workspaceBaseRoute =
    session?.role === 'COMMERCIAL'  ? '/commercial'  :
    session?.role === 'BACK_OFFICE' ? '/backoffice'  : '/supervisor';

  const today = useMemo(() => new Date(), []);

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear,  setSelectedYear]  = useState(today.getFullYear());
  const [view, setView] = useState<CalendarView>('month');
  const [activeType, setActiveType] = useState<EventType | 'ALL'>('ALL');
  const [requests, setRequests] = useState<AffiliationRequestItem[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatusResponse | null>(null);
  const [microsoftStatus, setMicrosoftStatus] = useState<MicrosoftCalendarStatusResponse | null>(null);
  const [calendarFeedback, setCalendarFeedback] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const calendarCallbackStarted = useRef(false);

  /* ---- Load data ---- */
  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      try {
        const resp = await getAffiliationRequests();
        if (!active) return;
        const all = Array.isArray(resp.requests) ? resp.requests : [];
        setRequests(all.filter((r) => r.origineCreation === 'COMMERCIAL_DIRECT'));
        setErrorMessage('');
      } catch {
        if (active) setErrorMessage('Impossible de charger le calendrier commercial.');
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  /* ---- Google / Microsoft Calendar connection and OAuth callback ---- */
  useEffect(() => {
    if (session?.role !== 'COMMERCIAL' || calendarCallbackStarted.current) return;
    calendarCallbackStarted.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const oauthError = params.get('error');
      const isMicrosoftCallback = Boolean(state?.startsWith('microsoft.'));
      setIsGoogleLoading(true);
      setIsMicrosoftLoading(true);
      try {
        if (oauthError) {
          setCalendarFeedback(
            isMicrosoftCallback
              ? 'Connexion Outlook Calendar annulée.'
              : 'Connexion Google Calendar annulée.'
          );
          window.history.replaceState({}, '', window.location.pathname);
        } else if (code && state) {
          if (isMicrosoftCallback) {
            const status = await completeMicrosoftCalendarAuthorization(code, state);
            setMicrosoftStatus(status);
            setCalendarFeedback('Outlook Calendar est maintenant connecté.');
          } else {
            const status = await completeGoogleCalendarAuthorization(code, state);
            setGoogleStatus(status);
            setCalendarFeedback('Google Calendar est maintenant connecté.');
          }
          window.history.replaceState({}, '', window.location.pathname);
        }

        const [googleResult, microsoftResult] = await Promise.allSettled([
          getGoogleCalendarStatus(),
          getMicrosoftCalendarStatus()
        ]);
        if (googleResult.status === 'fulfilled') setGoogleStatus(googleResult.value);
        if (microsoftResult.status === 'fulfilled') setMicrosoftStatus(microsoftResult.value);
        if (!code && !oauthError) {
          const configurationMessages = [
            googleResult.status === 'fulfilled' && !googleResult.value.configured ? googleResult.value.message : '',
            microsoftResult.status === 'fulfilled' && !microsoftResult.value.configured ? microsoftResult.value.message : ''
          ].filter(Boolean);
          setCalendarFeedback(configurationMessages.join(' '));
        }
      } catch {
        setCalendarFeedback(
          isMicrosoftCallback
            ? 'Impossible de connecter Outlook Calendar. Veuillez réessayer.'
            : 'Impossible de connecter Google Calendar. Veuillez réessayer.'
        );
      } finally {
        setIsGoogleLoading(false);
        setIsMicrosoftLoading(false);
      }
    })();
  }, [session?.role]);

  async function connectGoogleCalendar() {
    if (isGoogleLoading || googleStatus?.connected || googleStatus?.configured === false) return;
    setIsGoogleLoading(true);
    setCalendarFeedback('');
    try {
      const response = await beginGoogleCalendarAuthorization();
      window.location.assign(response.authorizationUrl);
    } catch {
      setCalendarFeedback('Impossible de démarrer la connexion Google Calendar.');
      setIsGoogleLoading(false);
    }
  }

  async function connectMicrosoftCalendar() {
    if (isMicrosoftLoading || microsoftStatus?.connected || microsoftStatus?.configured === false) return;
    setIsMicrosoftLoading(true);
    setCalendarFeedback('');
    try {
      const response = await beginMicrosoftCalendarAuthorization();
      window.location.assign(response.authorizationUrl);
    } catch {
      setCalendarFeedback('Impossible de démarrer la connexion Outlook Calendar.');
      setIsMicrosoftLoading(false);
    }
  }

  /* ---- Month display ---- */
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
    .format(new Date(selectedYear, selectedMonth, 1));

  /* ---- Events per date ---- */
  const eventsForDate = (dateKey: string): CalendarEvent[] =>
    requests
      .filter((r) => toDateKey(parseDate(r.prochaineRelanceCommerciale)) === dateKey)
      .filter((r) => activeType === 'ALL' || normalizeEventType(r.prochaineRelanceType) === activeType)
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'fr'))
      .map((r) => ({
        dossierId: r.dossierId,
        title:     displayName(r),
        type:      normalizeEventType(r.prochaineRelanceType),
        status:    r.prospectStatus || 'A_RELANCER',
        helper:    r.email || r.telephone || `#${r.dossierId}`,
        route:     `${workspaceBaseRoute}/demandes-commerciales/${r.dossierId}`,
        priority:  resolvePriority(r)
      }));

  /* ---- Build month grid (rows of 7 cells) ---- */
  const weekRows = useMemo<WeekRow[]>(() => {
    const firstDay   = new Date(selectedYear, selectedMonth, 1);
    const lastDay    = new Date(selectedYear, selectedMonth + 1, 0);
    const startOffset = (firstDay.getDay() || 7) - 1;
    const totalCells  = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    const todayKey    = toDateKey(today);

    const cells: CalendarCell[] = Array.from({ length: totalCells }, (_, i) => {
      const dayNumber = i - startOffset + 1;
      if (dayNumber < 1 || dayNumber > lastDay.getDate()) {
        return { date: null, dayNumber: '', isToday: false, isOutside: true, isWeekend: i % 7 >= 5, events: [] };
      }
      const date = new Date(selectedYear, selectedMonth, dayNumber);
      const key  = toDateKey(date);
      const dow  = (date.getDay() || 7) - 1; // 0=Mon … 6=Sun
      return {
        date,
        dayNumber: String(dayNumber),
        isToday:   key === todayKey,
        isOutside: false,
        isWeekend: dow >= 5,
        events:    eventsForDate(key)
      };
    });

    const rows: WeekRow[] = [];
    for (let r = 0; r < cells.length / 7; r++) {
      const rowCells  = cells.slice(r * 7, r * 7 + 7);
      const refDate   = rowCells.find((c) => c.date)?.date ?? new Date(selectedYear, selectedMonth, 1 + r * 7);
      rows.push({ weekNumber: getISOWeek(refDate), cells: rowCells });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, requests, activeType]);

  /* ---- Stats ---- */
  const allCells    = weekRows.flatMap((w) => w.cells);
  const totalEvents = allCells.reduce((s, c) => s + c.events.length, 0);
  const activeDays  = allCells.filter((c) => c.events.length > 0).length;
  const highPrio    = allCells.flatMap((c) => c.events).filter((e) => e.priority === 'high').length;
  const createdThis = requests.filter((r) => {
    const d = parseDate(r.dateSoumission);
    return d && d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  }).length;

  /* ---- Nav helpers ---- */
  const previousMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };
  const goToToday = () => { setSelectedMonth(today.getMonth()); setSelectedYear(today.getFullYear()); };

  /* ---- Agenda view: all events sorted by date ---- */
  const agendaItems = useMemo(() =>
    requests
      .filter((r) => {
        const d = parseDate(r.prochaineRelanceCommerciale);
        return d && d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      })
      .filter((r) => activeType === 'ALL' || normalizeEventType(r.prochaineRelanceType) === activeType)
      .sort((a, b) => {
        const da = parseDate(a.prochaineRelanceCommerciale)?.getTime() ?? 0;
        const db = parseDate(b.prochaineRelanceCommerciale)?.getTime() ?? 0;
        return da - db;
      })
      .map((r) => ({
        dossierId: r.dossierId,
        title:     displayName(r),
        type:      normalizeEventType(r.prochaineRelanceType),
        status:    r.prospectStatus || 'A_RELANCER',
        helper:    r.email || r.telephone || `#${r.dossierId}`,
        route:     `${workspaceBaseRoute}/demandes-commerciales/${r.dossierId}`,
        priority:  resolvePriority(r),
        date:      parseDate(r.prochaineRelanceCommerciale)!
      })),
    [requests, selectedYear, selectedMonth, activeType, workspaceBaseRoute]
  );

  return (
    <div className="cal-page">

      {/* ── TOPBAR ─────────────────────────────────────────────── */}
      <header className="cal-header">
        <div className="cal-header-left">
          <div className="cal-header-badge">
            <span className="material-icons">event</span>
            <span>Calendrier</span>
          </div>
          <div className="cal-header-title">
            <h1>{monthLabel}</h1>
            <p>Relances · Visites · Appels · Planification commerciale</p>
          </div>
        </div>

        <div className="cal-header-right">
          {session?.role === 'COMMERCIAL' && (
            <>
              <button
                type="button"
                className={`google-calendar-btn${googleStatus?.connected ? ' is-connected' : ''}`}
                onClick={connectGoogleCalendar}
                disabled={isGoogleLoading || googleStatus?.connected || googleStatus?.configured === false}
                title={googleStatus?.message || 'Connecter Google Calendar'}
              >
                <span className="material-icons" aria-hidden="true">
                  {googleStatus?.connected ? 'event_available' : 'event'}
                </span>
                {isGoogleLoading
                  ? 'Connexion…'
                  : googleStatus?.connected
                    ? 'Google connecté'
                    : 'Connecter Google'}
              </button>
              <button
                type="button"
                className={`microsoft-calendar-btn${microsoftStatus?.connected ? ' is-connected' : ''}`}
                onClick={connectMicrosoftCalendar}
                disabled={isMicrosoftLoading || microsoftStatus?.connected || microsoftStatus?.configured === false}
                title={microsoftStatus?.message || 'Connecter Outlook Calendar'}
              >
                <span className="material-icons" aria-hidden="true">
                  {microsoftStatus?.connected ? 'event_available' : 'event'}
                </span>
                {isMicrosoftLoading
                  ? 'Connexion…'
                  : microsoftStatus?.connected
                    ? 'Outlook connecté'
                    : 'Connecter Outlook'}
              </button>
            </>
          )}

          {/* View toggle */}
          <div className="cal-view-toggle">
            {(['month', 'week', 'agenda'] as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`vt-btn${view === v ? ' is-active' : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'month' ? 'Mois' : v === 'week' ? 'Semaine' : 'Agenda'}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="cal-nav">
            <button type="button" className="cal-nav-btn" onClick={previousMonth} aria-label="Mois précédent">
              <span className="material-icons">chevron_left</span>
            </button>
            <button type="button" className="cal-today-btn" onClick={goToToday}>
              Aujourd'hui
            </button>
            <button type="button" className="cal-nav-btn" onClick={nextMonth} aria-label="Mois suivant">
              <span className="material-icons">chevron_right</span>
            </button>
          </div>

          {/* Month/Year selects */}
          <div className="cal-selects">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* ── KPI BAR ────────────────────────────────────────────── */}
      <div className="cal-kpi-bar">
        <div className="kpi-card kpi-yellow">
          <span className="kpi-icon material-icons">notifications_active</span>
          <div>
            <strong>{totalEvents}</strong>
            <span>Tâches planifiées</span>
          </div>
        </div>
        <div className="kpi-card kpi-red">
          <span className="kpi-icon material-icons">priority_high</span>
          <div>
            <strong>{highPrio}</strong>
            <span>Priorité haute</span>
          </div>
        </div>
        <div className="kpi-card kpi-blue">
          <span className="kpi-icon material-icons">calendar_today</span>
          <div>
            <strong>{activeDays}</strong>
            <span>Jours occupés</span>
          </div>
        </div>
        <div className="kpi-card kpi-green">
          <span className="kpi-icon material-icons">trending_up</span>
          <div>
            <strong>{createdThis}</strong>
            <span>Nouveaux prospects</span>
          </div>
        </div>
      </div>

      {/* ── TYPE FILTER ────────────────────────────────────────── */}
      <div className="cal-filters">
        <button
          type="button"
          className={`type-filter${activeType === 'ALL' ? ' is-active' : ''}`}
          onClick={() => setActiveType('ALL')}
        >
          <span className="tf-dot" style={{ background: '#64748B' }} />{' '}
          Tout
          <strong>{totalEvents}</strong>
        </button>
        {(Object.keys(EVENT_CONFIG) as EventType[]).map((t) => {
          const cfg   = EVENT_CONFIG[t];
          const count = allCells.flatMap((c) => c.events).filter((e) => e.type === t).length;
          return (
            <button
              key={t}
              type="button"
              className={`type-filter${activeType === t ? ' is-active' : ''}`}
              style={activeType === t ? { borderColor: cfg.border, background: cfg.bg, color: cfg.color } : {}}
              onClick={() => setActiveType(activeType === t ? 'ALL' : t)}
            >
              <span className="tf-dot" style={{ background: cfg.border }} />
              <span className="material-icons type-filter-icon" aria-hidden="true">{cfg.icon}</span>
              {cfg.label}
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>

      {/* ── ALERTS / LOADING ───────────────────────────────────── */}
      {errorMessage && (
        <div className="cal-alert cal-alert-error" role="alert">
          <span className="material-icons">error_outline</span>
          {errorMessage}
        </div>
      )}

      {calendarFeedback && (
        <div className="cal-alert" role="status">
          <span className="material-icons">event_available</span>
          {calendarFeedback}
        </div>
      )}

      {isLoading && (
        <div className="cal-loading">
          <div className="cal-spinner" />
          <span>Chargement du planning...</span>
        </div>
      )}

      {/* ── CALENDAR BOARD ─────────────────────────────────────── */}
      {!isLoading && view === 'month' && (
        <div className="cal-board">
          {/* Weekday header */}
          <div className="cal-weekday-header">
            <div className="cal-wk-label" />
            {WEEKDAYS_SHORT.map((d, i) => (
              <div key={d} className={`cal-wd${i >= 5 ? ' is-weekend' : ''}`}>{d}</div>
            ))}
          </div>

          {/* Week rows */}
          {weekRows.map((row) => (
            <div key={row.weekNumber} className="cal-week-row">
              {/* Week number badge */}
              <div className="cal-week-num">
                <span>S{row.weekNumber}</span>
              </div>

              {/* Day cells */}
              {row.cells.map((cell, ci) => (
                <article
                  key={ci}
                  className={[
                    'cal-cell',
                    cell.isOutside  ? 'is-outside'  : '',
                    cell.isToday    ? 'is-today'    : '',
                    cell.isWeekend  ? 'is-weekend'  : '',
                    cell.events.length > 0 ? 'has-events' : ''
                  ].filter(Boolean).join(' ')}
                >
                  {!cell.isOutside && (
                    <>
                      <div className="cal-cell-head">
                        <span className={`cal-day-num${cell.isToday ? ' today-badge' : ''}`}>
                          {cell.dayNumber}
                        </span>
                        {cell.isToday && <span className="today-label">Aujourd'hui</span>}
                        {cell.events.length > 1 && (
                          <span className="event-count-badge">{cell.events.length}</span>
                        )}
                      </div>

                      <div className="cal-event-list">
                        {cell.events.map((ev, ei) => {
                          const cfg = EVENT_CONFIG[ev.type];
                          const stcfg = STATUS_CONFIG[ev.status];
                          return (
                            <button
                              key={`${ev.dossierId}-${ei}`}
                              type="button"
                              className="cal-ticket"
                              style={{ '--ticket-border': cfg.border, '--ticket-bg': cfg.bg } as React.CSSProperties}
                              onClick={() => navigate(ev.route)}
                              title={`${cfg.label} — ${ev.title}`}
                            >
                              <div className="ticket-top">
                                <span className="ticket-type-badge" style={{ color: cfg.color, background: `${cfg.bg}` }}>
                                  <span className="material-icons calendar-inline-icon" aria-hidden="true">{cfg.icon}</span>
                                  {cfg.label}
                                </span>
                                <span className="ticket-priority" data-priority={ev.priority} />
                              </div>
                              <span className="ticket-title">{ev.title}</span>
                              <span className="ticket-helper">{ev.helper}</span>
                              {stcfg && (
                                <span className="ticket-status" style={{ color: stcfg.color, background: stcfg.bg }}>
                                  {stcfg.label}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {cell.events.length === 0 && (
                          <div className="cal-empty-slot" />
                        )}
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── WEEK VIEW ──────────────────────────────────────────── */}
      {!isLoading && view === 'week' && (() => {
        const todayKey = toDateKey(today);
        // Show week containing "today" if in current month, else first week
        const targetRow = weekRows.find((r) => r.cells.some((c) => toDateKey(c.date) === todayKey))
          ?? weekRows[0];
        if (!targetRow) return null;
        return (
          <div className="cal-week-view">
            <div className="cwv-header">
              {targetRow.cells.map((cell, ci) => (
                <div key={ci} className={`cwv-head-cell${cell.isToday ? ' is-today' : ''}${cell.isWeekend ? ' is-weekend' : ''}`}>
                  <span className="cwv-wd">{WEEKDAYS_LONG[ci]}</span>
                  <span className={`cwv-dn${cell.isToday ? ' today-badge' : ''}`}>
                    {cell.dayNumber || '·'}
                  </span>
                </div>
              ))}
            </div>
            <div className="cwv-body">
              {targetRow.cells.map((cell, ci) => (
                <div key={ci} className={`cwv-day-col${cell.isToday ? ' is-today' : ''}${cell.isWeekend ? ' is-weekend' : ''}`}>
                  {!cell.isOutside && cell.events.map((ev, ei) => {
                    const cfg = EVENT_CONFIG[ev.type];
                    return (
                      <button
                        key={`${ev.dossierId}-${ei}`}
                        type="button"
                        className="cwv-ticket"
                        style={{ '--ticket-border': cfg.border, '--ticket-bg': cfg.bg, borderLeftColor: cfg.border } as React.CSSProperties}
                        onClick={() => navigate(ev.route)}
                      >
                        <span className="cwv-type">
                          <span className="material-icons calendar-inline-icon" aria-hidden="true">{cfg.icon}</span>
                          {cfg.label}
                        </span>
                        <span className="cwv-title">{ev.title}</span>
                        <span className="cwv-helper">{ev.helper}</span>
                      </button>
                    );
                  })}
                  {!cell.isOutside && cell.events.length === 0 && (
                    <div className="cwv-empty">Libre</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── AGENDA VIEW ────────────────────────────────────────── */}
      {!isLoading && view === 'agenda' && (
        <div className="cal-agenda">
          {agendaItems.length === 0 ? (
            <div className="cal-agenda-empty">
              <span className="material-icons">event_available</span>
              <p>Aucune tâche planifiée ce mois-ci</p>
            </div>
          ) : (
            agendaItems.map((item, idx) => {
              const cfg   = EVENT_CONFIG[item.type];
              const stcfg = STATUS_CONFIG[item.status];
              const dateStr = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                .format(item.date);
              const isNewDate = idx === 0 || toDateKey(item.date) !== toDateKey(agendaItems[idx - 1].date);
              return (
                <React.Fragment key={`${item.dossierId}-${idx}`}>
                  {isNewDate && (
                    <div className="agenda-date-divider">
                      <span>{dateStr}</span>
                      {toDateKey(item.date) === toDateKey(today) && <span className="agenda-today-badge">Aujourd'hui</span>}
                    </div>
                  )}
                  <button
                    type="button"
                    className="agenda-row"
                    style={{ borderLeftColor: cfg.border } as React.CSSProperties}
                    onClick={() => navigate(item.route)}
                  >
                    <span className="agenda-type-icon material-icons" aria-hidden="true">{cfg.icon}</span>
                    <div className="agenda-body">
                      <strong className="agenda-title">{item.title}</strong>
                      <span className="agenda-helper">{item.helper}</span>
                    </div>
                    <span className="agenda-type-label" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                    {stcfg && (
                      <span className="agenda-status" style={{ color: stcfg.color, background: stcfg.bg }}>
                        {stcfg.label}
                      </span>
                    )}
                    <span className="material-icons agenda-arrow">chevron_right</span>
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
