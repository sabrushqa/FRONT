import React from 'react';
import { useSessionStore, useEffectiveAffiliationType } from '../../../../store/sessionStore';
import { toSafeHttpUrl } from '../../../../core/url';
import '../../../../styles/page.shared.scss';
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

// Le libelle de la famille d'affiliation ("Type d'affiliation" dans le
// profil) doit suivre l'espace actif du portail (bascule Encaissement /
// E-commerce, voir profileSwitcher dans CommercantDashboard.tsx), pas le
// typeAffiliation brut du dossier — sinon un commercant ENCAISSEMENT_ET_
// ECOMMERCE voit toujours "Encaissement" affiche meme en consultant son
// espace e-commerce.
function formatAffiliationFamily(rawTypeAffiliation: string | null | undefined, isEcommerce: boolean): string {
  if (!rawTypeAffiliation) return '—';
  return isEcommerce ? 'E-commerce' : 'Encaissement';
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
  // Suit le profil actif (bascule ENCAISSEMENT / E-COMMERCE) pour les
  // commerçants a affiliation combinee, sinon le type reel du dossier.
  const isEcommerce = useEffectiveAffiliationType() === 'E_COMMERCE';
  const hasCombinedAffiliation = session?.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE';
  // session.summary.totalTransactions est un total BACKEND, calcule une seule
  // fois pour toute la session (il ne connait pas l'espace actif du portail) :
  // pour un commercant combine, il mélangeait toujours transactions TPE et
  // e-commerce quel que soit l'espace consulte. Meme filtre par canal que
  // CommercantTransactionsPage.tsx/CommercantOverviewPage.tsx pour n'afficher
  // que les transactions du canal actif.
  const totalTransactionsForActiveProfile = hasCombinedAffiliation
    ? (session?.transactions ?? []).filter(
        (t) => (t.canal ?? '').toUpperCase() === (isEcommerce ? 'ECOMMERCE' : 'TPE')
      ).length
    : session?.summary?.totalTransactions ?? 0;

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
              <span className="field-value highlight">{formatAffiliationFamily(profile?.typeAffiliation, isEcommerce)}</span>
            </div>
            {isEcommerce && (
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
            {session.donneesTransactionnellesIndisponibles && (
              <div className="page-alert warning">
                Le service switch-monetique-service était injoignable — les
                chiffres ci-dessous peuvent être incomplets (sous-estimés).
                Rechargez la page une fois le service revenu.
              </div>
            )}
            <div className="profile-stats-row">
              <div className="stat-block">
                <strong>{totalTransactionsForActiveProfile}</strong>
                <span>Transactions</span>
              </div>
              {!isEcommerce && (
                <>
                  <div className="stat-block">
                    <strong>{session.summary.totalPdvs}</strong>
                    <span>Points de vente</span>
                  </div>
                  <div className="stat-block">
                    <strong>{session.summary.totalTpes}</strong>
                    <span>Terminaux TPE</span>
                  </div>
                  {/* Sous-commercants n'existe que pour le canal encaissement
                      (TPE) — cf. CommercantSubCommercantsPage.tsx. */}
                  <div className="stat-block">
                    <strong>{session.summary.totalSousCommercants}</strong>
                    <span>Sous-commerçants</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
