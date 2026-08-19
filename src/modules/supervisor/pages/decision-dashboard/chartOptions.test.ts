import { describe, it, expect } from 'vitest';
import { barChartOptions, horizontalBarOptions, doughnutChartOptions } from './chartOptions';

describe('chartOptions', () => {
  it('barChartOptions active le stacking sur x et y quand demande', () => {
    const options = barChartOptions(true) as { scales: { x: { stacked: boolean }; y: { stacked: boolean } } };
    expect(options.scales.x.stacked).toBe(true);
    expect(options.scales.y.stacked).toBe(true);
  });

  it('barChartOptions ne stack pas par defaut', () => {
    const options = barChartOptions() as { scales: { x: { stacked: boolean }; y: { stacked: boolean } } };
    expect(options.scales.x.stacked).toBe(false);
    expect(options.scales.y.stacked).toBe(false);
  });

  it('horizontalBarOptions utilise un axe des categories horizontal (indexAxis: y)', () => {
    const options = horizontalBarOptions(true) as {
      indexAxis: string;
      scales: { x: { stacked: boolean; beginAtZero: boolean }; y: { stacked: boolean } };
    };
    expect(options.indexAxis).toBe('y');
    expect(options.scales.x.stacked).toBe(true);
    expect(options.scales.x.beginAtZero).toBe(true);
    expect(options.scales.y.stacked).toBe(true);
  });

  it('doughnutChartOptions configure une legende en bas et un cutout central', () => {
    const options = doughnutChartOptions() as { cutout: string; plugins: { legend: { position: string } } };
    expect(options.cutout).toBe('62%');
    expect(options.plugins.legend.position).toBe('bottom');
  });
});
