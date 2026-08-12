import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore, normalizeUserSessionResponse } from '../../store/sessionStore';
import { currentSessionWithToken } from './services/authApi';
import {
  getKeycloakToken,
  getKeycloakRefreshToken,
  getKeycloakTokenExpiresAt,
  keycloakLoginWithRedirect
} from '../../core/keycloak';
import './Login.scss';

interface LoginProps {
  onSwitchMode?: () => void;
  onForgotPassword?: () => void;
  onActivateAccount?: () => void;
}

export default function Login({ onSwitchMode, onForgotPassword, onActivateAccount }: LoginProps) {
  const navigate = useNavigate();
  const { setSession, resolveDashboardRoute } = useSessionStore();

  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Consume success message from session storage
    const msg = window.sessionStorage.getItem('authSuccessMessage') ?? '';
    if (msg) {
      setSuccessMessage(msg);
      window.sessionStorage.removeItem('authSuccessMessage');
    }
    // Complete Keycloak redirect login
    completeKeycloakRedirectLogin();
  }, []);

  async function completeKeycloakRedirectLogin() {
    // Silent SSO check on mount: do NOT disable the form here. The login fields
    // and links must stay usable while we check (in the background) whether the
    // user is returning from a Keycloak redirect. We only enter the "submitting"
    // state once we actually have a token to exchange for a session.
    let accessToken = '';
    try {
      accessToken = await getKeycloakToken();
    } catch {
      // initKeycloak resolves to false on failure (never throws), so reaching
      // here is rare; treat as Keycloak truly unreachable.
      setErrorMessage('Keycloak est inaccessible. Vérifiez que le serveur est démarré.');
      return;
    }
    if (!accessToken) {
      // No active SSO session yet: keep the form clean and usable so the user
      // can sign in manually. Do NOT show an error.
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await currentSessionWithToken(accessToken);
      const normalized = normalizeUserSessionResponse({
        ...response,
        accessToken,
        refreshToken: getKeycloakRefreshToken() || null,
        tokenType: 'Bearer',
        tokenExpiresAt: getKeycloakTokenExpiresAt()
      });
      setSuccessMessage(normalized.message || 'Connexion réussie.');
      setSession(normalized);
      setIsSubmitting(false);
      navigate(resolveDashboardRoute(normalized));
    } catch {
      // The cached Keycloak token is stale/invalid (e.g. /me returned 401).
      // Stay on the login form silently so the user can re-authenticate; the
      // 401 interceptor already cleared the local session.
      setIsSubmitting(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitCredentials();
  }

  function submitCredentials() {
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    keycloakLoginWithRedirect(email.trim()).catch(() => {
      setErrorMessage('Redirection vers Keycloak impossible. Vérifiez que Keycloak est accessible.');
      setIsSubmitting(false);
    });
  }

  return (
    <div className="auth-panel">
      <div className="step-chip">Étape 1 sur 2</div>
      <h1 className="card-title">Connexion</h1>
      <p className="card-sub">Accédez à votre espace affilié</p>

      {successMessage && (
        <div className="success-alert" role="alert" aria-live="polite">
          {successMessage}
        </div>
      )}

      <form
        className={`login-form${errorMessage ? ' has-error' : ''}`}
        noValidate
        onSubmit={handleFormSubmit}
      >
        <div className="fields">
          <div className="field">
            <label htmlFor="login-email">E-mail</label>
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
                id="login-email"
                name="loginEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Entrez votre adresse e-mail"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <div className="form-options">
          <label className="remember-row" htmlFor="rememberMe">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isSubmitting}
            />
            <span>Se souvenir de moi</span>
          </label>
          <button
            type="button"
            className="text-link"
            disabled={isSubmitting}
            onClick={() => onForgotPassword?.()}
          >
            Mot de passe oublié ?
          </button>
        </div>

        <div className="help-actions">
          <button
            type="button"
            className="text-link"
            disabled={isSubmitting}
            onClick={() => onActivateAccount?.()}
          >
            Activer mon compte
          </button>
        </div>

        {errorMessage && (
          <div className="error-alert form-error-alert" role="alert" aria-live="assertive">
            <span className="error-text">{errorMessage}</span>
          </div>
        )}

        <button className="login-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Redirection Keycloak...' : 'Se connecter avec Keycloak'}
        </button>
      </form>

      <div className="alt-row">
        <span>Vous n'avez pas encore de compte ?</span>
        <button
          className="inline-link"
          type="button"
          disabled={isSubmitting}
          onClick={() => onSwitchMode?.()}
        >
          Devenir client
        </button>
      </div>
    </div>
  );
}
