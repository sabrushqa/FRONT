import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivateAccount from './ActivateAccount';
import { useSessionStore } from '../../store/sessionStore';

const activateMock = vi.fn();

vi.mock('./services/authApi', () => ({
  activate: (...args: unknown[]) => activateMock(...args)
}));

function renderActivate(props: { onBackToLogin?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <ActivateAccount {...props} />
    </MemoryRouter>
  );
}

function fillForm(overrides: Partial<Record<'email' | 'temp' | 'newPwd' | 'confirmPwd', string>> = {}) {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: overrides.email ?? 'user@exemple.com' } });
  fireEvent.change(screen.getByLabelText('Mot de passe temporaire'), { target: { value: overrides.temp ?? 'temp123' } });
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: overrides.newPwd ?? 'NewPass123' } });
  fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: overrides.confirmPwd ?? 'NewPass123' } });
}

beforeEach(() => {
  activateMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('ActivateAccount', () => {
  it('affiche une erreur si les mots de passe ne correspondent pas, sans appeler l\'API', () => {
    renderActivate();
    fillForm({ confirmPwd: 'AutreChose' });
    fireEvent.click(screen.getByRole('button', { name: /activer mon compte/i }));

    expect(screen.getByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument();
    expect(activateMock).not.toHaveBeenCalled();
  });

  it('cree une session directement si la reponse contient un utilisateurId', async () => {
    activateMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      message: 'Compte active avec succes'
    });

    renderActivate();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /activer mon compte/i }));

    expect(await screen.findByText('Compte active avec succes')).toBeInTheDocument();
    expect(useSessionStore.getState().session?.role).toBe('COMMERCANT');
  });

  it('retourne au login si la reponse ne contient pas de session (juste un message)', async () => {
    activateMock.mockResolvedValue({ message: 'Compte active, connectez-vous' });
    const onBackToLogin = vi.fn();

    renderActivate({ onBackToLogin });
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /activer mon compte/i }));

    await screen.findByText('Compte active, connectez-vous');
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('authSuccessMessage')).toBe('Compte active, connectez-vous');
  });

  it("affiche le message d'erreur renvoye par l'API en cas d'echec", async () => {
    activateMock.mockRejectedValue({ response: { data: { message: 'Mot de passe temporaire invalide' } } });

    renderActivate();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /activer mon compte/i }));

    expect(await screen.findByText('Mot de passe temporaire invalide')).toBeInTheDocument();
  });
});
