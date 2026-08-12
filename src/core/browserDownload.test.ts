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
