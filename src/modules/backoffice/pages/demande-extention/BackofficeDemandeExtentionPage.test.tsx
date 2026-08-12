import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BackofficeDemandeExtentionPage from './BackofficeDemandeExtentionPage';

const CommercialDossiersPageMock = vi.fn(() => <div data-testid="wrapped" />);

vi.mock('../../../commercial/pages/dossiers/CommercialDossiersPage', () => ({
  default: (props: unknown) => CommercialDossiersPageMock(props)
}));

describe('BackofficeDemandeExtentionPage', () => {
  it("delegue a CommercialDossiersPage avec requestScope 'new-pdv'", () => {
    render(<BackofficeDemandeExtentionPage />);
    expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    expect(CommercialDossiersPageMock).toHaveBeenCalledWith({ requestScope: 'new-pdv' });
  });
});
