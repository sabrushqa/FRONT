import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Register from './Register';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    isAxiosError: () => false
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

beforeEach(() => {
  window.sessionStorage.clear();
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
