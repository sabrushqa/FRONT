import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Register from './Register';

const axiosPostMock = vi.fn();
const axiosIsAxiosErrorMock = vi.fn<(error: unknown) => boolean>(() => false);

vi.mock('axios', () => ({
  default: {
    post: (...args: unknown[]) => axiosPostMock(...args),
    isAxiosError: (error: unknown) => axiosIsAxiosErrorMock(error)
  }
}));

vi.mock('../../core/components/QuartierCombobox', () => ({
  default: () => <div data-testid="quartier-combobox" />
}));

vi.mock('../../core/components/PdvLocationPicker', () => ({
  default: () => <div data-testid="pdv-location-picker" />
}));

function fillStepOne(overrides: Partial<Record<'typeCommercant' | 'typeAffiliation' | 'nom' | 'activite' | 'secteur' | 'telephone', string>> = {}) {
  fireEvent.change(screen.getByLabelText(/Type de commerçant/), { target: { value: overrides.typeCommercant ?? 'PP' } });
  fireEvent.change(screen.getByLabelText(/Type d'affiliation/), { target: { value: overrides.typeAffiliation ?? 'ECommerce' } });
  fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: overrides.nom ?? 'Doe' } });
  fireEvent.change(screen.getByLabelText(/^Activité/), { target: { value: overrides.activite ?? 'Commerce de detail' } });
  fireEvent.change(screen.getByLabelText(/^Secteur/), { target: { value: overrides.secteur ?? 'Alimentation' } });
  fireEvent.change(screen.getByLabelText(/^Téléphone principal/), { target: { value: overrides.telephone ?? '0600000000' } });
}

