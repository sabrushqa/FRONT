import React from 'react';
import { Link } from 'react-router-dom';
import { useSessionStore } from '../../../../store/sessionStore';
import { formatEnumLabel } from '../../../supervisor/services/supervisorUiUtils';
import '../../../../styles/commercial-profile.scss';

export default function CommercialProfilePage() {
  const { session } = useSessionStore();

  const isCommercial = session?.role === 'COMMERCIAL';
  const isActive = !!session?.active;

  const dossiersRoute = isCommercial ? '/commercial/dossiers' : '/supervisor/affiliation-requests';

  const displayName = session?.nom || session?.email || 'Commercial';
  const roleLabel = formatEnumLabel(session?.role);
  const statusLabel = isActive ? 'Actif' : 'Inactif';

  const userInitials = (() => {
    const source = session?.nom || session?.email || 'Commercial';
    const cleaned = source.trim();
    if (!cleaned) return 'CO';
    const parts = cleaned.split(/[\s@.]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  })();

  const profileRows = [
    { label: 'Nom complet', value: session?.nom || '-', icon: 'person' },
    { label: 'Adresse e-mail', value: session?.email || '-', icon: 'mail' },
    { label: 'Rôle', value: roleLabel, icon: 'badge' },
    { label: 'État du compte', value: statusLabel, icon: isActive ? 'check_circle' : 'cancel', tone: isActive ? 'success' : 'danger' as 'success' | 'danger' },
  ];

  return (
    <div className="cp-page">

      {/* HEADER */}
      <div className="cp-header">
        <div className="cp-avatar">{userInitials}</div>
        <div className="cp-header-info">
          <h1>{displayName}</h1>
          <p>{session?.email}</p>
          <div className="cp-badges">
            <span className="cp-badge cp-badge-role">{roleLabel}</span>
            <span className={`cp-badge ${isActive ? 'cp-badge-active' : 'cp-badge-inactive'}`}>
              <span className={`cp-dot ${isActive ? 'cp-dot-active' : 'cp-dot-inactive'}`} />
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="cp-body">

        {/* IDENTITY CARD */}
        <div className="cp-card">
          <div className="cp-card-title">
            <span className="material-icons cp-card-icon">person</span>{' '}
            Identité
          </div>
          <div className="cp-fields">
            {profileRows.map((row) => (
              <div key={row.label} className="cp-field">
                <span className="material-icons cp-field-icon">{row.icon}</span>
                <div className="cp-field-content">
                  <span className="cp-field-label">{row.label}</span>
                  <span className={`cp-field-value${row.tone ? ` cp-field-value--${row.tone}` : ''}`}>
                    {row.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ACTIONS CARD */}
        <div className="cp-card">
          <div className="cp-card-title">
            <span className="material-icons cp-card-icon">flash_on</span>{' '}
            Actions rapides
          </div>
          <div className="cp-actions">
            <Link className="cp-action" to={dossiersRoute}>
              <span className="material-icons cp-action-icon">folder_open</span>
              <div className="cp-action-content">
                <strong>Mes dossiers</strong>
                <span>Gérer vos affiliations en cours</span>
              </div>
              <span className="material-icons cp-action-arrow">chevron_right</span>
            </Link>
            <Link className="cp-action" to="/forgot-password">
              <span className="material-icons cp-action-icon">lock_reset</span>
              <div className="cp-action-content">
                <strong>Réinitialiser le mot de passe</strong>
                <span>Lancer le parcours de récupération</span>
              </div>
              <span className="material-icons cp-action-arrow">chevron_right</span>
            </Link>
          </div>
          <div className="cp-note">
            <span className="material-icons">info</span>{' '}
            Les modifications sensibles passent par les parcours sécurisés du portail.
          </div>
        </div>

      </div>
    </div>
  );
}
