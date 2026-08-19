import ExcelJS from 'exceljs';
import { triggerBlobDownload } from './browserDownload';

// Génération de fichiers .xlsx cote client, a partir de donnees deja
// chargees dans le navigateur (transactions, reclamations...) — pas besoin
// d'aller-retour serveur, l'utilisateur exporte exactement ce qu'il voit
// filtre a l'ecran. exceljs plutot que le paquet npm "xlsx" (SheetJS) :
// celui-ci n'a pas ete mis a jour sur le registre npm depuis 2023 et porte
// deux CVE high (prototype pollution GHSA-4r6h-8v6p-xvw6, ReDoS
// GHSA-5pgg-2g8v-p4x9) non corrigees sur les versions publiees — exceljs
// est activement maintenu et ne souffre pas de ces failles.
export interface ExcelColumn<T> {
  header: string;
  key: string;
  width?: number;
  value: (row: T) => string | number | null;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function downloadExcel<T>(
  fileName: string,
  sheetName: string,
  columns: ExcelColumn<T>[],
  rows: T[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, c.value(row)])));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  await triggerBlobDownload(blob, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
