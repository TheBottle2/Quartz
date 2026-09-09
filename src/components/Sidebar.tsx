import React, { useState, useEffect, useMemo } from 'react';
import { Calendar } from './Calendar';
import { confirmDialog } from '../api';
import type { TFunc } from '../i18n';

interface SidebarProps {
  files: string[];
  activeFile: string | null;
  onFileSelect: (file: string) => void;
  onDeleteFile: (file: string) => void;
  onNewNote: () => void;
  currentCalendarMonth: Date;
  onCalendarMonthChange: (date: Date) => void;
  onOpenDailyNote: (date: Date) => void;
  noteDates: Set<string>;
  t: TFunc;
  locale: string;
  showCalendar: boolean;
}

export function Sidebar({
  files, activeFile, onFileSelect, onDeleteFile, onNewNote,
  currentCalendarMonth, onCalendarMonthChange, onOpenDailyNote, noteDates, t, locale, showCalendar,
}: SidebarProps) {
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(() => localStorage.getItem('calendarCollapsed') === 'true');
  useEffect(() => { localStorage.setItem('calendarCollapsed', String(isCalendarCollapsed)); }, [isCalendarCollapsed]);

  const handleDeleteFile = async (e: React.MouseEvent, file: string) => {
    e.stopPropagation();
    const ok = await confirmDialog(t('deleteFileConfirm', { name: file.replace(/\.md$/, '') }));
    if (ok) onDeleteFile(file);
  };

  const sortedFiles = useMemo(() => [...files].sort((a, b) => a.localeCompare(b)), [files]);

  return (
    <aside className="sidebar" role="navigation" aria-label="File explorer">
      <header className="sidebar-header">
        <span className="sidebar-title">{t('files')}</span>
      </header>
      <div className="file-list" role="listbox" aria-label="Markdown files">
        {sortedFiles.length === 0 ? (
          <div className="empty-state" style={{ padding: '16px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-text">{t('noNotesYet')}</div>
          </div>
        ) : (
          sortedFiles.map((file) => (
            <div
              key={file}
              className={`file-item ${activeFile === file ? 'active' : ''}`}
              role="option"
              aria-selected={activeFile === file}
              onClick={() => onFileSelect(file)}
              title={file}
            >
              <span className="file-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span className="file-name">{file.replace(/\.md$/, '')}</span>
              {activeFile === file && (
                <button
                  className="btn icon-only"
                  style={{ opacity: 0.6, padding: 4 }}
                  onClick={(e) => handleDeleteFile(e, file)}
                  aria-label={t('deleteFile')}
                  title={t('deleteFile')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>
      {showCalendar && (
        <div className="calendar-section">
          <button
            className="calendar-header-btn"
            onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
            aria-expanded={!isCalendarCollapsed}
            aria-controls="calendar-panel"
            title={isCalendarCollapsed ? t('showCalendar') : t('hideCalendar')}
          >
            <span className="calendar-title">{t('calendar')}</span>
            <svg className={`chevron-icon ${isCalendarCollapsed ? 'collapsed' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div id="calendar-panel" className={`calendar-content ${isCalendarCollapsed ? 'hidden' : ''}`}>
            <Calendar
              currentMonth={currentCalendarMonth}
              onMonthChange={onCalendarMonthChange}
              onDayClick={onOpenDailyNote}
              noteDates={noteDates}
              t={t}
              locale={locale}
            />
          </div>
        </div>
      )}
      <div className="sidebar-new-note">
        <button className="btn primary" onClick={onNewNote} style={{ width: '100%', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span style={{ marginLeft: 8 }}>{t('scNewNote')}</span>
        </button>
      </div>
    </aside>
  );
}