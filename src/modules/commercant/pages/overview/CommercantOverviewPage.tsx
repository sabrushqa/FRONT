import React, { useEffect, useRef } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { useSessionStore, useEffectiveAffiliationType } from '../../../../store/sessionStore';
import '../../../../styles/commercant-overview.scss';

Chart.register(...registerables);

const CHART_COLORS = {
  gold:        '#F97316',
  goldSoft:    'rgba(249,115,22,0.16)',
  navy:        '#1e40af',
  green:       '#10B981',
  greenSoft:   'rgba(16,185,129,0.15)',
  rose:        '#F43F5E',
  roseSoft:    'rgba(244,63,94,0.12)',
  blue:        '#3B82F6',
  blueSoft:    'rgba(59,130,246,0.13)',
  grid:        'rgba(226,232,240,0.7)',
};

// Espace sous-commerçant : l'accent "gold" (orange) devient bleu clair, en
// cohérence avec le reste du thème (cf. .role-submerchant dans
// commercant-dashboard.scss).
const SUBMERCHANT_ACCENT = {
  gold:     '#59bfe0',
  goldSoft: 'rgba(89,191,224,0.18)',
};

function buildMonthlyChart(
  canvas: HTMLCanvasElement,
  transactions: Array<{ dateTransaction: string; montant: number | null }>,
  accent: { gold: string; goldSoft: string }
) {
  const now = new Date();
  const months: string[] = [];
  const counts: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    months.push(label);
    const count = transactions.filter((t) => {
      if (!t.dateTransaction) return false;
      const td = new Date(t.dateTransaction);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
    }).length;
    counts.push(count);
  }

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Transactions',
        data: counts,
        borderColor: accent.gold,
        backgroundColor: accent.goldSoft,
        borderWidth: 2.5,
        pointBackgroundColor: accent.gold,
        pointRadius: 4,
        fill: true,
        tension: 0.4
      }]
    },
    options: chartOptions('Transactions par mois')
  } as ChartConfiguration);
}

function buildPdvChart(
  canvas: HTMLCanvasElement,
  transactions: Array<{ pdv: string; montant: number | null }>,
  accent: { gold: string; goldSoft: string }
) {
  const pdvMap: Record<string, number> = {};
  transactions.forEach((t) => {
    const key = t.pdv || 'Autre';
    pdvMap[key] = (pdvMap[key] ?? 0) + 1;
  });
  const labels = Object.keys(pdvMap).slice(0, 8);
  const data   = labels.map((k) => pdvMap[k]);

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [accent.gold, CHART_COLORS.green, CHART_COLORS.blue, CHART_COLORS.rose, '#8B5CF6', accent.gold, '#06B6D4', '#EC4899'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: { ...chartOptions('Par PDV'), cutout: '60%' } as ChartConfiguration['options']
  } as ChartConfiguration);
}

function buildTpeChart(canvas: HTMLCanvasElement, transactions: Array<{ tpe: string }>, tpes: Array<{ numeroSerie: string }>) {
  const tpeMap: Record<string, number> = {};
  transactions.forEach((t) => {
    const key = t.tpe || 'Autre';
    tpeMap[key] = (tpeMap[key] ?? 0) + 1;
  });
  const labels = tpes.map((t) => t.numeroSerie || 'TPE').slice(0, 6);
  const data   = labels.map((l) => tpeMap[l] ?? 0);

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Transactions',
        data,
        backgroundColor: CHART_COLORS.blueSoft,
        borderColor: CHART_COLORS.blue,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: chartOptions('TPE')
  } as ChartConfiguration);
}

function buildTpeByPdvChart(
  canvas: HTMLCanvasElement,
  pdvs: Array<{ nom: string }>,
  tpes: Array<{ pdv: string }>,
  accent: { gold: string; goldSoft: string }
) {
  const pdvMap: Record<string, number> = {};
  pdvs.forEach((p) => { pdvMap[p.nom || 'PDV'] = 0; });
  tpes.forEach((t) => {
    const key = t.pdv || 'Autre';
    pdvMap[key] = (pdvMap[key] ?? 0) + 1;
  });
  const labels = Object.keys(pdvMap).slice(0, 8);
  const data   = labels.map((k) => pdvMap[k]);

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'TPE',
        data,
        backgroundColor: accent.goldSoft,
        borderColor: accent.gold,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: chartOptions('TPE par PDV')
  } as ChartConfiguration);
}

function chartOptions(title: string): ChartConfiguration['options'] {
  const font = { family: "'DM Sans', Arial, sans-serif", size: 11 };
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font, color: '#64748B', padding: 14, boxWidth: 10, boxHeight: 10 } },
      title:  { display: false, text: title }
    },
    scales: {
      x: { grid: { color: CHART_COLORS.grid }, ticks: { color: '#94A3B8', font } },
      y: { grid: { color: CHART_COLORS.grid }, ticks: { color: '#94A3B8', font }, beginAtZero: true }
    }
  };
}

