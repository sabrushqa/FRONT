import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupervisorSecurityPage from './SupervisorSecurityPage';

describe('SupervisorSecurityPage', () => {
  it('affiche la page sans erreur', () => {
    render(<SupervisorSecurityPage />);
    expect(screen.getByText('SupervisorSecurityPage')).toBeInTheDocument();
  });
});
