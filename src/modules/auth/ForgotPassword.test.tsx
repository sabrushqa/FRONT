import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPassword from './ForgotPassword';

const requestPasswordResetMock = vi.fn();

vi.mock('./services/authApi', () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordResetMock(...args)
}));

beforeEach(() => {
  requestPasswordResetMock.mockReset();
});

describe('ForgotPassword', () => {
  it("envoie l'email et affiche la confirmation", async () => {
    requestPasswordResetMock.mockResolvedValue({
      message: 'E-mail envoyé avec succès',
      deliveryHint: 'u***@exemple.com',
      expiresAt: ''
    });

    render(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@exemple.com' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer l'e-mail/i }));

    expect(await screen.findByText('E-mail envoyé avec succès')).toBeInTheDocument();
    expect(requestPasswordResetMock).toHaveBeenCalledWith({ email: 'user@exemple.com' });
    expect(screen.getByText(/u\*\*\*@exemple\.com/)).toBeInTheDocument();
  });

  it("affiche une erreur si l'envoi echoue", async () => {
    requestPasswordResetMock.mockRejectedValue({ response: { data: { message: 'Adresse introuvable' } } });

    render(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'inconnu@exemple.com' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer l'e-mail/i }));

    expect(await screen.findByText('Adresse introuvable')).toBeInTheDocument();
  });

  it('permet de recommencer avec une autre adresse apres envoi', async () => {
    requestPasswordResetMock.mockResolvedValue({ message: 'ok', deliveryHint: '', expiresAt: '' });

    render(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@exemple.com' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer l'e-mail/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /renvoyer à une autre adresse/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /renvoyer à une autre adresse/i }));

    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: /envoyer l'e-mail/i })).toBeInTheDocument();
  });

  it('appelle onBackToLogin quand on clique sur retour a la connexion', async () => {
    requestPasswordResetMock.mockResolvedValue({ message: 'ok', deliveryHint: '', expiresAt: '' });
    const onBackToLogin = vi.fn();

    render(<ForgotPassword onBackToLogin={onBackToLogin} />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@exemple.com' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer l'e-mail/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /retour à la connexion/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /retour à la connexion/i }));
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});