export default function CommercantOverviewPage() {
  const { session } = useSessionStore();

  const monthlyRef  = useRef<HTMLCanvasElement>(null);
  const pdvRef      = useRef<HTMLCanvasElement>(null);
  const tpeRef      = useRef<HTMLCanvasElement>(null);
  const tpeByPdvRef = useRef<HTMLCanvasElement>(null);
  const chartsRef   = useRef<Chart[]>([]);

  const allTransactions = session?.transactions ?? [];
  const tpes         = session?.tpes ?? [];
  const pdvs         = session?.pdvs ?? [];
  const summary      = session?.summary ?? { totalTransactions: 0, totalPdvs: 0, totalTpes: 0, totalSousCommercants: 0 };
  const isSousCommercant = session?.role === 'SOUS_COMMERCANT';
  const hasCombinedAffiliation = session?.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE';
  // E-commerce merchants have no PDV/TPE — only the transactions chart applies.
  const isEcommerce = useEffectiveAffiliationType() === 'E_COMMERCE';
  // Meme filtre que CommercantTransactionsPage.tsx : un commercant a affiliation
  // combinee bascule d'espace (ENCAISSEMENT / E-COMMERCE). Sans ce filtre, le
  // graphe "Transactions par mois" et le graphe "Par point de vente" de l'espace
  // Encaissement TPE incluaient aussi les transactions e-commerce (et
  // inversement) au lieu de ne montrer que les donnees du canal actif.
  const transactions = hasCombinedAffiliation
    ? allTransactions.filter((t) => (t.canal ?? '').toUpperCase() === (isEcommerce ? 'ECOMMERCE' : 'TPE'))
    : allTransactions;
  const siteMarchandUrl = session?.profile?.siteMarchandUrl ?? '';
  const applicationMobile = session?.profile?.applicationMobile ?? '';
  const hasDashboardData = isEcommerce
    ? transactions.length > 0
    : transactions.length > 0 || tpes.length > 0 || pdvs.length > 0;

  useEffect(() => {
    chartsRef.current.forEach((c) => c.destroy());
    chartsRef.current = [];

    if (!hasDashboardData) return;

    const accent = isSousCommercant
      ? SUBMERCHANT_ACCENT
      : { gold: CHART_COLORS.gold, goldSoft: CHART_COLORS.goldSoft };

    const timeout = window.setTimeout(() => {
      if (monthlyRef.current)  chartsRef.current.push(buildMonthlyChart(monthlyRef.current, transactions, accent));
      if (!isEcommerce) {
        if (pdvRef.current)      chartsRef.current.push(buildPdvChart(pdvRef.current, transactions, accent));
        if (tpeRef.current)      chartsRef.current.push(buildTpeChart(tpeRef.current, transactions, tpes));
        if (tpeByPdvRef.current) chartsRef.current.push(buildTpeByPdvChart(tpeByPdvRef.current, pdvs, tpes, accent));
      }
    }, 60);

    return () => {
      window.clearTimeout(timeout);
      chartsRef.current.forEach((c) => c.destroy());
      chartsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDashboardData, isEcommerce, isSousCommercant, transactions, tpes, pdvs]);

  return (
    <div className="commercant-overview">
      {isEcommerce && (siteMarchandUrl || applicationMobile) && (
        <div className="co-ecommerce-card">
          <span className="material-icons">language</span>
          <div>
            <strong>Vos canaux e-commerce</strong>
            {siteMarchandUrl && (
              <p>
                Site marchand : <a href={siteMarchandUrl} target="_blank" rel="noopener noreferrer">{siteMarchandUrl}</a>
              </p>
            )}
            {applicationMobile && <p>Application mobile : {applicationMobile}</p>}
          </div>
        </div>
      )}

      {!hasDashboardData ? (
        <div className="co-empty-board">
          <span className="material-icons">bar_chart</span>
          <strong>Aucune donnée disponible</strong>
          <p>
            {isEcommerce
              ? "Le graphique s'affichera dès que des transactions seront disponibles."
              : "Les graphiques s'afficheront dès que des données de transactions, TPE et PDV seront disponibles."}
          </p>
        </div>
      ) : (
        <div className="co-chart-grid">
          <article className="co-chart-card co-chart-wide">
            <div className="co-chart-head">
              <h2>Transactions par mois</h2>
              <p>{isSousCommercant ? 'Transactions de vos TPE affectés' : 'Évolution sur les six derniers mois'}</p>
            </div>
            <div className="co-chart-frame">
              <canvas ref={monthlyRef} />
            </div>
          </article>

          {!isEcommerce && (
            <>
              <article className="co-chart-card">
                <div className="co-chart-head">
                  <h2>{isSousCommercant ? 'Transactions de votre PDV' : 'Par point de vente'}</h2>
                  <p>{isSousCommercant ? 'Volume traité sur votre PDV' : 'Répartition selon les PDV'}</p>
                </div>
                <div className="co-chart-frame">
                  <canvas ref={pdvRef} />
                </div>
              </article>

              <article className="co-chart-card">
                <div className="co-chart-head">
                  <h2>Transactions par TPE</h2>
                  <p>{isSousCommercant ? 'Terminaux de votre PDV' : 'Volume par terminal'}</p>
                </div>
                <div className="co-chart-frame">
                  <canvas ref={tpeRef} />
                </div>
              </article>

              <article className="co-chart-card co-chart-wide">
                <div className="co-chart-head">
                  <h2>{isSousCommercant ? 'Vos TPE affectés' : 'TPE par point de vente'}</h2>
                  <p>{isSousCommercant ? 'Terminaux rattachés à votre PDV' : 'Nombre de terminaux par PDV'}</p>
                </div>
                <div className="co-chart-frame">
                  <canvas ref={tpeByPdvRef} />
                </div>
              </article>
            </>
          )}
        </div>
      )}
    </div>
  );
}
