import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommercantReclamationsPage from './CommercantReclamationsPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const apiPostMock = vi.fn();

// Le chat passe par le client axios partage (`api`) plutot que fetch() brut,
// pour beneficier du rafraichissement automatique du token Keycloak proche
// de l'expiration (voir core/api.ts::ensureFreshToken) — sans ca, un
// commerçant qui reste longtemps sur cette page sans declencher d'autre
// appel voit son token expirer silencieusement et "Chatbot inaccessible."
// s'affiche des le 1er message, meme avec une session par ailleurs valide.
vi.mock('../../../../core/api', () => ({
  default: { get: vi.fn(), post: (...args: unknown[]) => apiPostMock(...args) }
}));

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  apiPostMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CommercantReclamationsPage', () => {
  it("affiche le message d'accueil personnalise avec le nom du commercant", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', nom: 'ACME SARL', profile: { nom: 'ACME SARL' } })
    );
    render(<CommercantReclamationsPage />);
    expect(screen.getByText(/Bonjour ACME SARL/)).toBeInTheDocument();
  });

  it('envoie un message texte au chatbot via le client axios partage (token toujours frais) et affiche la reponse du bot', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', nom: 'ACME SARL', profile: { nom: 'ACME SARL' } })
    );
    apiPostMock.mockResolvedValue({
      data: { message: 'Je note votre probleme, pouvez-vous preciser ?', session_id: 'sess-1' }
    });

    render(<CommercantReclamationsPage />);
    const input = screen.getByPlaceholderText('Décrivez votre problème… (FR · Darija · EN)');
    fireEvent.change(input, { target: { value: 'Mon TPE ne fonctionne plus' } });

    const sendButton = screen.getAllByRole('button').find((b) => b.className.includes('lc-send'))!;
    fireEvent.click(sendButton);

    expect(await screen.findByText('Je note votre probleme, pouvez-vous preciser ?')).toBeInTheDocument();
    expect(apiPostMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/merchant/chatbot/message'),
      expect.objectContaining({ message: 'Mon TPE ne fonctionne plus' })
    );
  });

  it("affiche un message d'erreur si le chatbot est inaccessible", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', nom: 'ACME SARL', profile: { nom: 'ACME SARL' } })
    );
    apiPostMock.mockRejectedValue(new Error('network down'));

    render(<CommercantReclamationsPage />);
    const input = screen.getByPlaceholderText('Décrivez votre problème… (FR · Darija · EN)');
    fireEvent.change(input, { target: { value: 'Probleme TPE' } });
    const sendButton = screen.getAllByRole('button').find((b) => b.className.includes('lc-send'))!;
    fireEvent.click(sendButton);

    expect(await screen.findByText('⚠️ Chatbot inaccessible.')).toBeInTheDocument();
  });

  it("propose un choix de TPE avant le chat quand le commerçant a plusieurs terminaux, et cache le composer tant qu'aucun n'est choisi", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', nom: 'ACME SARL', profile: { nom: 'ACME SARL' },
        pdvs: [{ id: 4, nom: 'PDV1_AEENO', ville: 'Casablanca', adresse: '', telephone: '', statut: 'ACTIF', email: '', codePostal: '', dateCreation: '', sousCommercantId: null, sousCommercant: '', sousCommercantEmail: '', sousCommercantStatut: '', sousCommercantActive: null }],
        tpes: [
          { id: 'TPE-000003', numeroSerie: 'TPE-000003', modele: 'Ingenico', statut: 'ACTIF', typeConnexion: 'GPRS_3G_4G', pdvId: 4, pdv: 'PDV1_AEENO' },
          { id: 'TPE-000004', numeroSerie: 'TPE-000004', modele: 'Verifone', statut: 'ACTIF', typeConnexion: 'ETHERNET', pdvId: 4, pdv: 'PDV1_AEENO' }
        ]
      })
    );

    render(<CommercantReclamationsPage />);

    expect(screen.getByText('Quel TPE est concerné ?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /TPE-000003/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /TPE-000004/ })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Décrivez votre problème… (FR · Darija · EN)')).toBeNull();
  });

  it('debloque le chat et prefill le TPE choisi (avec PDV/ville) une fois selectionne', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', nom: 'ACME SARL', profile: { nom: 'ACME SARL', ville: 'Casablanca' },
        pdvs: [{ id: 4, nom: 'PDV1_AEENO', ville: 'Casablanca', adresse: '', telephone: '', statut: 'ACTIF', email: '', codePostal: '', dateCreation: '', sousCommercantId: null, sousCommercant: '', sousCommercantEmail: '', sousCommercantStatut: '', sousCommercantActive: null }],
        tpes: [
          { id: 'TPE-000003', numeroSerie: 'TPE-000003', modele: 'Ingenico', statut: 'ACTIF', typeConnexion: 'GPRS_3G_4G', pdvId: 4, pdv: 'PDV1_AEENO' }
        ]
      })
    );
    apiPostMock.mockResolvedValue({ data: { session_id: 'sess-1' } });

    render(<CommercantReclamationsPage />);
    fireEvent.click(screen.getByRole('button', { name: /TPE-000003/ }));

    expect(await screen.findByPlaceholderText('Décrivez votre problème… (FR · Darija · EN)')).toBeInTheDocument();
    expect(screen.getAllByText(/Ingenico \(#TPE-000003\)/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('Décrivez votre problème… (FR · Darija · EN)'), {
      target: { value: 'x' }
    });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.className.includes('lc-send'))!);

    await vi.waitFor(() => {
      expect(apiPostMock.mock.calls.some(([url]) => String(url).includes('/session/prefill'))).toBe(true);
    });
    const prefillCall = apiPostMock.mock.calls.find(([url]) => String(url).includes('/session/prefill'));
    const params = prefillCall![2].params as URLSearchParams;
    expect(params.get('tpe_id')).toBe('TPE-000003');
    expect(params.get('pdv_nom')).toBe('PDV1_AEENO');
    expect(params.get('pdv_ville')).toBe('Casablanca');
    expect(params.get('commercant_ville')).toBe('Casablanca');
  });

  it('n\'affiche pas "TPE TPE" quand le modele enregistre est juste le type generique "TPE"', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', nom: 'ACME SARL', profile: { nom: 'ACME SARL' },
        tpes: [
          { id: 'TPE-000003', numeroSerie: 'TPE-000003', modele: 'TPE', statut: 'ACTIF', typeConnexion: 'GPRS_3G_4G', pdvId: null, pdv: '' }
        ]
      })
    );

    render(<CommercantReclamationsPage />);
    fireEvent.click(screen.getByRole('button', { name: /TPE-000003/ }));

    await screen.findAllByText(/TPE #TPE-000003/);
    expect(screen.getAllByText(/TPE #TPE-000003/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/TPE TPE/)).toBeNull();
  });

  it("ne montre pas de picker pour un commerçant sans TPE (e-commerce pur)", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', nom: 'ACME SARL', profile: { nom: 'ACME SARL' }, tpes: [] })
    );

    render(<CommercantReclamationsPage />);

    expect(screen.queryByText('Quel TPE est concerné ?')).toBeNull();
    expect(screen.getByPlaceholderText('Décrivez votre problème… (FR · Darija · EN)')).toBeInTheDocument();
  });

  it('permet de changer de TPE en cours de session', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', nom: 'ACME SARL', profile: { nom: 'ACME SARL' },
        tpes: [
          { id: 'TPE-000003', numeroSerie: 'TPE-000003', modele: 'Ingenico', statut: 'ACTIF', typeConnexion: 'GPRS_3G_4G', pdvId: null, pdv: '' }
        ]
      })
    );

    render(<CommercantReclamationsPage />);
    fireEvent.click(screen.getByRole('button', { name: /TPE-000003/ }));
    expect(screen.getByPlaceholderText('Décrivez votre problème… (FR · Darija · EN)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Changer de TPE'));
    expect(screen.getByText('Quel TPE est concerné ?')).toBeInTheDocument();
  });

  it('ferme la session et revient au choix de TPE quand le commerçant confirme que c\'est réglé', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', nom: 'ACME SARL', profile: { nom: 'ACME SARL' },
        tpes: [
          { id: 'TPE-000003', numeroSerie: 'TPE-000003', modele: 'Ingenico', statut: 'ACTIF', typeConnexion: 'GPRS_3G_4G', pdvId: null, pdv: '' }
        ]
      })
    );
    apiPostMock.mockResolvedValue({
      data: { message: 'De rien, bonne journée !', session_id: 'sess-1', session_closed: true }
    });

    render(<CommercantReclamationsPage />);
    fireEvent.click(screen.getByRole('button', { name: /TPE-000003/ }));

    fireEvent.change(screen.getByPlaceholderText('Décrivez votre problème… (FR · Darija · EN)'), {
      target: { value: 'oui merci' }
    });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.className.includes('lc-send'))!);

    expect(await screen.findByText('De rien, bonne journée !')).toBeInTheDocument();
    expect(screen.getByText(/Session terminée/)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2500);

    expect(screen.getByText('Quel TPE est concerné ?')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
