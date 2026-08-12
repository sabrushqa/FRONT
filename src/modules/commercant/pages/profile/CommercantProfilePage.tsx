import React from 'react';
import { useSessionStore } from '../../../../store/sessionStore';
import { toSafeHttpUrl } from '../../../../core/url';
import '../../../../styles/commercant-profile.scss';

function formatEnum(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace('Personne Physique', 'Personne physique')
    .replace('Personne Morale', 'Personne morale')
    .replace('Auto Entrepreneur', 'Auto-entrepreneur')
    .replace('Association Fondation', 'Association / Fondation');
}

function formatAffiliationFamily(value: string | null | undefined): string {
  if (!value) return '—';
  return value.toUpperCase() === 'E_COMMERCE' ? 'E-commerce' : 'Encaissement';
}

export default function CommercantProfilePage() {
  const { session } = useSessionStore();
  const profile = session?.profile;
  const isSousCommercant = session?.role === 'SOUS_COMMERCANT';

  const initials = (profile?.nom ?? session?.nom ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

  const isActive = session?.active;

  return (
    <div className="profile-page">

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="profile-hero-card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar-circle">{initials}</div>
          <div className="profile-hero-meta">
            <h1 className="profile-hero-name">{profile?.nom || session?.nom || '—'}</h1>
            <p className="profile-hero-email">{profile?.email || session?.email || '—'}</p>
            <div className="profile-hero-badges">
              <span className={`profile-badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
                {isActive ? 'Compte actif' : 'Compte inactif'}
              </span>
              {isSousCommercant && (
                <span className="profile-badge badge-role">Sous-commerçant</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-body">

        {/* ── Informations personnelles ─────────────── */}
        <div className="profile-card">
          <div className="profile-card-header">
            <h2>Informations personnelles</h2>
          </div>
          <div className="profile-fields">
            <div className="profile-field">
              <span className="field-label">Nom complet</span>
              <span className="field-value">{profile?.nom || '—'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Adresse e-mail</span>
              <span className="field-value">{profile?.email || '—'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Téléphone</span>
              <span className="field-value">{profile?.telephone || '—'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Ville</span>
              <span className="field-value">{profile?.ville || '—'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Région</span>
              <span className="field-value">{profile?.region || '—'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Activité</span>
              <span className="field-value">{profile?.activite || '—'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Type de commerçant</span>
              <span className="field-value">{formatEnum(profile?.typeCommercant)}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Type d'affiliation</span>
              <span className="field-value highlight">{formatAffiliationFamily(profile?.typeAffiliation)}</span>
            </div>
            {profile?.typeAffiliation?.toUpperCase() === 'E_COMMERCE' && (
              <>
                {profile?.siteMarchandUrl && (
                  <div className="profile-field">
                    <span className="field-label">Site marchand</span>
                    <span className="field-value">
                      {toSafeHttpUrl(profile.siteMarchandUrl) ? (
                        <a href={profile.siteMarchandUrl} target="_blank" rel="noopener noreferrer">
                          {profile.siteMarchandUrl}
                        </a>
                      ) : (
                        profile.siteMarchandUrl
                      )}
                    </span>
                  </div>
                )}
                {profile?.applicationMobile && (
                  <div className="profile-field">
                    <span className="field-label">Application mobile</span>
                    <span className="field-value">{profile.applicationMobile}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Dossier ──────────────────────────────── */}
        <div className="profile-card">
          <div className="profile-card-header">
            <h2>Dossier d'affiliation</h2>
          </div>
          <div className="profile-fields">
            <div className="profile-field">
              <span className="field-label">Statut du dossier</span>
              <span className="field-value">{formatEnum(session?.dossierStatus)}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Rôle</span>
              <span className="field-value">{formatEnum(session?.role)}</span>
            </div>
          </div>
        </div>

        {/* ── Activité ─────────────────────────────── */}
        {session?.summary && !isSousCommercant && (
          <div className="profile-card profile-card-stats">
            <div className="profile-card-header">
              <h2>Résumé d'activité</h2>
            </div>
            <div className="profile-stats-row">
              <div className="stat-block">
                <strong>{session.summary.totalTransactions}</strong>
                <span>Transactions</span>
              </div>
              <div className="stat-block">
                <strong>{session.summary.totalPdvs}</strong>
                <span>Points de vente</span>
              </div>
              <div className="stat-block">
                <strong>{session.summary.totalTpes}</strong>
                <span>Terminaux TPE</span>
              </div>
              <div className="stat-block">
                <strong>{session.summary.totalSousCommercants}</strong>
                <span>Sous-commerçants</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
