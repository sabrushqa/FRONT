import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useSupervisorDecisionData } from '../decision-dashboard/useSupervisorDecisionData';
import { chartColors, isDarkTheme } from '../decision-dashboard/supervisorDecisionMetrics';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-overview.scss';

function baseChartOptions(type: 'bar' | 'doughnut'): Record<string, unknown> {
  const isCircular = type === 'doughnut';
  const textColor = isDarkTheme() ? '#cbd5e1' : '#334155';
  const gridColor = isDarkTheme() ? 'rgba(148, 163, 184, 0.18)' : '#e2e8f0';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: isCircular ? 'bottom' : 'top',
        labels: { boxWidth: 10, color: textColor, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        padding: 10
      }
    },
    scales: isCircular
      ? undefined
      : {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: gridColor } }
        }
  };
}

export default function SupervisorPipelinePage() {
  const { isLoading, errorMessage, requests, metrics } = useSupervisorDecisionData();
  const pipelineChartRef = useRef<HTMLCanvasElement>(null);
  const originChartRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);

  useEffect(() => {
    while (chartsRef.current.length) {
      chartsRef.current.pop()?.destroy();
    }

    if (isLoading || !requests.length) return;

    if (pipelineChartRef.current) {
      chartsRef.current.push(
        new Chart(pipelineChartRef.current, {
          type: 'bar',
          data: {
            labels: metrics.pipelinePoints.map((point) => point.label),
            datasets: [
              {
                label: 'Dossiers',
                data: metrics.pipelinePoints.map((point) => point.value),
                backgroundColor: [
                  chartColors.slate,
                  chartColors.sky,
                  chartColors.yellow,
                  chartColors.blue,
                  chartColors.pink,
                  chartColors.red,
                  chartColors.navy,
                  '#7c3aed',
                  chartColors.green
                ],
                borderRadius: 8,
                borderSkipped: false
              }
            ]
          },
          options: baseChartOptions('bar')
        })
      );
    }

    if (originChartRef.current) {
      chartsRef.current.push(
        new Chart(originChartRef.current, {
          type: 'doughnut',
          data: {
            labels: metrics.originPoints.map((point) => point.label),
            datasets: [
              {
                data: metrics.originPoints.map((point) => point.value),
                backgroundColor: [chartColors.blue, chartColors.pink, chartColors.green],
                borderColor: '#ffffff',
                borderWidth: 2
              }
            ]
          },
          options: { ...baseChartOptions('doughnut'), cutout: '66%' }
        })
      );
    }

    return () => {
      while (chartsRef.current.length) {
        chartsRef.current.pop()?.destroy();
      }
    };
  }, [isLoading, requests.length, metrics.pipelinePoints, metrics.originPoints]);

  return (
    <div className="page-grid bi-dashboard supervisor-decision-dashboard">
      {errorMessage && <div className="page-alert error" role="alert"><span>{errorMessage}</span></div>}
      {isLoading && (
        <div className="page-loading commercial-loading">
          <div className="page-loading-spinner" />
          <span>Chargement du pipeline...</span>
        </div>
      )}

      {!isLoading && requests.length > 0 && (
        <section className="decision-section">
          <div className="decision-section-head">
            <div>
              <span>Pipeline des dossiers</span>
              <h2>Où les demandes sont bloquées</h2>
            </div>
          </div>
          <div className="decision-chart-grid">
            <article className="decision-chart-card decision-chart-card--wide">
              <div className="decision-card-title">
                <span>Statuts</span>
                <h3>Répartition complète du pipeline</h3>
              </div>
              <div className="decision-chart-wrap">
                <canvas ref={pipelineChartRef} />
              </div>
            </article>
            <article className="decision-chart-card">
              <div className="decision-card-title">
                <span>Origine</span>
                <h3>Auto / prospection / extension</h3>
              </div>
              <div className="decision-chart-wrap">
                <canvas ref={originChartRef} />
              </div>
            </article>
          </div>
          <div className="pipeline-status-grid">
            {metrics.pipelinePoints.map((point) => {
              const percent = requests.length ? Math.round((point.value / requests.length) * 100) : 0;
              return (
                <article className="pipeline-status-card" key={point.label}>
                  <div>
                    <span>{point.label}</span>
                    <strong>{point.value}</strong>
                  </div>
                  <div className="pipeline-bar">
                    <span style={{ width: `${Math.max(percent, point.value > 0 ? 6 : 0)}%` }} />
                  </div>
                  <small>{percent}% du total</small>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!isLoading && requests.length === 0 && (
        <section className="empty-bi">
          <strong>Aucune donnée à visualiser</strong>
          <span>Le pipeline sera affiché dès que les dossiers seront disponibles.</span>
        </section>
      )}
    </div>
  );
}
