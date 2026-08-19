import { isDarkTheme } from './supervisorDecisionMetrics';

export function barChartOptions(stacked = false): Record<string, unknown> {
  const textColor = isDarkTheme() ? '#cbd5e1' : '#334155';
  const gridColor = isDarkTheme() ? 'rgba(148, 163, 184, 0.18)' : '#e2e8f0';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 10, color: textColor, font: { size: 11 } } },
      tooltip: { backgroundColor: '#0f172a', titleColor: '#ffffff', bodyColor: '#ffffff', padding: 10 }
    },
    datasets: {
      bar: {
        barPercentage: 0.48,
        categoryPercentage: 0.62,
        maxBarThickness: 32
      }
    },
    scales: {
      x: { stacked, ticks: { color: textColor }, grid: { display: false } },
      y: { stacked, beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: gridColor } }
    }
  };
}

// Barres HORIZONTALES (indexAxis: 'y') : pour une categorie avec beaucoup
// d'entrees et/ou des libelles texte longs (noms, regions...), un axe des
// categories a plat lit bien mieux qu'un axe vertical aux labels pivotes/
// empiles qui finissent par se chevaucher.
export function horizontalBarOptions(stacked = false): Record<string, unknown> {
  const textColor = isDarkTheme() ? '#cbd5e1' : '#334155';
  const gridColor = isDarkTheme() ? 'rgba(148, 163, 184, 0.18)' : '#e2e8f0';
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 10, color: textColor, font: { size: 11 } } },
      tooltip: { backgroundColor: '#0f172a', titleColor: '#ffffff', bodyColor: '#ffffff', padding: 10 }
    },
    datasets: {
      bar: { barPercentage: 0.6, categoryPercentage: 0.7, maxBarThickness: 26 }
    },
    scales: {
      x: { stacked, beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: gridColor } },
      y: { stacked, ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } }
    }
  };
}

export function doughnutChartOptions(): Record<string, unknown> {
  const textColor = isDarkTheme() ? '#cbd5e1' : '#334155';
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor, font: { size: 11 } } },
      tooltip: { backgroundColor: '#0f172a', titleColor: '#ffffff', bodyColor: '#ffffff', padding: 10 }
    }
  };
}
