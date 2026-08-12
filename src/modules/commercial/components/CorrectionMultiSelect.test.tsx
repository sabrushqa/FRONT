import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CorrectionMultiSelect from './CorrectionMultiSelect';

const MANY_OPTIONS = [
  { value: 'z', label: 'Zebra' },
  { value: 'a', label: 'Antilope' },
  { value: 'm', label: 'Mangouste' },
  { value: 'e', label: 'Éléphant' },
  { value: 'b', label: 'Baleine' },
  { value: 'c', label: 'Chameau' }
];

const FEW_OPTIONS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' }
];

function setup(options = MANY_OPTIONS, values: string[] = []) {
  const onChange = vi.fn();
  render(
    <CorrectionMultiSelect label="Champs concernés" options={options} values={values} onChange={onChange} />
  );
  return { onChange };
}

describe('CorrectionMultiSelect', () => {
  it('trie les options par ordre alphabetique (insensible aux accents)', () => {
    setup();
    fireEvent.click(screen.getByRole('button'));

    const optionLabels = screen.getAllByRole('checkbox').map((checkbox) => checkbox.closest('label')?.textContent);
    expect(optionLabels).toEqual(['Antilope', 'Baleine', 'Chameau', 'Éléphant', 'Mangouste', 'Zebra']);
  });

  it('affiche un champ de recherche pour une longue liste et filtre en tapant', () => {
    setup();
    fireEvent.click(screen.getByRole('button'));

    const search = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(search, { target: { value: 'ele' } });

    // "Éléphant" doit matcher malgre l'accent absent de la recherche.
    expect(screen.getByText('Éléphant')).toBeInTheDocument();
    expect(screen.queryByText('Zebra')).toBeNull();
    expect(screen.queryByText('Antilope')).toBeNull();
  });

  it("affiche un message quand la recherche ne trouve rien", () => {
    setup();
    fireEvent.click(screen.getByRole('button'));

    fireEvent.change(screen.getByPlaceholderText('Rechercher...'), { target: { value: 'xyz-inexistant' } });

    expect(screen.getByText('Aucun résultat.')).toBeInTheDocument();
  });

  it("ne montre pas de champ de recherche pour une petite liste (5 options ou moins)", () => {
    setup(FEW_OPTIONS);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByPlaceholderText('Rechercher...')).toBeNull();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('coche une option filtree au clic', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Rechercher...'), { target: { value: 'baleine' } });

    fireEvent.click(screen.getByText('Baleine'));

    expect(onChange).toHaveBeenCalledWith(['b']);
  });
});
