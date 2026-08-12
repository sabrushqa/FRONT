import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PdvLocationPicker from './PdvLocationPicker';

type ClickHandler = (event: { latlng: { lat: number; lng: number } }) => void;

let capturedClickHandler: ClickHandler | null = null;
const flyToMock = vi.fn();

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({ center }: { center: [number, number] }) => (
    <div data-testid="circle-marker" data-lat={center[0]} data-lon={center[1]} />
  ),
  useMap: () => ({ flyTo: flyToMock }),
  useMapEvent: (_event: string, handler: ClickHandler) => {
    capturedClickHandler = handler;
    return null;
  }
}));

beforeEach(() => {
  capturedClickHandler = null;
  flyToMock.mockReset();
});

describe('PdvLocationPicker', () => {
  it("affiche l'indice de clic tant qu'aucun point n'est place", () => {
    render(<PdvLocationPicker ville="Casablanca" latitude={null} longitude={null} onChange={vi.fn()} />);
    expect(screen.getByText(/Cliquez sur la carte/)).toBeInTheDocument();
    expect(screen.queryByTestId('circle-marker')).toBeNull();
  });

  it('affiche les coordonnees formatees et le marqueur quand un point est place', () => {
    render(<PdvLocationPicker ville="Casablanca" latitude={33.5731} longitude={-7.5898} onChange={vi.fn()} />);
    expect(screen.getByText('33.57310, -7.58980')).toBeInTheDocument();
    expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
  });

  it('appelle onChange avec les coordonnees du clic sur la carte', () => {
    const onChange = vi.fn();
    render(<PdvLocationPicker ville="Casablanca" latitude={null} longitude={null} onChange={onChange} />);

    expect(capturedClickHandler).not.toBeNull();
    capturedClickHandler!({ latlng: { lat: 34.02, lng: -6.83 } });

    expect(onChange).toHaveBeenCalledWith(34.02, -6.83);
  });

  it("n'appelle pas onChange si le picker est desactive", () => {
    const onChange = vi.fn();
    render(<PdvLocationPicker ville="Casablanca" latitude={null} longitude={null} disabled onChange={onChange} />);

    capturedClickHandler!({ latlng: { lat: 34.02, lng: -6.83 } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
