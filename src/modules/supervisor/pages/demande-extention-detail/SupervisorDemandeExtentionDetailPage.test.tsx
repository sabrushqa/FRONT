import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupervisorDemandeExtentionDetailPage from './SupervisorDemandeExtentionDetailPage';

const CommercialDossierDetailPageMock = vi.fn((_props: unknown) => <div>CommercialDossierDetailPage mock</div>);

vi.mock('../../../commercial/pages/dossier-detail/CommercialDossierDetailPage', () => ({
  default: (props: unknown) => CommercialDossierDetailPageMock(props)
}));

describe('SupervisorDemandeExtentionDetailPage', () => {
  it('rend CommercialDossierDetailPage avec requestScope="new-pdv" (reutilise la meme page, filtree aux extensions)', () => {
    render(<SupervisorDemandeExtentionDetailPage />);

    expect(screen.getByText('CommercialDossierDetailPage mock')).toBeInTheDocument();
    expect(CommercialDossierDetailPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestScope: 'new-pdv' })
    );
  });
});
