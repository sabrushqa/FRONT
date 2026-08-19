import { describe, it, expect, vi, afterEach } from 'vitest';
import { triggerBlobDownload, openBlobInNewTab } from './browserDownload';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('triggerBlobDownload', () => {
  it('cree un lien de telechargement avec le bon nom de fichier puis le retire du DOM', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const blob = new Blob(['contenu'], { type: 'text/plain' });

    await triggerBlobDownload(blob, 'rapport.txt');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('a[download]').length).toBe(0);
  });
});

describe('triggerBlobDownload — erreur de lecture', () => {
  it('rejette avec un vrai Error (pas le DOMException|null brut de FileReader) — Sonar S6671', async () => {
    class FailingFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      error = { message: 'boom' } as DOMException;
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    const OriginalFileReader = globalThis.FileReader;
    // @ts-expect-error - substitution volontaire pour le test
    globalThis.FileReader = FailingFileReader;

    try {
      const blob = new Blob(['contenu'], { type: 'text/plain' });
      await expect(triggerBlobDownload(blob, 'rapport.txt')).rejects.toBeInstanceOf(Error);
      await expect(triggerBlobDownload(blob, 'rapport.txt')).rejects.toThrow('boom');
    } finally {
      globalThis.FileReader = OriginalFileReader;
    }
  });
});

describe('openBlobInNewTab', () => {
  it('assigne une data: URL a la location de l\'onglet fourni', async () => {
    const fakeTab = { location: { href: '' } } as unknown as Window;
    const blob = new Blob(['contenu'], { type: 'application/pdf' });

    await openBlobInNewTab(blob, fakeTab);

    expect(fakeTab.location.href).toMatch(/^data:/);
  });

  it("ne fait rien si l'onglet fourni est null", async () => {
    const blob = new Blob(['contenu'], { type: 'application/pdf' });
    await expect(openBlobInNewTab(blob, null)).resolves.toBeUndefined();
  });
});
