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

function totalPdvsCount(): string {
  const card = Array.from(document.querySelectorAll('.geo-kpi-card')).find((el) => el.textContent?.includes('Points de vente'))!;
  return card.querySelector('strong')!.textContent!;
}

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

  it('lance le re-geocodage et affiche le message de reponse', async () => {
    getPdvMapMock.mockResolvedValue({
      pdvs: [{ id: 1, ville: 'Casablanca', typeAffiliation: 'TPE', typeCommercant: 'PERSONNE_MORALE', latitude: 33.5, longitude: -7.6 }]
    });
    regeocoderPdvsMock.mockResolvedValue({ message: '3 points de vente ré-géocodés.' });

    render(<SupervisorPdvMapPage />);
    await screen.findByLabelText('Ville', {}, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: 'Ré-géocoder' }));

    expect(await screen.findByText('3 points de vente ré-géocodés.')).toBeInTheDocument();
    expect(regeocoderPdvsMock).toHaveBeenCalled();
  });

  it('affiche une erreur si le re-geocodage echoue', async () => {
    getPdvMapMock.mockResolvedValue({ pdvs: [] });
    regeocoderPdvsMock.mockRejectedValue(new Error('503'));

    render(<SupervisorPdvMapPage />);
    await screen.findByLabelText('Ville', {}, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: 'Ré-géocoder' }));

    expect(await screen.findByText('Le ré-géocodage a échoué.')).toBeInTheDocument();
  });

  it("filtre par type d'affiliation et par type de commercant via les pastilles", async () => {
    getPdvMapMock.mockResolvedValue({
      pdvs: [
        { id: 1, ville: 'Casablanca', typeAffiliation: 'TPE', typeCommercant: 'PERSONNE_MORALE', latitude: 33.5, longitude: -7.6, nomCommercant: 'ACME' },
        { id: 2, ville: 'Casablanca', typeAffiliation: 'E_COMMERCE', typeCommercant: 'PERSONNE_PHYSIQUE', latitude: 33.5, longitude: -7.6, nomCommercant: 'Epicerie' }
      ]
    });

    render(<SupervisorPdvMapPage />);
    await screen.findByLabelText('Ville', {}, { timeout: 3000 });
    expect(totalPdvsCount()).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: /^check\s*TPE$/ }));
    expect(totalPdvsCount()).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: /^check\s*TPE$/ }));
    expect(totalPdvsCount()).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: /^check\s*Personne morale$/ }));
    expect(totalPdvsCount()).toBe('1');
  });

  it('reinitialise les filtres (ville + types) au clic sur Réinitialiser', async () => {
    getPdvMapMock.mockResolvedValue({
      pdvs: [
        { id: 1, ville: 'Casablanca', typeAffiliation: 'TPE', typeCommercant: 'PERSONNE_MORALE', latitude: 33.5, longitude: -7.6 },
        { id: 2, ville: 'Rabat', typeAffiliation: 'E_COMMERCE', typeCommercant: 'PERSONNE_PHYSIQUE', latitude: 34.0, longitude: -6.8 }
      ]
    });

    render(<SupervisorPdvMapPage />);
    const villeSelect = await screen.findByLabelText('Ville', {}, { timeout: 3000 }) as HTMLSelectElement;
    const casablancaOption = Array.from(villeSelect.options).find((o) => o.textContent === 'Casablanca')!;
    fireEvent.change(villeSelect, { target: { value: casablancaOption.value } });
    fireEvent.click(screen.getByRole('button', { name: /^check\s*TPE$/ }));

    fireEvent.click(screen.getByText('Réinitialiser'));

    expect(villeSelect.value).toBe('all');
    expect(totalPdvsCount()).toBe('2');
  });
});
