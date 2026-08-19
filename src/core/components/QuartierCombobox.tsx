import React, { useMemo, useRef, useState } from 'react';
import { getQuartiersForVille, type QuartierEntry } from '../quartiersMaroc';
import './QuartierCombobox.scss';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

const MAX_SUGGESTIONS = 8;

function rankMatches(entries: QuartierEntry[], query: string): QuartierEntry[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const scored: Array<{ entry: QuartierEntry; score: number }> = [];
  for (const entry of entries) {
    const normalizedQuartier = normalize(entry.quartier);
    if (normalizedQuartier === normalizedQuery) {
      scored.push({ entry, score: 0 });
    } else if (normalizedQuartier.startsWith(normalizedQuery)) {
      scored.push({ entry, score: 1 });
    } else if (normalizedQuartier.includes(` ${normalizedQuery}`)) {
      scored.push({ entry, score: 2 });
    } else if (normalizedQuartier.includes(normalizedQuery)) {
      scored.push({ entry, score: 3 });
    }
  }
  scored.sort((a, b) => a.score - b.score || a.entry.quartier.length - b.entry.quartier.length);
  return scored.slice(0, MAX_SUGGESTIONS).map((item) => item.entry);
}

export default function QuartierCombobox({
  id,
  label = 'Quartier',
  value,
  ville,
  invalid = false,
  optional = true,
  disabled = false,
  variant = 'field',
  onChange,
  onSelect,
  onBlur
}: {
  id: string;
  label?: string;
  value: string;
  ville: string;
  invalid?: boolean;
  optional?: boolean;
  disabled?: boolean;
  variant?: 'field' | 'co-field';
  onChange: (value: string) => void;
  onSelect?: (entry: QuartierEntry) => void;
  onBlur?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const blurTimeoutRef = useRef<number | null>(null);

  const entries = useMemo(() => getQuartiersForVille(ville), [ville]);
  const suggestions = useMemo(() => rankMatches(entries, value), [entries, value]);

  function selectEntry(entry: QuartierEntry) {
    onChange(entry.quartier);
    onSelect?.(entry);
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectEntry(suggestions[highlightedIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }

  function handleBlur() {
    // Let a pending mousedown-triggered selectEntry() run before we close/notify.
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      onBlur?.();
    }, 120);
  }

  function handleFocus() {
    if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
    if (value.trim()) setIsOpen(true);
  }

  const inputEl = (
    <input
      id={id}
      type="text"
      role="combobox"
      aria-expanded={isOpen}
      aria-controls={`${id}-listbox`}
      aria-autocomplete="list"
      autoComplete="off"
      placeholder={entries.length > 0 ? 'Tapez pour chercher...' : (optional ? 'Optionnel' : label)}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value);
        setHighlightedIndex(0);
        setIsOpen(entries.length > 0 && e.target.value.trim().length > 0);
      }}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );

  const dropdownEl = isOpen && suggestions.length > 0 && (
    // Combobox personnalise avec filtrage en direct et mise en surbrillance
    // (pas juste une liste statique) : un <select>/<datalist> natif ne
    // permet pas ce comportement. Choix architectural assume, pas une
    // regression a corriger a la volee ici. Faux "nouveau" signale par Sonar
    // uniquement parce que la ligne a ete touchee pour ajouter l'id ci-dessus.
    <ul id={`${id}-listbox`} className="quartier-combobox-list" role="listbox"> {/* NOSONAR typescript:S6819 */}
      {suggestions.map((entry, index) => (
        <li
          key={entry.quartier}
          role="option"
          aria-selected={index === highlightedIndex}
          className={index === highlightedIndex ? 'is-highlighted' : ''}
          onMouseDown={(e) => {
            e.preventDefault();
            selectEntry(entry);
          }}
          onMouseEnter={() => setHighlightedIndex(index)}
        >
          <span>{entry.quartier}</span>
          <span className="quartier-combobox-cp">{entry.codePostal}</span>
        </li>
      ))}
    </ul>
  );

  if (variant === 'co-field') {
    return (
      <label className={`co-field quartier-combobox${invalid ? ' is-invalid' : ''}`}>
        <span>
          {label}
          {!optional && ' *'}
        </span>
        <span className="quartier-combobox-anchor">
          {inputEl}
          {dropdownEl}
        </span>
      </label>
    );
  }

  return (
    <div className={`field quartier-combobox${invalid ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>
        {label}
        {!optional && <span className="required-mark">*</span>}
      </label>
      <div className={`input-wrap${invalid ? ' is-invalid' : ''}`}>
        {inputEl}
        {dropdownEl}
      </div>
      {invalid && <p className="field-error">Ce champ est obligatoire.</p>}
    </div>
  );
}
