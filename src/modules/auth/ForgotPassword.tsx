import React, { useState } from 'react';
import { requestPasswordReset } from './services/authApi';
import './ForgotPassword.scss';

interface ForgotPasswordProps {
  onBackToLogin?: () => void;
}

export default function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [deliveryHint, setDeliveryHint] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || emailSent) return;

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset({ email: email.trim() });
      setDeliveryHint(res.deliveryHint ?? '');
      setExpiresAt(res.expiresAt ?? '');
      setSuccessMessage(res.message || 'E-mail de réinitialisation envoyé.');
      setEmailSent(true);
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } } };
      setErrorMessage(e?.response?.data?.message || "Impossible d'envoyer l'e-mail. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetFlow() {
    setEmail('');
    setEmailSent(false);
    setDeliveryHint('');
    setExpiresAt('');
    setSuccessMessage('');
    setErrorMessage('');
  }

  return (
    <div className="auth-panel">
      {successMessage && (
        <div className="success-alert" role="alert" aria-live="polite">
          {successMessage}
        </div>
      )}

      <form
        className={`forgot-form${errorMessage ? ' has-error' : ''}`}
        noValidate
        onSubmit={handleFormSubmit}
      >
        <div className="fields">
          <div className="field">
            <label htmlFor="forgot-email">E-mail</label>
            <div className="input-wrap">
              <svg
                className="ico"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                id="forgot-email"
                name="forgotEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Entrez votre adresse e-mail"
                autoComplete="email"
                disabled={isSubmitting || emailSent}
              />
            </div>
          </div>

          {emailSent && (
            <div className="reset-panel">
              <p className="reset-hint">
                E-mail envoyé vers{' '}
                <strong>{deliveryHint || 'votre adresse e-mail'}</strong>.
              </p>
              <p className="reset-hint">
                Ouvrez le message reçu et suivez le lien pour définir un nouveau mot de passe via Keycloak.
              </p>
              {expiresAt && (
                <p className="reset-expiry">
                  Lien valable jusqu'à :{' '}
                  {new Intl.DateTimeFormat('fr-MA', { timeStyle: 'short' }).format(
                    new Date(expiresAt)
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="error-alert form-error-alert" role="alert" aria-live="assertive">
            {errorMessage}
          </div>
        )}

        <button className="forgot-btn" type="submit" disabled={isSubmitting || emailSent}>
          {isSubmitting
            ? "Envoi de l'e-mail en cours..."
            : emailSent
              ? 'E-mail envoyé'
              : "Envoyer l'e-mail de réinitialisation"}
        </button>

        {emailSent && (
          <button
            className="secondary-btn"
            type="button"
            disabled={isSubmitting}
            onClick={resetFlow}
          >
            Renvoyer à une autre adresse
          </button>
        )}

        {emailSent && (
          <button
            className="secondary-btn"
            type="button"
            disabled={isSubmitting}
            onClick={() => onBackToLogin?.()}
          >
            Retour à la connexion
          </button>
        )}
      </form>
    </div>
  );
}
