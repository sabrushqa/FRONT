import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SupervisorPdvMapPage from './SupervisorPdvMapPage';

const getPdvMapMock = vi.fn();
const regeocoderPdvsMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getPdvMap: (...args: unknown[]) => getPdvMapMock(...args),
  regeocoderPdvs: (...args: unknown[]) => regeocoderPdvsMock(...args)
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn().mockReturnValue({}),
    latLngBounds: vi.fn().mockReturnValue({ pad: () => ({}) })
  }
}));

const { fakeMap } = vi.hoisted(() => ({
  fakeMap: {
    flyTo: vi.fn(),
    setView: vi.fn(),
    invalidateSize: vi.fn(),
    getContainer: () => document.createElement('div'),
    getZoom: () => 6,
    fitBounds: vi.fn()
  }
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  Marker: () => null,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => fakeMap,
  useMapEvent: () => fakeMap
}));

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="cluster">{children}</div>
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  getPdvMapMock.mockReset().mockResolvedValue({ pdvs: [] });
  regeocoderPdvsMock.mockReset();
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
});

describe('SupervisorPdvMapPage', () => {
  it('liste les villes couvertes par les PDV charges', async () => {
    getPdvMapMock.mockResolvedValue({
      pdvs: [
        { id: 1, ville: 'Casablanca', typeAffiliation: 'TPE', typeCommercant: 'PERSONNE_MORALE', latitude: 33.5, longitude: -7.6 },
        { id: 2, ville: 'Rabat', typeAffiliation: 'TPE', typeCommercant: 'PERSONNE_MORALE', latitude: 34.0, longitude: -6.8 }
      ]
    });

    render(<SupervisorPdvMapPage />);

    const villeSelect = await screen.findByLabelText('Ville', {}, { timeout: 3000 });
    const optionLabels = Array.from((villeSelect as HTMLSelectElement).options).map((o) => o.textContent);
    expect(optionLabels).toContain('Casablanca');
    expect(optionLabels).toContain('Rabat');
  });

  it('filtre les PDV par ville en changeant la selection', async () => {
    getPdvMapMock.mockResolvedValue({
      pdvs: [
        { id: 1, ville: 'Casablanca', typeAffiliation: 'TPE', typeCommercant: 'PERSONNE_MORALE', latitude: 33.5, longitude: -7.6 },
        { id: 2, ville: 'Rabat', typeAffiliation: 'TPE', typeCommercant: 'PERSONNE_MORALE', latitude: 34.0, longitude: -6.8 }
      ]
    });

    render(<SupervisorPdvMapPage />);
    const villeSelect = await screen.findByLabelText('Ville', {}, { timeout: 3000 }) as HTMLSelectElement;
    const casablancaOption = Array.from(villeSelect.options).find((o) => o.textContent === 'Casablanca')!;

    fireEvent.change(villeSelect, { target: { value: casablancaOption.value } });

    expect(villeSelect.value).toBe(casablancaOption.value);
    expect(screen.getByText('Réinitialiser')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getPdvMapMock.mockRejectedValue(new Error('503'));
    render(<SupervisorPdvMapPage />);
    expect(await screen.findByText(/impossible/i)).toBeInTheDocument();
  });
});
