import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar } from './Calendar';
import { confirmDialog, readFile } from '../api';
import { useDebounce } from '../hooks/useDebounce';
import { findFoldedMatches, foldCase } from '../utils/search';
import { Icon } from './Icon';
import type { TFunc } from '../i18n';

interface SidebarProps {
  files: string[];
  activeFile: string | null;
  activeFileContent: string;
  onFileSelect: (file: string) => void;
  onDeleteFile: (file: string) => void;
  onFileHit: (file: string, start: number, end: number) => void;
  onRenameFile: (oldName: string, newName: string) => void;
  onNewNote: () => void;
  currentCalendarMonth: Date;
  onCalendarMonthChange: (date: Date) => void;
  onOpenDailyNote: (date: Date) => void;
  noteDates: Set<string>;
  t: TFunc;
  locale: string;
  showCalendar: boolean;
}

const folderOf = (f: string) => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '');
const baseOf = (f: string) => (f.includes('/') ? f.slice(f.lastIndexOf('/') + 1) : f);

export function Sidebar({
  files, activeFile, activeFileContent, onFileSelect, onDeleteFile, onFileHit, onRenameFile, onNewNote,
  currentCalendarMonth, onCalendarMonthChange, onOpenDailyNote, noteDates, t, locale, showCalendar,
}: SidebarProps) {
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(() => localStorage.getItem('calendarCollapsed') === 'true');
  useEffect(() => { localStorage.setItem('calendarCollapsed', String(isCalendarCollapsed)); }, [isCalendarCollapsed]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('sidebarCollapsedFolders') || '{}'); }
    catch { return {}; }
  });
  useEffect(() => { localStorage.setItem('sidebarCollapsedFolders', JSON.stringify(collapsed)); }, [collapsed]);
  const toggleFolder = (folder: string) => setCollapsed((c) => ({ ...c, [folder]: !c[folder] }));

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debouncedSetQuery = useDebounce(setDebouncedQuery, 300);

  // İçerik önbelleği: sadece arama yapılırken doldurulur, dosya listesi değişince atılır.
  const cacheRef = useRef<{ files: string[]; map: Map<string, string> }>({ files, map: new Map() });
  if (cacheRef.current.files !== files) cacheRef.current = { files, map: new Map() };
  const [contents, setContents] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) { setContents(new Map()); return; }
    let cancelled = false;
    (async () => {
      const cached = cacheRef.current.map;
      const missing = files.filter((f) => !cached.has(f));
      if (missing.length > 0) {
        const loaded = await Promise.all(missing.map(async (f) => {
          try { return [f, await readFile(f)] as const; }
          catch { return [f, ''] as const; }
        }));
        if (cancelled) return;
        loaded.forEach(([f, text]) => cached.set(f, text));
      }
      if (!cancelled) setContents(new Map(cached));
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery, files]);

  const handleDeleteFile = async (e: React.MouseEvent, file: string) => {
    e.stopPropagation();
    const ok = await confirmDialog(t('deleteFileConfirm', { name: file.replace(/\.md$/, '') }));
    if (ok) onDeleteFile(file);
  };

  const sortedFiles = useMemo(() => [...files].sort((a, b) => a.localeCompare(b)), [files]);

  const tree = useMemo(() => {
    const folders = new Map<string, string[]>();
    const root: string[] = [];
    for (const f of sortedFiles) {
      const folder = folderOf(f);
      if (!folder) root.push(f);
      else {
        if (!folders.has(folder)) folders.set(folder, []);
        folders.get(folder)!.push(f);
      }
    }
    return { root, folders: [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
  }, [sortedFiles]);

  // Aktif dosyanın klasörünü otomatik aç (kullanıcının kapattığını ezmeden: sadece açar).
  useEffect(() => {
    if (!activeFile) return;
    const folder = folderOf(activeFile);
    if (folder) setCollapsed((c) => (c[folder] ? { ...c, [folder]: false } : c));
  }, [activeFile]);

  // Aktif satır ekran dışındaysa görünür alana kaydır (klasör açılınca dahil).
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (!activeFile) return;
    // Klasör açılma render'ının ardından koşsun diye bir kare bekle.
    const id = requestAnimationFrame(() => {
      rowRefs.current.get(activeFile)?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [activeFile, collapsed, files]);

  const q = debouncedQuery.trim().toLowerCase();
  const searching = q.length > 0;

  const nameHits = (f: string) => foldCase(f).includes(foldCase(q));
  // Aktif dosya için CANLI editör içeriği: disk okuması kaydedilmemiş
  // yazıları kaçırır, konumlar kayar. Diğer dosyalar diskten (önbellekli).
  const textOf = (f: string) => (f === activeFile ? activeFileContent : (contents.get(f) || ''));
  // İçerik isabet konumları (arama yokken boş): yönlendirme + rozet için.
  // Katlamalı arama: indisler orijinal metne aittir (Türkçe-İ güvenli).
  const matchPositions = useMemo(() => {
    const map = new Map<string, { start: number; end: number }[]>();
    if (!searching) return map;
    for (const f of sortedFiles) {
      const pos = findFoldedMatches(textOf(f), q);
      if (pos.length > 0 || foldCase(f).includes(foldCase(q))) map.set(f, pos);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, q, sortedFiles, contents, activeFile, activeFileContent]);
  const fileMatches = (f: string) => !searching || matchPositions.has(f);

  // Aynı dosyaya tekrar tıklayınca isabetler arasında dön.
  const cycleRef = useRef<{ file: string; idx: number }>({ file: '', idx: -1 });
  const handleFileClick = (file: string) => {
    const pos = matchPositions.get(file);
    if (searching && pos && pos.length > 0) {
      const idx = cycleRef.current.file === file
        ? (cycleRef.current.idx + 1) % pos.length
        : 0;
      cycleRef.current = { file, idx };
      onFileHit(file, pos[idx].start, pos[idx].end);
    } else if (searching && matchPositions.has(file)) {
      cycleRef.current = { file: '', idx: -1 };
      onFileHit(file, 0, 0);
    } else {
      cycleRef.current = { file: '', idx: -1 };
      onFileSelect(file);
    }
  };

  // Satır içi yeniden adlandırma
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const startRename = (file: string) => {
    setRenaming(file);
    setDraft(baseOf(file).replace(/\.md$/, ''));
  };
  const commitRename = (file: string) => {
    setRenaming(null);
    const name = draft.trim();
    if (!name || name === baseOf(file).replace(/\.md$/, '')) return;
    const clean = name.endsWith('.md') ? name : `${name}.md`;
    const folder = folderOf(file);
    onRenameFile(file, folder ? `${folder}/${clean}` : clean);
  };

  const renderFile = (file: string, nested: boolean) => {
    const pos = matchPositions.get(file) || [];
    const hits = searching && !nameHits(file) ? pos.length : 0;
    if (renaming === file) {
      return (
        <div key={file} className={`file-item renaming${nested ? ' nested' : ''}`}>
          <span className="file-icon" aria-hidden="true"><Icon name="pen" size={14} /></span>
          <input
            className="rename-input"
            value={draft}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitRename(file);
              else if (e.key === 'Escape') setRenaming(null);
            }}
            onBlur={() => setRenaming(null)}
            aria-label={t('renameFile')}
          />
        </div>
      );
    }
    return (
      <div
        key={file}
        ref={(el) => {
          if (el) rowRefs.current.set(file, el);
          else rowRefs.current.delete(file);
        }}
        className={`file-item${activeFile === file ? ' active' : ''}${nested ? ' nested' : ''}`}
        role="option"
        aria-selected={activeFile === file}
        onClick={() => handleFileClick(file)}
        title={file}
      >
        <span className="file-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <span className="file-name">{(nested ? baseOf(file) : file).replace(/\.md$/, '')}</span>
        {searching && hits > 0 && (
          <span className="file-hits" title={t('contentHits', { count: String(hits) })}>{hits}</span>
        )}
        {activeFile === file && (
          <span className="file-actions">
            <button
              className="file-action-btn"
              onClick={(e) => { e.stopPropagation(); startRename(file); }}
              aria-label={t('renameFile')}
              title={t('renameFile')}
            >
              <Icon name="pen" size={12} />
            </button>
            <button
              className="file-action-btn"
              onClick={(e) => handleDeleteFile(e, file)}
              aria-label={t('deleteFile')}
              title={t('deleteFile')}
            >
              <Icon name="trash" size={12} />
            </button>
          </span>
        )}
      </div>
    );
  };

  const renderFolder = (folder: string, folderFiles: string[]) => {
    const visible = searching ? folderFiles.filter(fileMatches) : folderFiles;
    const folderHit = searching && folder.toLowerCase().includes(q);
    if (searching && visible.length === 0 && !folderHit) return null;
    // Aramada isabet varsa klasörü zorla aç; normalde kullanıcı tercihine saygı duy.
    const isOpen = searching ? true : !collapsed[folder];
    const shown = searching ? visible : folderFiles;
    return (
      <div key={folder} className="folder-group">
        <button
          className="folder-row"
          onClick={() => toggleFolder(folder)}
          aria-expanded={isOpen}
          title={isOpen ? t('collapseFolder') : t('expandFolder')}
        >
          <svg className={`chevron-icon${isOpen ? '' : ' collapsed'}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="folder-icon" aria-hidden="true"><Icon name="folder" size={14} /></span>
          <span className="folder-name">{folder}</span>
          <span className="folder-count">{folderFiles.length}</span>
        </button>
        {isOpen && shown.map((f) => renderFile(f, true))}
      </div>
    );
  };

  const visibleRoot = searching ? tree.root.filter(fileMatches) : tree.root;
  const hasFolderResults = tree.folders.some(
    ([folder, fs]) => fs.some(fileMatches) || folder.toLowerCase().includes(q)
  );
  const hasResults = visibleRoot.length > 0 || hasFolderResults;

  return (
    <aside className="sidebar" role="navigation" aria-label="File explorer">
      <header className="sidebar-header">
        <span className="sidebar-title">{t('files')}</span>
      </header>
      <div className="sidebar-search">
        <span className="sidebar-search-icon" aria-hidden="true"><Icon name="search" size={14} /></span>
        <input
          className="sidebar-search-input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); debouncedSetQuery(e.target.value); }}
          placeholder={t('searchVault')}
          aria-label={t('searchVault')}
        />
        {query && (
          <button
            className="sidebar-search-clear"
            onClick={() => { setQuery(''); debouncedSetQuery(''); }}
            aria-label={t('cancel')}
            title={t('cancel')}
          >
            <Icon name="x" size={12} />
          </button>
        )}
      </div>
      <div className="file-list" role="listbox" aria-label="Markdown files">
        {sortedFiles.length === 0 ? (
          <div className="empty-state" style={{ padding: '16px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-text">{t('noNotesYet')}</div>
          </div>
        ) : searching && !hasResults ? (
          <div className="empty-state" style={{ padding: '16px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>
            <div className="empty-state-text">{t('noSearchResults')}</div>
          </div>
        ) : (
          <>
            {visibleRoot.map((f) => renderFile(f, false))}
            {tree.folders.map(([folder, fs]) => renderFolder(folder, fs))}
          </>
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
