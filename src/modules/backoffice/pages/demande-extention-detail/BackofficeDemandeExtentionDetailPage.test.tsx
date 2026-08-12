import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BackofficeDemandeExtentionDetailPage from './BackofficeDemandeExtentionDetailPage';

const CommercialDossierDetailPageMock = vi.fn(() => <div data-testid="wrapped" />);

vi.mock('../../../commercial/pages/dossier-detail/CommercialDossierDetailPage', () => ({
  default: (props: unknown) => CommercialDossierDetailPageMock(props)
}));

describe('BackofficeDemandeExtentionDetailPage', () => {
  it("delegue a CommercialDossierDetailPage avec requestScope 'new-pdv'", () => {
    render(<BackofficeDemandeExtentionDetailPage />);
    expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    expect(CommercialDossierDetailPageMock).toHaveBeenCalledWith({ requestScope: 'new-pdv' });
  });
});
