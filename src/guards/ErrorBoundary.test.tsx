import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

// Type de retour explicite : sans lui, TS infere `() => void` (pas `never`)
// pour une fonction qui ne fait que lever une erreur, et refuse de la
// laisser servir de composant JSX.
function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('affiche les enfants quand il n\'y a pas d\'erreur', () => {
    render(
      <ErrorBoundary>
        <p>contenu normal</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('contenu normal')).toBeInTheDocument();
  });

  it('affiche le fallback par défaut quand un enfant lève une erreur', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText(/une erreur est survenue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recharger la page/i })).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('affiche un fallback personnalisé si fourni', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<p>oups custom</p>}>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('oups custom')).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
