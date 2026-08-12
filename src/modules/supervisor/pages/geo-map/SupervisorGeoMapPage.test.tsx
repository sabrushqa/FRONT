import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupervisorGeoMapPage from './SupervisorGeoMapPage';

const getOverviewMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getOverview: (...args: unknown[]) => getOverviewMock(...args)
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({ children }: { children?: React.ReactNode }) => <div data-testid="circle-marker">{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({
    flyTo: vi.fn(),
    setView: vi.fn(),
    invalidateSize: vi.fn(),
    getContainer: () => document.createElement('div')
  })
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  getOverviewMock.mockReset().mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
});

describe('SupervisorGeoMapPage', () => {
  it('agrege le nombre total de commercants et de villes couvertes', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [],
      commerciales: [],
      commercants: [
        { ville: 'Casablanca', region: 'Casablanca-Settat' },
        { ville: 'Casablanca', region: 'Casablanca-Settat' },
        { ville: 'Rabat', region: 'Rabat-Salé-Kénitra' }
      ]
    });

    render(<SupervisorGeoMapPage />);

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('Casablanca')).toBeInTheDocument();
    expect(screen.getByText('Rabat')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getOverviewMock.mockRejectedValue(new Error('503'));
    render(<SupervisorGeoMapPage />);
    expect(await screen.findByText('Impossible de charger la répartition géographique.')).toBeInTheDocument();
  });
});
