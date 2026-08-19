import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useSupervisorDecisionData } from '../decision-dashboard/useSupervisorDecisionData';
import { barChartOptions } from '../decision-dashboard/chartOptions';
import { chartColors, formatDays, formatRate, isDarkTheme } from '../decision-dashboard/supervisorDecisionMetrics';
import { exportButtonProps } from '../decision-dashboard/chartExport';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-overview.scss';

function stackedChartOptions(): Record<string, unknown> {
  const textColor = isDarkTheme() ? '#cbd5e1' : '#334155';
  const gridColor = isDarkTheme() ? 'rgba(148, 163, 184, 0.18)' : '#e2e8f0';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 10, color: textColor, font: { size: 11 } } },
      tooltip: { backgroundColor: '#0f172a', titleColor: '#ffffff', bodyColor: '#ffffff', padding: 10 }
    },
    scales: {
      x: { stacked: true, ticks: { color: textColor }, grid: { display: false } },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: gridColor } }
    }
  };
}

// Fusionne les anciennes pages "Perf. commerciale", "Top prospection", "Top
// auto région" et "Perf. back office" : elles partageaient deja la meme
// source de donnees (useSupervisorDecisionData) et decrivaient toutes "qui
// performe" — juste decoupees par origine (globale / prospection directe /
// auto-affiliation) ou par role (commerciale / back office). Regroupees ici
// en 2 sections : Commerciales (avec le detail par origine) et Back office.
export default function SupervisorTeamPerformancePage() {
  const { isLoading, errorMessage, metrics } = useSupervisorDecisionData();

  const commercialChartRef = useRef<HTMLCanvasElement>(null);
  const topDirectChartRef = useRef<HTMLCanvasElement>(null);
  const topAutoRegionChartRef = useRef<HTMLCanvasElement>(null);
  const boaChartRef = useRef<HTMLCanvasElement>(null);
  const motifChartRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);

  useEffect(() => {
    while (chartsRef.current.length) chartsRef.current.pop()?.destroy();
    if (isLoading) return;

    if (commercialChartRef.current && metrics.commercialRows.length > 0) {
      chartsRef.current.push(new Chart(commercialChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.commercialRows.map((row) => row.label),
          datasets: [
            { label: 'Assignées', data: metrics.commercialRows.map((row) => row.assigned), backgroundColor: chartColors.blue },
            { label: 'Validées', data: metrics.commercialRows.map((row) => row.validated), backgroundColor: chartColors.green },
            { label: 'Refus / incomplet', data: metrics.commercialRows.map((row) => row.refusedOrIncomplete), backgroundColor: chartColors.red }
          ]
        },
        options: stackedChartOptions()
      }));
    }

    if (topDirectChartRef.current && metrics.topCommercialDirectRows.length) {
      chartsRef.current.push(new Chart(topDirectChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.topCommercialDirectRows.map((row) => row.label),
          datasets: [
            { label: 'Créées', data: metrics.topCommercialDirectRows.map((row) => row.created), backgroundColor: chartColors.blue },
            { label: 'Converties', data: metrics.topCommercialDirectRows.map((row) => row.converted), backgroundColor: chartColors.green }
          ]
        },
        options: barChartOptions(false)
      }));
    }

    if (topAutoRegionChartRef.current && metrics.topCommercialAutoRegionRows.length) {
      chartsRef.current.push(new Chart(topAutoRegionChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.topCommercialAutoRegionRows.map((row) => `${row.label} - ${row.region}`),
          datasets: [
            { label: 'Traitées', data: metrics.topCommercialAutoRegionRows.map((row) => row.treated), backgroundColor: chartColors.blue },
            { label: 'Validées', data: metrics.topCommercialAutoRegionRows.map((row) => row.validated), backgroundColor: chartColors.green },
            { label: 'Corrections/refus', data: metrics.topCommercialAutoRegionRows.map((row) => row.correction), backgroundColor: chartColors.red }
          ]
        },
        options: barChartOptions(false)
      }));
    }

    if (boaChartRef.current && metrics.boaRows.length > 0) {
      chartsRef.current.push(new Chart(boaChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.boaRows.map((row) => row.label),
          datasets: [
            { label: 'Validés', data: metrics.boaRows.map((row) => row.validated), backgroundColor: chartColors.green },
            { label: 'Refusés', data: metrics.boaRows.map((row) => row.refused), backgroundColor: chartColors.red },
            { label: 'Corrections', data: metrics.boaRows.map((row) => row.correction), backgroundColor: chartColors.yellow }
          ]
        },
        options: stackedChartOptions()
      }));
    }

    if (motifChartRef.current && metrics.refusalMotifPoints.length > 0) {
      chartsRef.current.push(new Chart(motifChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.refusalMotifPoints.map((point) => point.label),
          datasets: [{
            label: 'Occurrences',
            data: metrics.refusalMotifPoints.map((point) => point.value),
            backgroundColor: chartColors.pink,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: barChartOptions(false)
      }));
    }

    return () => {
      while (chartsRef.current.length) chartsRef.current.pop()?.destroy();
    };
  }, [
    isLoading,
    metrics.commercialRows,
    metrics.topCommercialDirectRows,
    metrics.topCommercialAutoRegionRows,
    metrics.boaRows,
    metrics.refusalMotifPoints
  ]);

  return (
    <div className="page-grid bi-dashboard supervisor-decision-dashboard team-performance-page">
      {errorMessage && <div className="page-alert error" role="alert"><span>{errorMessage}</span></div>}
      {isLoading && (
        <div className="page-loading commercial-loading">
          <div className="page-loading-spinner" />
          <span>Chargement de la performance des équipes...</span>
        </div>
      )}

      {!isLoading && (
        <>
          <section className="decision-section">
            <div className="decision-section-head">
              <div>
                <span>Commerciales</span>
                <h2>Suivi par commerciale, toutes origines</h2>
              </div>
            </div>

            {metrics.commercialRows.length > 0 ? (
              <div className="team-performance-panel">
                <article className="decision-chart-card decision-chart-card--full">
                  <div className="decision-card-title">
                    <span>Vue d'ensemble</span>
                    <h3>Assignées, validées et retours</h3>
                  </div>
                  <div className="decision-chart-wrap"><canvas ref={commercialChartRef} /></div>
                  <button
                    {...exportButtonProps(
                      'performance-commerciales-vue-ensemble',
                      'Commerciales',
                      [
                        { header: 'Commerciale', key: 'label', value: (r: (typeof metrics.commercialRows)[number]) => r.label },
                        { header: 'Assignées', key: 'assigned', value: (r: (typeof metrics.commercialRows)[number]) => r.assigned },
                        { header: 'Complétées', key: 'completed', value: (r: (typeof metrics.commercialRows)[number]) => r.completed },
                        { header: 'Envoyées BOA', key: 'sentBoa', value: (r: (typeof metrics.commercialRows)[number]) => r.sentBoa },
                        { header: 'Refus / incomplet', key: 'refusedOrIncomplete', value: (r: (typeof metrics.commercialRows)[number]) => r.refusedOrIncomplete },
                        { header: 'Validées', key: 'validated', value: (r: (typeof metrics.commercialRows)[number]) => r.validated },
                        { header: 'Conversion', key: 'conversionRate', value: (r: (typeof metrics.commercialRows)[number]) => r.conversionRate },
                        { header: 'Délai moyen (j)', key: 'averageDays', value: (r: (typeof metrics.commercialRows)[number]) => r.averageDays }
                      ],
                      metrics.commercialRows
                    )}
                    type="button"
                  >
                    <span className="material-icons">download</span>{' '}
                    Excel
                  </button>
                </article>
                <div className="decision-table-wrap">
                  <table className="decision-table">
                    <thead>
                      <tr>
                        <th>Commerciale</th>
                        <th>Assignées</th>
                        <th>Complétées</th>
                        <th>Envoyées BOA</th>
                        <th>Refus / incomplet</th>
                        <th>Validées</th>
                        <th>Conversion</th>
                        <th>Délai moyen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.commercialRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.label}</td>
                          <td>{row.assigned}</td>
                          <td>{row.completed}</td>
                          <td>{row.sentBoa}</td>
                          <td>{row.refusedOrIncomplete}</td>
                          <td>{row.validated}</td>
                          <td>{formatRate(row.conversionRate)}</td>
                          <td>{formatDays(row.averageDays)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-bi">
                <strong>Aucune performance commerciale</strong>
                <span>Les données apparaîtront après assignation ou traitement des dossiers.</span>
              </div>
            )}

            {metrics.topCommercialDirectRows.length > 0 && (
              <div className="team-performance-panel">
                <div className="decision-subsection-head">
                  <span>Prospection directe</span>
                  <h3>Commerciales qui créent le plus et qui convertissent</h3>
                </div>
                <article className="decision-chart-card decision-chart-card--full">
                  <div className="decision-chart-wrap"><canvas ref={topDirectChartRef} /></div>
                  <button
                    {...exportButtonProps(
                      'performance-commerciales-prospection-directe',
                      'Prospection directe',
                      [
                        { header: 'Commerciale', key: 'label', value: (r: (typeof metrics.topCommercialDirectRows)[number]) => r.label },
                        { header: 'Créées', key: 'created', value: (r: (typeof metrics.topCommercialDirectRows)[number]) => r.created },
                        { header: 'Converties', key: 'converted', value: (r: (typeof metrics.topCommercialDirectRows)[number]) => r.converted },
                        { header: 'Taux conversion', key: 'conversionRate', value: (r: (typeof metrics.topCommercialDirectRows)[number]) => r.conversionRate }
                      ],
                      metrics.topCommercialDirectRows
                    )}
                    type="button"
                  >
                    <span className="material-icons">download</span>{' '}
                    Excel
                  </button>
                </article>
                <div className="decision-table-wrap">
                  <table className="decision-table">
                    <thead>
                      <tr>
                        <th>Commerciale</th>
                        <th>Créées</th>
                        <th>Converties</th>
                        <th>Taux conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.topCommercialDirectRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.label}</td>
                          <td>{row.created}</td>
                          <td>{row.converted}</td>
                          <td>{formatRate(row.conversionRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {metrics.topCommercialAutoRegionRows.length > 0 && (
              <div className="team-performance-panel">
                <div className="decision-subsection-head">
                  <span>Auto-affiliation par région</span>
                  <h3>Commerciales qui traitent le plus, par région</h3>
                </div>
                <article className="decision-chart-card decision-chart-card--full">
                  <div className="decision-chart-wrap"><canvas ref={topAutoRegionChartRef} /></div>
                  <button
                    {...exportButtonProps(
                      'performance-commerciales-auto-region',
                      'Auto-affiliation région',
                      [
                        { header: 'Commerciale', key: 'label', value: (r: (typeof metrics.topCommercialAutoRegionRows)[number]) => r.label },
                        { header: 'Région', key: 'region', value: (r: (typeof metrics.topCommercialAutoRegionRows)[number]) => r.region },
                        { header: 'Traitées', key: 'treated', value: (r: (typeof metrics.topCommercialAutoRegionRows)[number]) => r.treated },
                        { header: 'Validées', key: 'validated', value: (r: (typeof metrics.topCommercialAutoRegionRows)[number]) => r.validated },
                        { header: 'Corrections/refus', key: 'correction', value: (r: (typeof metrics.topCommercialAutoRegionRows)[number]) => r.correction }
                      ],
                      metrics.topCommercialAutoRegionRows
                    )}
                    type="button"
                  >
                    <span className="material-icons">download</span>{' '}
                    Excel
                  </button>
                </article>
                <div className="decision-table-wrap">
                  <table className="decision-table">
                    <thead>
                      <tr>
                        <th>Commerciale</th>
                        <th>Région</th>
                        <th>Traitées</th>
                        <th>Validées</th>
                        <th>Corrections/refus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.topCommercialAutoRegionRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.label}</td>
                          <td>{row.region}</td>
                          <td>{row.treated}</td>
                          <td>{row.validated}</td>
                          <td>{row.correction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="decision-section">
            <div className="decision-section-head">
              <div>
                <span>Back office</span>
                <h2>Traitement, décisions et retours</h2>
              </div>
            </div>
            <div className="decision-chart-grid">
              <article className="decision-chart-card decision-chart-card--wide">
                <div className="decision-card-title">
                  <span>BOA</span>
                  <h3>Validés, refusés et corrections demandées</h3>
                </div>
                <div className="decision-chart-wrap"><canvas ref={boaChartRef} /></div>
                <button
                  {...exportButtonProps(
                    'performance-back-office',
                    'Back office',
                    [
                      { header: 'Back office', key: 'label', value: (r: (typeof metrics.boaRows)[number]) => r.label },
                      { header: 'Traités', key: 'treated', value: (r: (typeof metrics.boaRows)[number]) => r.treated },
                      { header: 'Validés', key: 'validated', value: (r: (typeof metrics.boaRows)[number]) => r.validated },
                      { header: 'Refusés', key: 'refused', value: (r: (typeof metrics.boaRows)[number]) => r.refused },
                      { header: 'Corrections', key: 'correction', value: (r: (typeof metrics.boaRows)[number]) => r.correction },
                      { header: 'Délai moyen (j)', key: 'averageDays', value: (r: (typeof metrics.boaRows)[number]) => r.averageDays }
                    ],
                    metrics.boaRows
                  )}
                  type="button"
                >
                  <span className="material-icons">download</span>{' '}
                  Excel
                </button>
              </article>
              <article className="decision-chart-card">
                <div className="decision-card-title">
                  <span>Motifs</span>
                  <h3>Motifs fréquents</h3>
                </div>
                {metrics.refusalMotifPoints.length > 0 ? (
                  <>
                    <div className="decision-chart-wrap"><canvas ref={motifChartRef} /></div>
                    <button
                      {...exportButtonProps(
                        'performance-motifs-refus',
                        'Motifs',
                        [
                          { header: 'Motif', key: 'label', value: (p: (typeof metrics.refusalMotifPoints)[number]) => p.label },
                          { header: 'Occurrences', key: 'value', value: (p: (typeof metrics.refusalMotifPoints)[number]) => p.value }
                        ],
                        metrics.refusalMotifPoints
                      )}
                      type="button"
                    >
                      <span className="material-icons">download</span>{' '}
                      Excel
                    </button>
                  </>
                ) : (
                  <div className="decision-chart-empty">
                    <span className="material-icons" aria-hidden="true">check_circle</span>
                    <strong>Aucun motif enregistré</strong>
                    <small>Les refus et corrections apparaîtront ici.</small>
                  </div>
                )}
              </article>
            </div>
            <div className="decision-table-wrap">
              <table className="decision-table">
                <thead>
                  <tr>
                    <th>Back office</th>
                    <th>Traités</th>
                    <th>Validés</th>
                    <th>Refusés</th>
                    <th>Corrections</th>
                    <th>Délai moyen</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.boaRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      <td>{row.treated}</td>
                      <td>{row.validated}</td>
                      <td>{row.refused}</td>
                      <td>{row.correction}</td>
                      <td>{formatDays(row.averageDays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
