import { downloadExcel, ExcelColumn } from '../../../../core/excelExport';

// Props prete a spreader sur un <button> : centralise le style/comportement
// du bouton "Exporter en Excel" repete sur chaque carte graphique des pages
// Performance des equipes et Activite & Conversion.
export function exportButtonProps<T>(fileName: string, sheetName: string, columns: ExcelColumn<T>[], rows: T[]) {
  return {
    type: 'button' as const,
    className: 'chart-export-btn',
    onClick: () => { void downloadExcel(fileName, sheetName, columns, rows); },
    title: 'Exporter ce graphique en Excel'
  };
}
