import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BackofficeDossierDetailPage from './BackofficeDossierDetailPage';

const CommercialDossierDetailPageMock = vi.fn(() => <div data-testid="wrapped" />);

vi.mock('../../../commercial/pages/dossier-detail/CommercialDossierDetailPage', () => ({
  default: (props: unknown) => CommercialDossierDetailPageMock(props)
}));

describe('BackofficeDossierDetailPage', () => {
  it("delegue a CommercialDossierDetailPage avec requestScope 'auto'", () => {
    render(<BackofficeDossierDetailPage />);
    expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    expect(CommercialDossierDetailPageMock).toHaveBeenCalledWith({ requestScope: 'auto' });
  });
});