function reachStepThree() {
  fillStepOne({ typeAffiliation: 'ECommerce' });
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

  fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'John' } });
  fireEvent.change(screen.getByLabelText(/^CIN/), { target: { value: 'AB12345' } });
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'john@doe.com' } });
  fireEvent.change(screen.getByLabelText(/^Adresse/), { target: { value: '12 rue Test' } });
  fireEvent.change(screen.getByLabelText(/^Ville/), { target: { value: 'Casablanca' } });
  fireEvent.change(screen.getByLabelText(/^Service e-commerce/), { target: { value: 'SiteMarchand' } });
  fireEvent.change(screen.getByLabelText(/^URL site marchand/), { target: { value: 'https://boutique.ma' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
}

function docFileInput(label: string): HTMLInputElement {
  const title = screen.getAllByText(label).find((el) => el.className === 'doc-title')!;
  return title.closest('label')!.querySelector('input[type="file"]')!;
}

beforeEach(() => {
  window.sessionStorage.clear();
  axiosPostMock.mockReset();
  axiosIsAxiosErrorMock.mockReset();
  axiosIsAxiosErrorMock.mockReturnValue(false);
});

describe('Register', () => {
  it('affiche la premiere etape avec le bouton Continuer desactive tant que les champs obligatoires manquent', () => {
    render(<Register />);
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  });

  it("change le libelle du champ d'identite selon le type de commercant (personne morale)", () => {
    render(<Register />);
    fireEvent.change(screen.getByLabelText(/Type de commerçant/), { target: { value: 'PM' } });
    expect(screen.getByLabelText(/^Raison sociale/)).toBeInTheDocument();
  });

  it('active le bouton Continuer une fois les champs de la premiere etape remplis et passe a l\'etape 2', () => {
    render(<Register />);
    fillStepOne();

    const continueButton = screen.getByRole('button', { name: 'Continuer' });
    expect(continueButton).not.toBeDisabled();
    fireEvent.click(continueButton);

    expect(screen.getByLabelText(/^E-mail/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Adresse/)).toBeInTheDocument();
  });

  it('renseigne automatiquement la region a partir de la ville selectionnee', () => {
    render(<Register />);
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    fireEvent.change(screen.getByLabelText(/^Ville/), { target: { value: 'Casablanca' } });

    expect(screen.getByLabelText(/^Région/)).toHaveValue('Casablanca-Settat');
  });

  it('propose la nationalite sous forme de liste deroulante', () => {
    render(<Register />);
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    const nationalite = screen.getByLabelText(/^Nationalité/);
    expect(nationalite.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Marocaine' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Française' })).toBeInTheDocument();
  });

  it("n'exige pas de points de vente pour une affiliation e-commerce pure", () => {
    render(<Register />);
    fillStepOne({ typeAffiliation: 'ECommerce' });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.queryByLabelText(/^Nombre de points de vente/)).toBeNull();
  });

  it('exige un nombre de points de vente pour une affiliation TPE', () => {
    render(<Register />);
    fillStepOne({ typeAffiliation: 'TPE' });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByLabelText(/^Nombre de points de vente/)).toBeInTheDocument();
  });

  it('atteint l\'etape 3 (documents) apres avoir rempli les etapes 1 et 2', () => {
    render(<Register />);
    fillStepOne({ typeAffiliation: 'ECommerce' });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/^CIN/), { target: { value: 'AB12345' } });
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'john@doe.com' } });
    fireEvent.change(screen.getByLabelText(/^Adresse/), { target: { value: '12 rue Test' } });
    fireEvent.change(screen.getByLabelText(/^Ville/), { target: { value: 'Casablanca' } });
    fireEvent.change(screen.getByLabelText(/^Service e-commerce/), { target: { value: 'SiteMarchand' } });
    fireEvent.change(screen.getByLabelText(/^URL site marchand/), { target: { value: 'https://boutique.ma' } });

    const continueButton = screen.getByRole('button', { name: 'Continuer' });
    expect(continueButton).not.toBeDisabled();
    fireEvent.click(continueButton);

    expect(screen.getByText('Partie 3 sur 3')).toBeInTheDocument();
    expect(screen.getByText('CIN')).toBeInTheDocument();
    expect(screen.getAllByText('RIB').length).toBeGreaterThan(0);
  });

  it('affiche la liste de documents pour une personne morale a l\'etape 3', () => {
    render(<Register />);
    fireEvent.change(screen.getByLabelText(/Type de commerçant/), { target: { value: 'PM' } });
    fireEvent.change(screen.getByLabelText(/Type d'affiliation/), { target: { value: 'ECommerce' } });
    fireEvent.change(screen.getByLabelText(/^Raison sociale/), { target: { value: 'ACME SARL' } });
    fireEvent.change(screen.getByLabelText(/^Activité/), { target: { value: 'Commerce de detail' } });
    fireEvent.change(screen.getByLabelText(/^Secteur/), { target: { value: 'Alimentation' } });
    fireEvent.change(screen.getByLabelText(/^Téléphone principal/), { target: { value: '0600000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    fireEvent.change(screen.getByLabelText(/^RC/), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText(/^ICE/), { target: { value: '001122334455667' } });
    fireEvent.change(screen.getByLabelText(/^Forme juridique/), { target: { value: 'SARL' } });
    fireEvent.change(screen.getByLabelText(/^Représentant légal/), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'contact@acme.ma' } });
    fireEvent.change(screen.getByLabelText(/^Adresse/), { target: { value: '12 rue Test' } });
    fireEvent.change(screen.getByLabelText(/^Ville/), { target: { value: 'Casablanca' } });
    fireEvent.change(screen.getByLabelText(/^Service e-commerce/), { target: { value: 'SiteMarchand' } });
    fireEvent.change(screen.getByLabelText(/^URL site marchand/), { target: { value: 'https://boutique.ma' } });

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByText('Statuts')).toBeInTheDocument();
    expect(screen.getByText('PV de nomination')).toBeInTheDocument();
  });
});

