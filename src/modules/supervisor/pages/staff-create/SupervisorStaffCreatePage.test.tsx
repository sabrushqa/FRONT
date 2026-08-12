import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupervisorStaffCreatePage from './SupervisorStaffCreatePage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const createBackOfficeMock = vi.fn();
const createCommercialeMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  createBackOffice: (...args: unknown[]) => createBackOfficeMock(...args),
  createCommerciale: (...args: unknown[]) => createCommercialeMock(...args)
}));

function renderPage(staffType: 'backOffice' | 'commerciale' = 'backOffice') {
  return render(
    <MemoryRouter>
      <SupervisorStaffCreatePage staffType={staffType} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  createBackOfficeMock.mockReset();
  createCommercialeMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('SupervisorStaffCreatePage', () => {
  it("refuse l'acces pour un role non superviseur", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();
    expect(screen.getByText('Accès indisponible')).toBeInTheDocument();
  });

  it('cree un back office avec toutes les permissions par defaut', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    createBackOfficeMock.mockResolvedValue({ message: 'Back office créé avec succès.' });

    renderPage('backOffice');
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'j@d.com' } });
    fireEvent.change(screen.getByLabelText('Matricule'), { target: { value: 'M1' } });
    fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'Support' } });
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));

    expect(await screen.findByText('Back office créé avec succès.')).toBeInTheDocument();
    expect(createBackOfficeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Doe', prenom: 'John', email: 'j@d.com', matricule: 'M1', service: 'Support',
        peutValiderDossiers: true, peutAffecterTpe: true, peutGererReclamations: true
      })
    );
  });

  it('cree un commercial avec le formulaire commerciale', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    createCommercialeMock.mockResolvedValue({ message: 'Commercial créé avec succès.' });

    renderPage('commerciale');
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Alaoui' } });
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Amine' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@lc.ma' } });
    fireEvent.change(screen.getByLabelText('Matricule'), { target: { value: 'M2' } });
    fireEvent.change(screen.getByLabelText('Région'), { target: { value: 'Casablanca-Settat' } });
    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '0600000000' } });
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));

    expect(await screen.findByText('Commercial créé avec succès.')).toBeInTheDocument();
    expect(createCommercialeMock).toHaveBeenCalledWith({
      nom: 'Alaoui', prenom: 'Amine', email: 'a@lc.ma', matricule: 'M2', region: 'Casablanca-Settat', telephone: '0600000000'
    });
  });

  it("affiche une erreur si la creation echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    createBackOfficeMock.mockRejectedValue({ response: { data: { message: 'E-mail déjà utilisé' } } });

    renderPage('backOffice');
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));

    expect(await screen.findByText('E-mail déjà utilisé')).toBeInTheDocument();
  });
});
