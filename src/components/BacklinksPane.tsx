import { useEffect, useState } from 'react';
import { getBacklinks, readFile } from '../api';
import type { TFunc } from '../i18n';

interface BacklinksPaneProps {
  currentFile: string | null;
  onFileSelect: (file: string) => void;
  t: TFunc;
}

interface BacklinkWithContext {
  file: string;
  context: string;
}

export function BacklinksPane({ currentFile, onFileSelect, t }: BacklinksPaneProps) {
  const [backlinks, setBacklinks] = useState<BacklinkWithContext[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentFile) {
      setBacklinks([]);
      return;
    }

    const loadBacklinks = async () => {
      setLoading(true);
      try {
        const files = await getBacklinks(currentFile);
        const linksWithContext: BacklinkWithContext[] = [];

        for (const file of files) {
          try {
            const content = await readFile(file);
            const lines = content.split('\n');
            const regex = /\[\[([^\]]+)\]\]/g;
            let context = '';

            for (const line of lines) {
              if (regex.test(line)) {
                context = line.trim().slice(0, 120);
                break;
              }
            }

            linksWithContext.push({ file, context });
          } catch {
            linksWithContext.push({ file, context: '' });
          }
        }

        setBacklinks(linksWithContext);
      } catch (err) {
        console.error('Failed to load backlinks:', err);
        setBacklinks([]);
      } finally {
        setLoading(false);
      }
    };

    loadBacklinks();
  }, [currentFile]);

  if (!currentFile) {
    return (
      <aside className="backlinks-pane" role="complementary" aria-label="Backlinks">
        <header className="backlinks-header">
          <span className="backlinks-title">{t('backlinks')}</span>
        </header>
        <div className="backlinks-list">
          <div className="backlinks-empty">
            {t('noNoteSelected')}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="backlinks-pane" role="complementary" aria-label="Backlinks">
      <header className="backlinks-header">
        <span className="backlinks-title">
          {t('backlinks')}
          <span className="backlinks-count">{backlinks.length}</span>
        </span>
      </header>

      <div className="backlinks-list" role="list" aria-label="Notes linking to current note">
        {loading ? (
          <div className="backlinks-empty">{t('loading')}</div>
        ) : backlinks.length === 0 ? (
          <div className="backlinks-empty">
            {t('noBacklinksYet')}
            <span className="hint">{t('backlinkHint')}</span>
          </div>
        ) : (
          backlinks.map(({ file, context }) => (
            <div
              key={file}
              className="backlink-item"
              role="listitem"
              onClick={() => onFileSelect(file)}
              title={file}
            >
              <div className="backlink-title">{file.replace(/\.md$/, '')}</div>
              {context && (
                <div className="backlink-context">{context}</div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}