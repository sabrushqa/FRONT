import { describe, it, expect, vi, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { downloadExcel, ExcelColumn } from './excelExport';

interface Row {
  nom: string;
  montant: number;
}

const COLUMNS: ExcelColumn<Row>[] = [
  { header: 'Nom', key: 'nom', value: (r) => r.nom },
  { header: 'Montant', key: 'montant', value: (r) => r.montant }
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('downloadExcel', () => {
  it('genere un classeur xlsx exploitable avec les bonnes colonnes et lignes', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let capturedHref = '';
    let capturedDownload = '';
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'href', {
          set(value: string) { capturedHref = value; },
          get() { return capturedHref; }
        });
        Object.defineProperty(el, 'download', {
          set(value: string) { capturedDownload = value; },
          get() { return capturedDownload; }
        });
      }
      return el;
    });

    const rows: Row[] = [
      { nom: 'Alpha', montant: 100 },
      { nom: 'Beta', montant: 250 }
    ];

    await downloadExcel('export-test', 'Feuille1', COLUMNS, rows);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(capturedDownload).toBe('export-test.xlsx');
    expect(capturedHref).toMatch(/^data:/);

    // Decode la data: URL et relit le classeur genere pour verifier son contenu reel.
    const base64 = capturedHref.split(',')[1];
    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);

    const sheet = workbook.getWorksheet('Feuille1');
    expect(sheet).toBeDefined();
    expect(sheet!.getRow(1).getCell(1).value).toBe('Nom');
    expect(sheet!.getRow(1).getCell(2).value).toBe('Montant');
    expect(sheet!.getRow(2).getCell(1).value).toBe('Alpha');
    expect(sheet!.getRow(2).getCell(2).value).toBe(100);
    expect(sheet!.getRow(3).getCell(1).value).toBe('Beta');
    expect(sheet!.getRow(3).getCell(2).value).toBe(250);
  });

  it('ajoute automatiquement le suffixe .xlsx si absent, et ne le double pas si deja present', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let capturedDownload = '';
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'download', {
          set(value: string) { capturedDownload = value; },
          get() { return capturedDownload; }
        });
      }
      return el;
    });

    await downloadExcel('deja-suffixe.xlsx', 'Feuille1', COLUMNS, []);
    expect(capturedDownload).toBe('deja-suffixe.xlsx');
  });

  it("n'ajoute aucune ligne quand rows est vide, seulement l'en-tete", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let capturedHref = '';
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'href', {
          set(value: string) { capturedHref = value; },
          get() { return capturedHref; }
        });
      }
      return el;
    });

    await downloadExcel('vide', 'Feuille1', COLUMNS, []);

    const base64 = capturedHref.split(',')[1];
    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet('Feuille1');
    expect(sheet!.rowCount).toBe(1);
  });
});
