import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import ActivateAccount from './ActivateAccount';
import Register from './Register';
import './AuthShell.scss';

type AuthMode = 'login' | 'register' | 'forgot' | 'activate';

interface AuthShellProps {
  mode: AuthMode;
}

export default function AuthShell({ mode: initialMode }: AuthShellProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('app-theme');
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  function showLogin() {
    setMode('login');
    navigate('/login', { replace: true });
  }

  function showRegister() {
    setMode('register');
    navigate('/register', { replace: true });
  }

  function showForgotPassword() {
    setMode('forgot');
    navigate('/forgot-password', { replace: true });
  }

  function showActivateAccount() {
    setMode('activate');
    navigate('/activate-account', { replace: true });
  }

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }

  const isRegister = mode === 'register';
  const isActivate = mode === 'activate';
  const isForgot = mode === 'forgot';

  const topState =
    mode === 'login'
      ? 'Connexion'
      : mode === 'register'
        ? 'Inscription'
        : mode === 'forgot'
          ? 'Mot de passe'
          : 'Activation';

  const footerNote =
    mode === 'login'
      ? 'Connexion sécurisée via Keycloak (PKCE S256) — Lana Cash Portail Affiliation'
      : 'Espace sécurisé — Lana Cash Portail Affiliation';

  return (
    <section className="login-page">
      <div
        className={`auth-frame${isRegister ? ' is-register' : ''}${isActivate ? ' is-activate' : ''}${isForgot ? ' is-forgot' : ''}`}
      >
        <section className="form-panel">
          {(mode === 'login' || mode === 'activate' || mode === 'forgot') && (
            <Link className="login-logo-link" to="/login" aria-label="Lana Cash">
              <img src="/logo.png" alt="Lana Cash" />
            </Link>
          )}

          {mode !== 'register' && mode !== 'activate' && mode !== 'forgot' && (
            <div className="panel-top">
              <div>
                <span className="top-badge">Authentification</span>
                <br />
                <span className="top-state">{topState}</span>
              </div>
              <button
                className="theme-toggle-btn"
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          )}

          <div
            className={`login-card${isRegister ? ' is-register' : ''}${isActivate ? ' is-activate' : ''}${isForgot ? ' is-forgot' : ''}`}
          >
            {!isActivate && !isForgot && <div className="card-bar"></div>}

            <div className="card-body">
              <div
                className={`forms-stage${isRegister ? ' is-register' : ''}${isForgot ? ' is-forgot' : ''}${isActivate ? ' is-activate' : ''}`}
              >
                {mode === 'login' && (
                  <Login
                    onSwitchMode={showRegister}
                    onForgotPassword={showForgotPassword}
                    onActivateAccount={showActivateAccount}
                  />
                )}
                {mode === 'register' && (
                  <Register onBackToLogin={showLogin} />
                )}
                {mode === 'forgot' && (
                  <ForgotPassword onBackToLogin={showLogin} />
                )}
                {mode === 'activate' && (
                  <ActivateAccount onBackToLogin={showLogin} />
                )}
              </div>
            </div>

            {mode !== 'register' && mode !== 'activate' && mode !== 'forgot' && (
              <div className="card-footer">
                <svg
                  className="trust-ico"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>{footerNote}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="auth-footer">
        <Link className="footer-logo-link" to="/login" aria-label="Retour à la page de connexion Lana Cash">
          <img className="footer-logo" src="/logo.png" alt="" aria-hidden="true" />
        </Link>
        <span>2026</span>
      </footer>
    </section>
  );
}
