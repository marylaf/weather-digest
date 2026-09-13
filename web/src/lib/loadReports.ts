import type { ReportSource } from '../types';

const reportModules = import.meta.glob('../../../reports/*.json', { import: 'default' });

function fileLabel(modulePath: string): string {
  const fileName = modulePath.split('/').pop() ?? modulePath;
  return decodeURIComponent(fileName.replace(/\.json$/u, ''));
}

export function listSavedReports(): ReportSource[] {
  return Object.entries(reportModules)
    .map(([modulePath, load]) => ({
      id: modulePath,
      label: fileLabel(modulePath),
      load,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'ru'));
}
