import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupervisorProfilePage from './SupervisorProfilePage';

describe('SupervisorProfilePage', () => {
  it('affiche la page sans erreur', () => {
    render(<SupervisorProfilePage />);
    expect(screen.getByText('SupervisorProfilePage')).toBeInTheDocument();
  });
});
