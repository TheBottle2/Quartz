import { useEffect } from 'react';
import { CHANGELOG } from '../changelog';
import type { Lang, TFunc } from '../i18n';
import { Icon } from './Icon';

interface WhatsNewModalProps {
  lang: Lang;
  t: TFunc;
  onClose: () => void;
}

export function WhatsNewModal({ lang, t, onClose }: WhatsNewModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content whatsnew-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('whatsNew')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{t('whatsNew')}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('cancel')}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="modal-body whatsnew-body">
          {CHANGELOG.map((entry) => (
            <section key={entry.version} className="whatsnew-entry">
              <div className="whatsnew-entry-head">
                <span className="version-badge">v{entry.version}</span>
                <span className="whatsnew-date">{entry.date}</span>
              </div>
              <ul className="whatsnew-list">
                {entry.items[lang].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn primary" onClick={onClose}>{t('done')}</button>
        </div>
      </div>
    </div>
  );
}

export default WhatsNewModal;
