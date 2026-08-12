import React, { useEffect, useMemo, useRef, useState } from 'react';

interface CorrectionMultiSelectProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (values: string[]) => void;
}

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export default function CorrectionMultiSelect({
  label,
  options,
  values,
  disabled = false,
  placeholder = 'Choisir',
  onChange
}: CorrectionMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedLabels = values
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .join(', ');

  // Liste triee par ordre alphabetique, filtrable par recherche : ces menus
  // contiennent parfois beaucoup d'options (champs/documents concernes par
  // une correction) et etaient jusque-la une simple liste brute non triee.
  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [options]
  );
  const visibleOptions = useMemo(() => {
    const query = normalizeForSearch(searchQuery);
    if (!query) return sortedOptions;
    return sortedOptions.filter((option) => normalizeForSearch(option.label).includes(query));
  }, [sortedOptions, searchQuery]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      // Laisse le menu se monter avant de focaliser le champ de recherche.
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  function toggleValue(value: string) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <section className="correction-review-block" ref={wrapperRef}>
      <strong>{label}</strong>
      <div className="correction-multiselect">
        <button
          type="button"
          className="correction-multiselect-trigger"
          disabled={disabled}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span>{selectedLabels || placeholder}</span>
          <span aria-hidden="true">v</span>
        </button>
        {isOpen && !disabled && (
          <div className="correction-multiselect-menu">
            {sortedOptions.length > 5 && (
              <div className="correction-multiselect-search">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Rechercher..."
                  aria-label={`Rechercher dans ${label}`}
                />
              </div>
            )}
            {visibleOptions.length === 0 ? (
              <p className="correction-multiselect-empty">Aucun résultat.</p>
            ) : (
              visibleOptions.map((option) => (
                <label key={option.value} className="correction-multiselect-option">
                  <input
                    type="checkbox"
                    checked={values.includes(option.value)}
                    onChange={() => toggleValue(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
