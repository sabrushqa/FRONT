import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activate } from './services/authApi';
import { normalizeUserSessionResponse, useSessionStore } from '../../store/sessionStore';
import './ActivateAccount.scss';

interface ActivateAccountProps {
  onBackToLogin?: () => void;
}

export default function ActivateAccount({ onBackToLogin }: ActivateAccountProps) {
  const navigate = useNavigate();
  const { setSession, resolveDashboardRoute } = useSessionStore();

  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await activate({ email: email.trim(), temporaryPassword, newPassword });
      if ('utilisateurId' in res) {
        const normalized = normalizeUserSessionResponse(res as Parameters<typeof normalizeUserSessionResponse>[0]);
        setSuccessMessage(normalized.message || 'Compte activé avec succès.');
        setSession(normalized);
        window.sessionStorage.setItem('authSuccessMessage', normalized.message || 'Compte activé avec succès.');
        navigate(resolveDashboardRoute(normalized));
      } else {
        setSuccessMessage(res.message || 'Compte activé. Vous pouvez vous connecter.');
        window.sessionStorage.setItem('authSuccessMessage', res.message || 'Compte activé.');
        onBackToLogin?.();
      }
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } } };
      setErrorMessage(e?.response?.data?.message || "Activation impossible. Vérifiez vos informations.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-panel">
      {successMessage && (
        <div className="success-alert" role="alert" aria-live="polite">
          {successMessage}
        </div>
      )}

      <form
        className={`activate-form${errorMessage ? ' has-error' : ''}`}
        noValidate
        onSubmit={handleFormSubmit}
      >
        <div className="fields">
          <div className="field">
            <label htmlFor="activation-email">E-mail</label>
            <input
              id="activation-email"
              name="activationEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
              placeholder="Entrez votre adresse e-mail"
            />
          </div>

          <div className="field">
            <label htmlFor="activation-temp-password">Mot de passe temporaire</label>
            <input
              id="activation-temp-password"
              name="temporaryPassword"
              type="text"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="one-time-code"
              placeholder="Mot de passe reçu par e-mail"
            />
          </div>

          <div className="field">
            <label htmlFor="activation-new-password">Nouveau mot de passe</label>
            <input
              id="activation-new-password"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
              placeholder="Choisissez un nouveau mot de passe"
            />
          </div>

          <div className="field">
            <label htmlFor="activation-confirm-password">Confirmer le mot de passe</label>
            <input
              id="activation-confirm-password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
              placeholder="Confirmez le nouveau mot de passe"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="error-alert form-error-alert" role="alert" aria-live="assertive">
            {errorMessage}
          </div>
        )}

        <button className="activate-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Activation en cours...' : 'Activer mon compte'}
        </button>
      </form>
    </div>
  );
}
