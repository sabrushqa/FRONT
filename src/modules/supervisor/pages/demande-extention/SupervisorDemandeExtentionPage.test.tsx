import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupervisorDemandeExtentionPage from './SupervisorDemandeExtentionPage';

const CommercialDossiersPageMock = vi.fn((_props: unknown) => <div>CommercialDossiersPage mock</div>);

vi.mock('../../../commercial/pages/dossiers/CommercialDossiersPage', () => ({
  default: (props: unknown) => CommercialDossiersPageMock(props)
}));

describe('SupervisorDemandeExtentionPage', () => {
  it('rend CommercialDossiersPage avec requestScope="new-pdv" (reutilise la meme page, filtree aux extensions)', () => {
    render(<SupervisorDemandeExtentionPage />);

    expect(screen.getByText('CommercialDossiersPage mock')).toBeInTheDocument();
    expect(CommercialDossiersPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestScope: 'new-pdv' })
    );
  });
});
