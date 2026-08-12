import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../../../store/sessionStore';
import { createBackOffice, createCommerciale } from '../../services/supervisorApi';
import { isSupervisorRole } from '../../../workspace/workspaceUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-staff-create.scss';

const MOROCCAN_REGIONS = [
  'Tanger-Tétouan-Al Hoceima',
  'Oriental',
  'Fès-Meknès',
  'Rabat-Salé-Kénitra',
  'Béni Mellal-Khénifra',
  'Casablanca-Settat',
  'Marrakech-Safi',
  'Drâa-Tafilalet',
  'Souss-Massa',
  'Guelmim-Oued Noun',
  'Laâyoune-Sakia El Hamra',
  'Dakhla-Oued Ed-Dahab'
];

interface SupervisorStaffCreatePageProps {
  staffType?: 'backOffice' | 'commerciale';
}

export default function SupervisorStaffCreatePage({ staffType = 'backOffice' }: SupervisorStaffCreatePageProps) {
  const navigate = useNavigate();
  const { session } = useSessionStore();

  const isCommercialeForm = staffType === 'commerciale';
  const canManageStaff = isSupervisorRole(session?.role);

  const pageTitle = isCommercialeForm ? 'Créer un commercial' : 'Créer un back office';
  const pageDescription = isCommercialeForm
    ? 'Ajoutez un compte commercial depuis un formulaire séparé du reste du dashboard.'
    : 'Préparez un compte back office et envoyez son e-mail d\'activation.';
  const backRoute = isCommercialeForm ? '/supervisor/commercial' : '/supervisor/back-offices';

  const [backOfficeForm, setBackOfficeForm] = useState({
    nom: '', prenom: '', email: '', matricule: '', service: ''
  });
  const [commercialeForm, setCommercialeForm] = useState({ nom: '', prenom: '', email: '', matricule: '', region: '', telephone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      if (isCommercialeForm) {
        const res = await createCommerciale(commercialeForm);
        setSuccessMessage(res.message || 'Commercial créé avec succès.');
        setCommercialeForm({ nom: '', prenom: '', email: '', matricule: '', region: '', telephone: '' });
      } else {
        const res = await createBackOffice({
          nom: backOfficeForm.nom,
          prenom: backOfficeForm.prenom,
          email: backOfficeForm.email,
          matricule: backOfficeForm.matricule,
          service: backOfficeForm.service,
          // Tout compte back office cree a desormais acces a toutes les actions
          // (traitement des dossiers, affectation TPE, gestion des reclamations).
          peutValiderDossiers: true,
          peutAffecterTpe: true,
          peutGererReclamations: true
        });
        setSuccessMessage(res.message || 'Back office créé avec succès.');
        setBackOfficeForm({
          nom: '', prenom: '', email: '', matricule: '', service: ''
        });
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMessage(e?.response?.data?.message || 'Création impossible. Vérifiez les informations.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canManageStaff) {
    return (
      <div className="page-grid">
        <div className="access-card">
          <strong>Accès indisponible</strong>
          <span>Seul le superviseur peut créer des comptes internes.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <div className="page-card">
        <div className="page-head">
          <div>
            <span className="page-kicker">{isCommercialeForm ? 'Ajout commercial' : 'Ajout back office'}</span>
            <h2>{pageTitle}</h2>
            <p className="page-description">{pageDescription}</p>
          </div>
          <button className="btn-secondary" type="button" onClick={() => navigate(backRoute)}>
            Retour à la liste
          </button>
        </div>

        {successMessage && (
          <div className="page-alert success" role="status">{successMessage}</div>
        )}
        {errorMessage && (
          <div className="page-alert error" role="alert">{errorMessage}</div>
        )}

        <form noValidate onSubmit={submit}>
          {!isCommercialeForm && (
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="boNom">Nom</label>
                <input
                  id="boNom" name="boNom" type="text" className="form-input"
                  value={backOfficeForm.nom}
                  onChange={(e) => setBackOfficeForm((f) => ({ ...f, nom: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="boPrenom">Prénom</label>
                <input
                  id="boPrenom" name="boPrenom" type="text" className="form-input"
                  value={backOfficeForm.prenom}
                  onChange={(e) => setBackOfficeForm((f) => ({ ...f, prenom: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="boEmail">E-mail</label>
                <input
                  id="boEmail" name="boEmail" type="email" className="form-input"
                  value={backOfficeForm.email}
                  onChange={(e) => setBackOfficeForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="boMatricule">Matricule</label>
                <input
                  id="boMatricule" name="boMatricule" type="text" className="form-input"
                  value={backOfficeForm.matricule}
                  onChange={(e) => setBackOfficeForm((f) => ({ ...f, matricule: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group field-full">
                <label htmlFor="boService">Service</label>
                <input
                  id="boService" name="boService" type="text" className="form-input"
                  value={backOfficeForm.service}
                  onChange={(e) => setBackOfficeForm((f) => ({ ...f, service: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {isCommercialeForm && (
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="commercialNom">Nom</label>
                <input
                  id="commercialNom" name="commercialNom" type="text" className="form-input"
                  value={commercialeForm.nom}
                  onChange={(e) => setCommercialeForm((f) => ({ ...f, nom: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="commercialPrenom">Prénom</label>
                <input
                  id="commercialPrenom" name="commercialPrenom" type="text" className="form-input"
                  value={commercialeForm.prenom}
                  onChange={(e) => setCommercialeForm((f) => ({ ...f, prenom: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="commercialEmail">E-mail</label>
                <input
                  id="commercialEmail" name="commercialEmail" type="email" className="form-input"
                  value={commercialeForm.email}
                  onChange={(e) => setCommercialeForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="commercialMatricule">Matricule</label>
                <input
                  id="commercialMatricule" name="commercialMatricule" type="text" className="form-input"
                  value={commercialeForm.matricule}
                  onChange={(e) => setCommercialeForm((f) => ({ ...f, matricule: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="commercialRegion">Région</label>
                <select
                  id="commercialRegion" name="commercialRegion" className="form-select"
                  value={commercialeForm.region}
                  onChange={(e) => setCommercialeForm((f) => ({ ...f, region: e.target.value }))}
                  disabled={isSubmitting}
                >
                  <option value="">Sélectionner une région</option>
                  {MOROCCAN_REGIONS.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="commercialTelephone">Téléphone</label>
                <input
                  id="commercialTelephone" name="commercialTelephone" type="tel" className="form-input"
                  value={commercialeForm.telephone}
                  onChange={(e) => setCommercialeForm((f) => ({ ...f, telephone: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Création en cours...' : 'Créer le compte'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => navigate(backRoute)}
              disabled={isSubmitting}
            >
              Revenir à la liste
            </button>
          </div>
        </form>
      </div>

      <div className="info-card">
        <div className="page-head">
          <h3>Ce que fait cet écran</h3>
        </div>
        <div className="info-list">
          <span>Le formulaire est séparé du dashboard principal pour éviter un écran trop chargé.</span>
          <span>Le collaborateur reçoit un e-mail d'activation pour définir son mot de passe.</span>
          <span>Le drawer reste accessible pour revenir rapidement aux autres pages du workspace.</span>
        </div>
      </div>
    </div>
  );
}