describe('Register - etape 3 (documents, RIB et soumission)', () => {
  it('conserve un document non-image sans verification automatique (statut "Non vérifié")', async () => {
    render(<Register />);
    reachStepThree();

    const file = new File(['contenu'], 'cin.pdf', { type: 'application/pdf' });
    fireEvent.change(docFileInput('CIN'), { target: { files: [file] } });

    expect(await screen.findByText('Non vérifié')).toBeInTheDocument();
    expect(screen.getByText('cin.pdf')).toBeInTheDocument();
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it('rejette un fichier depassant la taille limite et affiche le message d\'erreur', async () => {
    render(<Register />);
    reachStepThree();

    const oversized = new File([new Uint8Array(11 * 1024 * 1024)], 'gros-fichier.pdf', { type: 'application/pdf' });
    fireEvent.change(docFileInput('CIN'), { target: { files: [oversized] } });

    expect(await screen.findByText(/dépasse la limite autorisée de 10 MB/)).toBeInTheDocument();
    expect(screen.queryByText('gros-fichier.pdf')).toBeNull();
  });

  it('valide automatiquement une image via l\'API et extrait le RIB depuis l\'IBAN', async () => {
    axiosPostMock.mockResolvedValue({
      data: { status: 'VALID', ribExtraction: { iban: 'MA64011519000001205000534921' } }
    });

    render(<Register />);
    reachStepThree();

    const image = new File(['img'], 'rib.png', { type: 'image/png' });
    fireEvent.change(docFileInput('RIB'), { target: { files: [image] } });

    await waitFor(() => expect(screen.getAllByText('Valide').length).toBeGreaterThan(0));
    expect(axiosPostMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/affiliations/documents/validate'),
      expect.any(FormData),
      expect.objectContaining({ signal: expect.anything() })
    );
    await waitFor(() => expect(document.getElementById('register-rib')).toHaveValue('011519000001205000534921'));
  });

  it('conserve la piece sans blocage si la verification automatique echoue (erreur reseau)', async () => {
    axiosPostMock.mockRejectedValue(new Error('network down'));

    render(<Register />);
    reachStepThree();

    const image = new File(['img'], 'cin.png', { type: 'image/png' });
    fireEvent.change(docFileInput('CIN'), { target: { files: [image] } });

    expect(await screen.findByText('Impossible de vérifier automatiquement cette pièce. La pièce reste jointe sans blocage.')).toBeInTheDocument();
  });

  it('soumet la demande, affiche le message de succes et reinitialise le formulaire', async () => {
    axiosPostMock.mockImplementation((url: string) => {
      if (url.includes('/documents/validate')) {
        return Promise.resolve({ data: { status: 'SKIPPED' } });
      }
      return Promise.resolve({
        data: { message: 'Demande enregistrée.', dossierId: 42, documentsCount: 2 }
      });
    });

    render(<Register />);
    reachStepThree();

    fireEvent.change(docFileInput('CIN'), { target: { files: [new File(['a'], 'cin.pdf', { type: 'application/pdf' })] } });
    fireEvent.change(docFileInput('RIB'), { target: { files: [new File(['b'], 'rib.pdf', { type: 'application/pdf' })] } });
    await screen.findByText('cin.pdf');
    await screen.findByText('rib.pdf');

    fireEvent.change(document.getElementById('register-rib')!, { target: { value: '011519000001205000534921' } });
    fireEvent.click(screen.getByRole('checkbox'));

    const submitButton = screen.getByRole('button', { name: 'Finaliser la demande' });
    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    expect(await screen.findByText(/Demande enregistrée\..*Dossier #42 créé avec 2 document\(s\)/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem('authSuccessMessage')).toContain('contactera prochainement');
    expect(screen.getByText('Partie 1 sur 3')).toBeInTheDocument();
  });

  it("affiche le message d'erreur du serveur si la soumission echoue", async () => {
    axiosIsAxiosErrorMock.mockReturnValue(true);
    axiosPostMock.mockImplementation((url: string) => {
      if (url.includes('/documents/validate')) {
        return Promise.resolve({ data: { status: 'SKIPPED' } });
      }
      return Promise.reject({ response: { data: { message: 'Email déjà utilisé.' } } });
    });

    render(<Register />);
    reachStepThree();

    fireEvent.change(docFileInput('CIN'), { target: { files: [new File(['a'], 'cin.pdf', { type: 'application/pdf' })] } });
    fireEvent.change(docFileInput('RIB'), { target: { files: [new File(['b'], 'rib.pdf', { type: 'application/pdf' })] } });
    await screen.findByText('cin.pdf');
    await screen.findByText('rib.pdf');

    fireEvent.change(document.getElementById('register-rib')!, { target: { value: '011519000001205000534921' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Finaliser la demande' }));

    expect(await screen.findByText(/Votre demande n'est pas enregistrée\. Email déjà utilisé\./)).toBeInTheDocument();
  });
});
