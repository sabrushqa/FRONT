import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useSupervisorDecisionData } from '../decision-dashboard/useSupervisorDecisionData';
import { barChartOptions } from '../decision-dashboard/chartOptions';
import { chartColors } from '../decision-dashboard/supervisorDecisionMetrics';
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
            </article>
            <div className="decision-chart-grid">
              <article className="decision-chart-card">
                <div className="decision-card-title">
                  <span>Prospection directe — statut</span>
                  <h3>Nombre de prospections par statut</h3>
                </div>
                <div className="decision-chart-wrap"><canvas ref={prospectionStatusChartRef} /></div>
              </article>
              <article className="decision-chart-card">
                <div className="decision-card-title">
                  <span>Prospection directe — région</span>
                  <h3>Nombre de prospections par région</h3>
                </div>
                <div className="decision-chart-wrap"><canvas ref={prospectionRegionChartRef} /></div>
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
              </article>
              <article className="decision-chart-card">
                <div className="decision-card-title">
                  <span>Nature de personne</span>
                  <h3>Répartition par type commerçant</h3>
                </div>
                <div className="decision-chart-wrap"><canvas ref={merchantNatureChartRef} /></div>
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
