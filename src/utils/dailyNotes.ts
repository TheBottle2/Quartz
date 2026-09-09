import { formatDateKey } from './date';

export function getDailyNotePath(folder: string, date: Date): string {
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
  return `${normalizedFolder}/${formatDateKey(date)}.md`;
}

export function getDailyNoteTemplate(date: Date): string {
  const dateStr = formatDateKey(date);
  return `# ${dateStr}\n\n## 📝 Günlük Notlar\n\n`;
}

export function extractDailyNoteDates(files: string[], folder: string): Set<string> {
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
  const prefix = `${normalizedFolder}/`;
  const dates = new Set<string>();
  
  for (const file of files) {
    if (file.startsWith(prefix) && file.endsWith('.md')) {
      const datePart = file.slice(prefix.length, -3);
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        dates.add(datePart);
      }
    }
  }
  
  return dates;
}