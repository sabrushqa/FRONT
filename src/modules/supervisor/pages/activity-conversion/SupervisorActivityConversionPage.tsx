import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useSupervisorDecisionData } from '../decision-dashboard/useSupervisorDecisionData';
import { barChartOptions } from '../decision-dashboard/chartOptions';
import { chartColors } from '../decision-dashboard/supervisorDecisionMetrics';
import { exportButtonProps } from '../decision-dashboard/chartExport';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-overview.scss';

// Fusionne les anciennes pages "Conversion", "Auto-affiliation du mois",
// "Prospection du mois" et "Segmentation" : elles partageaient deja la meme
// source de donnees (useSupervisorDecisionData) et n'affichaient chacune
// qu'1 ou 2 graphiques sur une page entiere. Regroupees ici en 3 sections
// pour donner une vue "activite & conversion" complete en un seul ecran.
export default function SupervisorActivityConversionPage() {
  const { isLoading, errorMessage, metrics } = useSupervisorDecisionData();

  const conversionChartRef = useRef<HTMLCanvasElement>(null);
  const autoMonthlyChartRef = useRef<HTMLCanvasElement>(null);
  const prospectionStatusChartRef = useRef<HTMLCanvasElement>(null);
  const prospectionRegionChartRef = useRef<HTMLCanvasElement>(null);
  const affiliationTypeChartRef = useRef<HTMLCanvasElement>(null);
  const merchantNatureChartRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);

  useEffect(() => {
    while (chartsRef.current.length) chartsRef.current.pop()?.destroy();
    if (isLoading) return;

    if (conversionChartRef.current) {
      chartsRef.current.push(new Chart(conversionChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.conversionByOriginPoints.map((point) => point.label),
          datasets: [
            { label: 'Actives', data: metrics.conversionByOriginPoints.map((point) => point.values.Actives), backgroundColor: chartColors.blue },
            { label: 'Validées', data: metrics.conversionByOriginPoints.map((point) => point.values.Validées), backgroundColor: chartColors.green },
            { label: 'Converties', data: metrics.conversionByOriginPoints.map((point) => point.values.Converties), backgroundColor: chartColors.pink }
          ]
        },
        options: barChartOptions(false)
      }));
    }

    if (autoMonthlyChartRef.current && metrics.monthlyAutoStatusPoints.length) {
      chartsRef.current.push(new Chart(autoMonthlyChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.monthlyAutoStatusPoints.map((point) => point.label),
          datasets: [{
            label: 'Demandes reçues',
            data: metrics.monthlyAutoStatusPoints.map((point) => point.value),
            backgroundColor: chartColors.blue,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: barChartOptions(false)
      }));
    }

    if (prospectionStatusChartRef.current && metrics.monthlyProspectionStatusPoints.length) {
      chartsRef.current.push(new Chart(prospectionStatusChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.monthlyProspectionStatusPoints.map((point) => point.label),
          datasets: [{
            label: 'Prospections créées',
            data: metrics.monthlyProspectionStatusPoints.map((point) => point.value),
            backgroundColor: chartColors.pink,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: barChartOptions(false)
      }));
    }

    if (prospectionRegionChartRef.current && metrics.monthlyProspectionRegionPoints.length) {
      chartsRef.current.push(new Chart(prospectionRegionChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.monthlyProspectionRegionPoints.map((point) => point.label),
          datasets: [{
            label: 'Prospections créées',
            data: metrics.monthlyProspectionRegionPoints.map((point) => point.value),
            backgroundColor: chartColors.green,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: barChartOptions(false)
      }));
    }

    if (affiliationTypeChartRef.current) {
      chartsRef.current.push(new Chart(affiliationTypeChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.affiliationTypePoints.map((point) => point.label),
          datasets: [
            { label: 'Auto-affiliation', data: metrics.affiliationTypePoints.map((point) => point.values['Auto-affiliation']), backgroundColor: chartColors.blue },
            { label: 'Prospection directe', data: metrics.affiliationTypePoints.map((point) => point.values['Prospection directe']), backgroundColor: chartColors.pink }
          ]
        },
        options: barChartOptions(false)
      }));
    }

    if (merchantNatureChartRef.current) {
      chartsRef.current.push(new Chart(merchantNatureChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.merchantNaturePoints.map((point) => point.label),
          datasets: [
            { label: 'Auto-affiliation', data: metrics.merchantNaturePoints.map((point) => point.values['Auto-affiliation']), backgroundColor: chartColors.green },
            { label: 'Prospection directe', data: metrics.merchantNaturePoints.map((point) => point.values['Prospection directe']), backgroundColor: chartColors.yellow }
          ]
        },
        options: barChartOptions(false)
      }));
    }

    return () => {
      while (chartsRef.current.length) chartsRef.current.pop()?.destroy();
    };
  }, [
    isLoading,
    metrics.conversionByOriginPoints,
    metrics.monthlyAutoStatusPoints,
    metrics.monthlyProspectionStatusPoints,
    metrics.monthlyProspectionRegionPoints,
    metrics.affiliationTypePoints,
    metrics.merchantNaturePoints
  ]);

  return (
    <div className="page-grid bi-dashboard supervisor-decision-dashboard activity-conversion-page">
      {errorMessage && <div className="page-alert error" role="alert"><span>{errorMessage}</span></div>}
      {isLoading && (
        <div className="page-loading commercial-loading">
          <div className="page-loading-spinner" />
          <span>Chargement de l’activité...</span>
        </div>
      )}

      {!isLoading && (
        <>
          <section className="decision-section">
            <div className="decision-section-head">
              <div>
                <span>Conversion</span>
                <h2>Auto-affiliation vs prospection directe</h2>
              </div>
            </div>
            <article className="decision-chart-card decision-chart-card--full">
              <div className="decision-card-title">
                <span>Actif / validé / converti</span>
                <h3>Comparaison des demandes par origine</h3>
              </div>
              <div className="decision-chart-wrap"><canvas ref={conversionChartRef} /></div>
              <button
                {...exportButtonProps(
                  'activite-conversion-par-origine',
                  'Conversion',
                  [
                    { header: 'Origine', key: 'label', value: (p: (typeof metrics.conversionByOriginPoints)[number]) => p.label },
                    { header: 'Actives', key: 'actives', value: (p: (typeof metrics.conversionByOriginPoints)[number]) => p.values.Actives ?? 0 },
                    { header: 'Validées', key: 'validees', value: (p: (typeof metrics.conversionByOriginPoints)[number]) => p.values['Validées'] ?? 0 },
                    { header: 'Converties', key: 'converties', value: (p: (typeof metrics.conversionByOriginPoints)[number]) => p.values.Converties ?? 0 }
                  ],
                  metrics.conversionByOriginPoints
                )}
                type="button"
              >
                <span className="material-icons">download</span>{' '}
                Excel
              </button>
            </article>
          </section>

          <section className="decision-section">
            <div className="decision-section-head">
              <div>
                <span>Volume du mois</span>
                <h2>Demandes reçues ce mois-ci</h2>
              </div>
            </div>
            <article className="decision-chart-card decision-chart-card--full">
              <div className="decision-card-title">
                <span>Auto-affiliation</span>
                <h3>Nombre de demandes par statut</h3>
              </div>
              <div className="decision-chart-wrap"><canvas ref={autoMonthlyChartRef} /></div>
              <button
                {...exportButtonProps(
                  'activite-conversion-auto-affiliation-mensuel',
                  'Auto-affiliation',
                  [
                    { header: 'Statut', key: 'label', value: (p: (typeof metrics.monthlyAutoStatusPoints)[number]) => p.label },
                    { header: 'Demandes', key: 'value', value: (p: (typeof metrics.monthlyAutoStatusPoints)[number]) => p.value }
                  ],
                  metrics.monthlyAutoStatusPoints
                )}
                type="button"
              >
                <span className="material-icons">download</span>{' '}
                Excel
              </button>
            </article>
            <div className="decision-chart-grid">
              <article className="decision-chart-card">
                <div className="decision-card-title">
                  <span>Prospection directe — statut</span>
                  <h3>Nombre de prospections par statut</h3>
                </div>
                <div className="decision-chart-wrap"><canvas ref={prospectionStatusChartRef} /></div>
                <button
                  {...exportButtonProps(
                    'activite-conversion-prospection-statut',
                    'Prospection statut',
                    [
                      { header: 'Statut', key: 'label', value: (p: (typeof metrics.monthlyProspectionStatusPoints)[number]) => p.label },
                      { header: 'Prospections', key: 'value', value: (p: (typeof metrics.monthlyProspectionStatusPoints)[number]) => p.value }
                    ],
                    metrics.monthlyProspectionStatusPoints
                  )}
                  type="button"
                >
                  <span className="material-icons">download</span>{' '}
                  Excel
                </button>
              </article>
              <article className="decision-chart-card">
                <div className="decision-card-title">
                  <span>Prospection directe — région</span>
                  <h3>Nombre de prospections par région</h3>
                </div>
                <div className="decision-chart-wrap"><canvas ref={prospectionRegionChartRef} /></div>
                <button
                  {...exportButtonProps(
                    'activite-conversion-prospection-region',
                    'Prospection région',
                    [
                      { header: 'Région', key: 'label', value: (p: (typeof metrics.monthlyProspectionRegionPoints)[number]) => p.label },
                      { header: 'Prospections', key: 'value', value: (p: (typeof metrics.monthlyProspectionRegionPoints)[number]) => p.value }
                    ],
                    metrics.monthlyProspectionRegionPoints
                  )}
                  type="button"
                >
                  <span className="material-icons">download</span>{' '}
                  Excel
                </button>
              </article>
            </div>
          </section>

          <section className="decision-section">
            <div className="decision-section-head">
              <div>
                <span>Segmentation</span>
                <h2>Type d’affiliation et nature de personne</h2>
              </div>
            </div>
            <div className="decision-chart-grid">
              <article className="decision-chart-card">
                <div className="decision-card-title">
                  <span>Type affiliation</span>
                  <h3>Auto-affiliation et prospection directe</h3>
                </div>
                <div className="decision-chart-wrap"><canvas ref={affiliationTypeChartRef} /></div>
                <button
                  {...exportButtonProps(
                    'activite-conversion-segmentation-type-affiliation',
                    'Type affiliation',
                    [
                      { header: 'Type', key: 'label', value: (p: (typeof metrics.affiliationTypePoints)[number]) => p.label },
                      { header: 'Auto-affiliation', key: 'auto', value: (p: (typeof metrics.affiliationTypePoints)[number]) => p.values['Auto-affiliation'] ?? 0 },
                      { header: 'Prospection directe', key: 'directe', value: (p: (typeof metrics.affiliationTypePoints)[number]) => p.values['Prospection directe'] ?? 0 }
                    ],
                    metrics.affiliationTypePoints
                  )}
                  type="button"
                >
                  <span className="material-icons">download</span>{' '}
                  Excel
                </button>
              </article>
              <article className="decision-chart-card">
                <div className="decision-card-title">
                  <span>Nature de personne</span>
                  <h3>Répartition par type commerçant</h3>
                </div>
                <div className="decision-chart-wrap"><canvas ref={merchantNatureChartRef} /></div>
                <button
                  {...exportButtonProps(
                    'activite-conversion-segmentation-nature-commercant',
                    'Nature commerçant',
                    [
                      { header: 'Nature', key: 'label', value: (p: (typeof metrics.merchantNaturePoints)[number]) => p.label },
                      { header: 'Auto-affiliation', key: 'auto', value: (p: (typeof metrics.merchantNaturePoints)[number]) => p.values['Auto-affiliation'] ?? 0 },
                      { header: 'Prospection directe', key: 'directe', value: (p: (typeof metrics.merchantNaturePoints)[number]) => p.values['Prospection directe'] ?? 0 }
                    ],
                    metrics.merchantNaturePoints
                  )}
                  type="button"
                >
                  <span className="material-icons">download</span>{' '}
                  Excel
                </button>
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
