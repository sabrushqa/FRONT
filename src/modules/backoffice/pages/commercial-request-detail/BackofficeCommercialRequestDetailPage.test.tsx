import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BackofficeCommercialRequestDetailPage from './BackofficeCommercialRequestDetailPage';

const CommercialDossierDetailPageMock = vi.fn((_props: unknown) => <div data-testid="wrapped" />);

vi.mock('../../../commercial/pages/dossier-detail/CommercialDossierDetailPage', () => ({
  default: (props: unknown) => CommercialDossierDetailPageMock(props)
}));

describe('BackofficeCommercialRequestDetailPage', () => {
  it("delegue a CommercialDossierDetailPage avec requestScope 'commercial'", () => {
    render(<BackofficeCommercialRequestDetailPage />);
    expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    expect(CommercialDossierDetailPageMock).toHaveBeenCalledWith({ requestScope: 'commercial' });
  });
});
