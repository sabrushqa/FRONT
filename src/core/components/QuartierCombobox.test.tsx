import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuartierCombobox from './QuartierCombobox';

function ControlledCombobox({
  ville,
  initialValue = '',
  onSelect
}: {
  ville: string;
  initialValue?: string;
  onSelect?: (entry: { quartier: string; codePostal: string }) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return <QuartierCombobox id="q1" value={value} ville={ville} onChange={setValue} onSelect={onSelect} />;
}

describe('QuartierCombobox', () => {
  it('affiche un placeholder "Optionnel" si la ville ne propose aucun quartier connu', () => {
    render(<ControlledCombobox ville="Ville Inconnue XYZ" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Optionnel');
  });

  it('affiche des suggestions filtrees en tapant une recherche', () => {
    render(<ControlledCombobox ville="CASABLANCA" />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'SIDI' } });

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('selectionne une suggestion au clic et met a jour la valeur', () => {
    const onSelect = vi.fn();
    render(<ControlledCombobox ville="CASABLANCA" onSelect={onSelect} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'DERB' } });
    const options = screen.getAllByRole('option');
    fireEvent.mouseDown(options[0]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('combobox') as HTMLInputElement).value).not.toBe('DERB');
  });

  it('navigue les suggestions avec les fleches et valide avec Entree', () => {
    const onSelect = vi.fn();
    render(<ControlledCombobox ville="CASABLANCA" onSelect={onSelect} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'DERB' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('affiche un asterisque quand le champ est obligatoire (optional=false)', () => {
    render(<QuartierCombobox id="q1" value="" ville="CASABLANCA" onChange={vi.fn()} optional={false} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it("affiche un message d'erreur quand invalid est vrai", () => {
    render(<QuartierCombobox id="q1" value="" ville="CASABLANCA" onChange={vi.fn()} invalid />);
    expect(screen.getByText('Ce champ est obligatoire.')).toBeInTheDocument();
  });
});
