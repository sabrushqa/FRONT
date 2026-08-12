import { describe, it, expect, afterEach } from 'vitest';
import { resolveBackendApiUrl } from './apiUrl';

type LanaCashWindow = Window & { __LANACASH_CONFIG__?: Record<string, string> };

afterEach(() => {
  delete (window as LanaCashWindow).__LANACASH_CONFIG__;
});

describe('resolveBackendApiUrl (sans config, hote localhost:3000 par defaut de jsdom)', () => {
  it('cible 127.0.0.1:8000 en http quand aucune config n\'est fournie', () => {
    expect(resolveBackendApiUrl('/api/foo')).toBe('http://127.0.0.1:8000/api/foo');
  });
});

describe('resolveBackendApiUrl (avec __LANACASH_CONFIG__.apiBaseUrl)', () => {
  it('utilise le proxy local en dev quand le port du navigateur differe de 8000/8443', () => {
    (window as LanaCashWindow).__LANACASH_CONFIG__ = { apiBaseUrl: 'https://prod.example.com/api/v1' };
    expect(resolveBackendApiUrl('/dossiers')).toBe('http://localhost:8000/api/v1/dossiers');
  });

  it('deduplique le prefixe commun entre la base et le chemin demande', () => {
    (window as LanaCashWindow).__LANACASH_CONFIG__ = { apiBaseUrl: 'https://prod.example.com/api' };
    expect(resolveBackendApiUrl('/api/dossiers')).toBe('http://localhost:8000/api/dossiers');
  });

  it('fonctionne avec une base relative sans schema', () => {
    (window as LanaCashWindow).__LANACASH_CONFIG__ = { apiBaseUrl: '/api' };
    expect(resolveBackendApiUrl('/dossiers')).toBe('http://localhost:8000/api/dossiers');
  });

  it('ignore une config vide (chaine blanche)', () => {
    (window as LanaCashWindow).__LANACASH_CONFIG__ = { apiBaseUrl: '   ' };
    expect(resolveBackendApiUrl('/api/foo')).toBe('http://127.0.0.1:8000/api/foo');
  });
});
