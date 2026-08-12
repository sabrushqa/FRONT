import React from 'react';
import { useSessionStore, useEffectiveAffiliationType } from '../../../../store/sessionStore';
import '../../../../styles/commercant-pdvs.scss';

function statusTone(status: string): string {
  const s = (status ?? '').toUpperCase();
  if (s === 'ACTIF')   return 'tone-active';
  if (s === 'INACTIF') return 'tone-danger';
  return 'tone-pending';
}

export default function CommercantPdvsPage() {
  const { session } = useSessionStore();
  const pdvs = session?.pdvs ?? [];
  const isSousCommercant = session?.role === 'SOUS_COMMERCANT';
  const isEcommerce = useEffectiveAffiliationType() === 'E_COMMERCE';

  return (
    <div className="co-page">
      <div className="co-page-head">
        <div>
          <span className="co-page-kicker">Implantations</span>
          <h2>{isSousCommercant ? 'Infos PDV' : 'Points de vente'}</h2>
          <p>{isSousCommercant ? 'Informations du point de vente qui vous est affecté' : 'Vue détaillée de vos implantations'}</p>
        </div>
        <span className="co-badge">{pdvs.length} PDV</span>
      </div>

      {isEcommerce ? (
        <div className="co-empty">
          <span className="material-icons">language</span>
          <p>Cette section ne s'applique pas aux comptes e-commerce. Consultez votre site marchand / application dans Vue d'ensemble.</p>
        </div>
      ) : pdvs.length === 0 ? (
        <div className="co-empty">
          <span className="material-icons">storefront</span>
          <p>Aucun point de vente enregistré.</p>
        </div>
      ) : (
        <div className="pdv-grid">
          {pdvs.map((pdv) => (
            <article key={pdv.id} className="pdv-card">
              <div className="pdv-card-head">
                <div className="pdv-card-identity">
                  <div className="pdv-avatar"><span className="material-icons">storefront</span></div>
                  <div>
                    <strong>{pdv.nom || `PDV #${pdv.id}`}</strong>
                    <span>{pdv.ville || 'Ville non renseignée'}</span>
                  </div>
                </div>
                <span className={`co-status-chip ${statusTone(pdv.statut)}`}>{pdv.statut || 'Inconnu'}</span>
              </div>

              <div className="pdv-detail-grid">
                {[
                  { icon: 'location_on',        label: 'Adresse',       value: pdv.adresse    },
                  { icon: 'phone',              label: 'Téléphone',     value: pdv.telephone  },
                  { icon: 'email',              label: 'E-mail',        value: pdv.email      },
                  { icon: 'markunread_mailbox', label: 'Code postal',   value: pdv.codePostal },
                  { icon: 'calendar_today',     label: 'Date de création', value: pdv.dateCreation }
                ].map((row) => (
                  <div key={row.label} className="pdv-detail-item">
                    <span className="material-icons">{row.icon}</span>
                    <div><label>{row.label}</label><strong>{row.value || '—'}</strong></div>
                  </div>
                ))}
              </div>

              {!isSousCommercant && (
                <div className={`pdv-assignee${!pdv.sousCommercantId ? ' is-empty' : ''}`}>
                  <span className="material-icons">{pdv.sousCommercantId ? 'person_pin' : 'person_off'}</span>
                  <div>
                    <strong>{pdv.sousCommercant || 'Aucun sous-commerçant affecté'}</strong>
                    {pdv.sousCommercantId ? (
                      <span>{pdv.sousCommercantEmail || '—'} · {pdv.sousCommercantActive ? 'Actif' : 'Inactif'}</span>
                    ) : (
                      <span>Disponible pour affectation</span>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
