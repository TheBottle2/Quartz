import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { readVault, readFile, getAllFiles, createFile, deleteFile, selectVaultFolder, writeFile, confirmDialog } from './api';
import { getVersion } from '@tauri-apps/api/app';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { BacklinksPane } from './components/BacklinksPane';
import { GraphModal } from './components/GraphModal';
import { Logo } from './components/Logo';
import { Icon } from './components/Icon';
import { getDailyNotePath, getDailyNoteTemplate, extractDailyNoteDates } from './utils/dailyNotes';
import { createT, detectDefaultLang, LOCALES, LANG_LABELS, type Lang } from './i18n';

const DEFAULT_VAULT_PATH = '/mnt/harddisk/my_apps/vault';

const DEFAULT_SHORTCUTS = {
  newNote: 'Ctrl+N',
  saveNote: 'Ctrl+S',
  deleteNote: 'Ctrl+Shift+Delete',
  searchNotes: 'Ctrl+F',
  toggleSidebar: 'Ctrl+B',
  toggleGraph: 'Ctrl+G',
  toggleCalendar: 'Ctrl+Shift+C',
};

const MODIFIER_KEYS = new Set(['Ctrl', 'Shift', 'Alt', 'Cmd', 'Meta']);

function eventMatchesShortcut(e: KeyboardEvent, binding?: string): boolean {
  if (!binding) return false;
  const parts = binding.split('+').map(p => p.trim()).filter(Boolean);
  const needCtrl = parts.includes('Ctrl');
  const needShift = parts.includes('Shift');
  const needAlt = parts.includes('Alt');
  const needMeta = parts.includes('Cmd') || parts.includes('Meta');
  const main = parts.filter(p => !MODIFIER_KEYS.has(p)).pop();
  if (!main) return false;
  if (e.ctrlKey !== needCtrl || e.shiftKey !== needShift || e.altKey !== needAlt || e.metaKey !== needMeta) return false;
  const eventKey = e.key === ' ' ? 'Space' : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return eventKey === main.toUpperCase();
}

const SHORTCUT_LABEL_KEYS: Record<string, string> = {
  newNote: 'settingsShortcutActionNewNote',
  saveNote: 'settingsShortcutActionSaveNote',
  deleteNote: 'settingsShortcutActionDeleteNote',
  searchNotes: 'settingsShortcutActionSearchNotes',
  toggleSidebar: 'settingsShortcutActionToggleSidebar',
  toggleGraph: 'settingsShortcutActionToggleGraph',
  toggleCalendar: 'settingsShortcutActionToggleCalendar',
};

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(() => localStorage.getItem('vaultPath'));
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showBacklinks, setShowBacklinks] = useState(true);
  const [showVaultDialog, setShowVaultDialog] = useState(false);
  const [vaultDialogPath, setVaultDialogPath] = useState(() => localStorage.getItem('vaultPath') || DEFAULT_VAULT_PATH);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'dark' || saved === 'light') ? saved as 'dark' | 'light' : 'dark';
  });
  const [transparentBg, setTransparentBg] = useState(() => localStorage.getItem('transparentBg') === 'true');
  const [windowOpacity, setWindowOpacity] = useState(() => {
    const val = localStorage.getItem('windowOpacity');
    return val ? parseFloat(val) : 0.9;
  });
  const [dailyNotesFolder, setDailyNotesFolder] = useState(() => localStorage.getItem('dailyNotesFolder') || 'Daily/');
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('lang') as Lang | null;
    return saved && saved in LOCALES ? saved : detectDefaultLang();
  });
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(() => new Date());
  const [showEditor, setShowEditor] = useState(() => localStorage.getItem('showEditor') !== 'false');
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const [recentVaults, setRecentVaults] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('recentVaults');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('shortcuts');
    if (saved) { try { return JSON.parse(saved); } catch { return DEFAULT_SHORTCUTS; } }
    return DEFAULT_SHORTCUTS;
  });
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const contentRef = useRef(content);
  contentRef.current = content;

  const noteDates = useMemo(() => extractDailyNoteDates(files, dailyNotesFolder), [files, dailyNotesFolder]);
  const t = useMemo(() => createT(lang), [lang]);
  const locale = LOCALES[lang];

  const updateRecentVaults = useCallback((path: string) => {
    setRecentVaults(prev => {
      const updated = [path, ...prev.filter(v => v !== path)].slice(0, 5);
      localStorage.setItem('recentVaults', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const loadVault = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const vaultInfo = await readVault(path);
      setVaultPath(vaultInfo.path);
      localStorage.setItem('vaultPath', vaultInfo.path);
      updateRecentVaults(vaultInfo.path);
      setFiles(vaultInfo.files);
      setActiveFile(null);
      setContent('');
    } catch (err) {
      console.error('Failed to load vault:', err);
      alert('Failed to load vault: ' + err);
    } finally { setLoading(false); }
  }, [updateRecentVaults]);

  const handleSwitchVault = useCallback(async (path: string) => {
    try { await loadVault(path); setShowSettings(false); }
    catch (error) { console.error('Failed to switch vault:', error); }
  }, [loadVault]);

  const handleRemoveRecentVault = useCallback((path: string) => {
    setRecentVaults(prev => {
      const updated = prev.filter(v => v !== path);
      localStorage.setItem('recentVaults', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetShortcuts = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    localStorage.setItem('shortcuts', JSON.stringify(DEFAULT_SHORTCUTS));
    setEditingShortcut(null); setIsRecording(false); setRecordedKeys([]);
  }, []);

  const saveShortcut = useCallback((action: string) => {
    const keyString = recordedKeys.join('+');
    if (!keyString) return;
    const conflict = Object.entries(shortcuts).find(([a, k]) => a !== action && k === keyString);
    if (conflict) {
      alert(t('shortcutConflict', { action: t((SHORTCUT_LABEL_KEYS[conflict[0]] ?? conflict[0]) as never) }));
      return;
    }
    const newShortcuts = { ...shortcuts, [action]: keyString };
    setShortcuts(newShortcuts);
    localStorage.setItem('shortcuts', JSON.stringify(newShortcuts));
    setEditingShortcut(null); setIsRecording(false); setRecordedKeys([]);
  }, [shortcuts, recordedKeys, t]);

  useEffect(() => {
    if (!isRecording) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      const keys: string[] = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');
      if (e.metaKey) keys.push('Cmd');
      const key = e.key;
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        keys.push(key.length === 1 ? key.toUpperCase() : key);
        setRecordedKeys(keys);
        setIsRecording(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  const loadFile = useCallback(async (file: string) => {
    if (activeFile === file) { setActiveFile(null); setContent(''); return; }
    try {
      const fileContent = await readFile(file);
      setActiveFile(file);
      setContent(fileContent);
    } catch (err) { console.error('Failed to load file:', err); }
  }, [activeFile]);

  const handleNewFile = useCallback(async (name: string) => {
    if (!name.trim()) return;
    try {
      const fileName = name.trim().endsWith('.md') ? name.trim() : `${name.trim()}.md`;
      await createFile(fileName);
      setFiles(await getAllFiles());
      loadFile(fileName);
    } catch (err) { console.error('Failed to create file:', err); }
  }, [loadFile]);

  const handleDeleteFile = useCallback(async (fileName: string) => {
    try {
      await deleteFile(fileName);
      setFiles(await getAllFiles());
      if (activeFile === fileName) { setActiveFile(null); setContent(''); }
    } catch (err) { console.error('Failed to delete file:', err); }
  }, [activeFile]);

  const handleRefresh = useCallback(async () => {
    if (vaultPath) setFiles(await getAllFiles());
  }, [vaultPath]);

  const handleLinkClick = useCallback((link: string) => {
    const targetFile = files.find(f => f.toLowerCase().replace(/\.md$/, '') === link.toLowerCase());
    if (targetFile) loadFile(targetFile);
    else {
      const newFileName = `${link}.md`;
      createFile(newFileName).then(() => handleRefresh()).then(() => loadFile(newFileName)).catch(console.error);
    }
  }, [files, loadFile, handleRefresh]);

  const handleOpenVaultDialog = useCallback(async () => {
    try {
      const path = await selectVaultFolder();
      if (path) setVaultDialogPath(path);
    } catch (err) { console.error('Failed to open dialog:', err); }
  }, []);

  const handleOpenGraphModal = useCallback(() => setShowGraphModal(true), []);
  const handleGraphModalCancel = useCallback(() => setShowGraphModal(false), []);

  const handleVaultDialogConfirm = useCallback(async () => {
    if (vaultDialogPath) { await loadVault(vaultDialogPath); setShowVaultDialog(false); }
  }, [vaultDialogPath, loadVault]);

  const handleVaultDialogCancel = useCallback(() => {
    setShowVaultDialog(false);
    setVaultDialogPath(vaultPath || DEFAULT_VAULT_PATH);
  }, [vaultPath]);

  const handleNewNoteConfirm = useCallback(() => {
    if (newNoteName.trim()) { handleNewFile(newNoteName); setNewNoteName(''); setShowNewNoteModal(false); }
  }, [newNoteName, handleNewFile]);

  const handleNewNoteCancel = useCallback(() => { setNewNoteName(''); setShowNewNoteModal(false); }, []);
  const handleOpenNewNoteModal = useCallback(() => setShowNewNoteModal(true), []);

  const handleSetOpacity = useCallback((opacity: number) => {
    const clamped = Math.max(0.6, Math.min(1, opacity));
    setWindowOpacity(clamped);
    localStorage.setItem('windowOpacity', String(clamped));
    document.documentElement.style.setProperty('--window-opacity', String(clamped));
  }, []);

  const handleOpenDailyNote = useCallback(async (date: Date) => {
    const path = getDailyNotePath(dailyNotesFolder, date);
    const exists = files.some(f => f === path || f.endsWith(`/${path}`));
    if (!exists) {
      try {
        await createFile(path);
        await writeFile(path, getDailyNoteTemplate(date));
        setFiles(await getAllFiles());
      } catch (err) {
        console.error('Failed to create daily note:', err);
        alert('Failed to create daily note: ' + err);
        return;
      }
    }
    loadFile(path);
  }, [dailyNotesFolder, files, loadFile]);

  const handleSetDailyNotesFolder = useCallback((folder: string) => {
    const normalized = folder.trim().replace(/^\/+|\/+$/g, '') + '/';
    setDailyNotesFolder(normalized);
    localStorage.setItem('dailyNotesFolder', normalized);
  }, []);

  const handleSelectDailyFolder = useCallback(async () => {
    try {
      const path = await selectVaultFolder();
      if (path && vaultPath) {
        if (path.startsWith(vaultPath)) {
          const relative = path.replace(vaultPath, '').replace(/^\/+|\/+$/g, '');
          const val = relative ? relative + '/' : 'Daily/';
          setDailyNotesFolder(val); localStorage.setItem('dailyNotesFolder', val);
        } else {
          const val = (path.split('/').pop() || 'Daily') + '/';
          setDailyNotesFolder(val); localStorage.setItem('dailyNotesFolder', val);
        }
      }
    } catch (err) { console.error('Failed to select daily folder:', err); }
  }, [vaultPath]);

  const toggleCalendar = useCallback(() => {
    setShowCalendar(prev => !prev);
    if (!showCalendar) setShowSidebar(true);
  }, [showCalendar]);

  const openSearch = useCallback(() => {
    if (activeFile) { setShowEditor(true); setShowSearchBar(true); }
  }, [activeFile]);

  const handleSaveNow = useCallback(async () => {
    if (!activeFile) return;
    try { await writeFile(activeFile, contentRef.current); }
    catch (err) { console.error('Failed to save file:', err); }
  }, [activeFile]);

  const handleDeleteActive = useCallback(async () => {
    if (!activeFile) return;
    const ok = await confirmDialog(t('deleteNoteConfirm', { name: activeFile.replace(/\.md$/, '') }));
    if (ok) handleDeleteFile(activeFile);
  }, [activeFile, handleDeleteFile, t]);

  useEffect(() => {
    const savedVaultPath = localStorage.getItem('vaultPath');
    loadVault(savedVaultPath || DEFAULT_VAULT_PATH);
  }, [loadVault]);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('0.2.12'));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const match = (action: string) => eventMatchesShortcut(e, shortcuts[action]);
      if (match('newNote')) { e.preventDefault(); setShowNewNoteModal(true); return; }
      if (match('saveNote')) { e.preventDefault(); void handleSaveNow(); return; }
      if (match('deleteNote')) { e.preventDefault(); void handleDeleteActive(); return; }
      if (match('searchNotes')) { e.preventDefault(); openSearch(); return; }
      if (match('toggleSidebar')) { e.preventDefault(); setShowSidebar(s => !s); return; }
      if (match('toggleGraph')) { e.preventDefault(); setShowGraphModal(s => !s); return; }
      if (match('toggleCalendar')) { e.preventDefault(); toggleCalendar(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); setShowSettings(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); setShowBacklinks(s => !s); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); void handleOpenDailyNote(new Date()); return; }
      if (e.key === 'Escape') {
        if (showSearchBar) setShowSearchBar(false);
        else if (showNewNoteModal) { setShowNewNoteModal(false); setNewNoteName(''); }
        else if (showVaultDialog) handleVaultDialogCancel();
        else if (showSettings) setShowSettings(false);
        else if (showGraphModal) setShowGraphModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    shortcuts, showNewNoteModal, showVaultDialog, showSettings, showGraphModal, showSearchBar,
    handleSaveNow, handleDeleteActive, openSearch, toggleCalendar,
    handleVaultDialogCancel, handleOpenDailyNote,
  ]);

  useEffect(() => {
    if (transparentBg) {
      document.body.classList.add('transparent-bg');
      document.documentElement.style.setProperty('--window-opacity', String(windowOpacity));
    } else {
      document.body.classList.remove('transparent-bg');
    }
    localStorage.setItem('transparentBg', String(transparentBg));
  }, [transparentBg, windowOpacity]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  useEffect(() => { localStorage.setItem('showEditor', String(showEditor)); }, [showEditor]);

  return (
    <div className="app">
      <header className="toolbar" role="toolbar" aria-label="Main toolbar">
        <div className="toolbar-left">
          <button className="btn icon-only" onClick={() => setShowSidebar(!showSidebar)} aria-pressed={showSidebar} aria-label={t('toggleSidebar')} title={t('toggleSidebar')}>
            <Icon name="menu" />
          </button>
          <Logo size={18} />
          <span className="toolbar-title">{vaultPath ? vaultPath.split('/').pop() : 'Quartz'}</span>
          {appVersion && <span className="version-badge">v{appVersion}</span>}
        </div>
        <div className="toolbar-right">
          <button className="btn icon-only" onClick={handleOpenNewNoteModal} disabled={!vaultPath} aria-label={t('newNote')} title={t('newNote')}>
            <Icon name="plus" />
          </button>
          <button className="btn icon-only" onClick={handleRefresh} disabled={!vaultPath || loading} aria-label={t('refresh')} title={t('refresh')}>
            <Icon name="refresh" />
          </button>
          <div className="toolbar-divider" />
          <button className="btn icon-only" onClick={() => setShowBacklinks(!showBacklinks)} aria-pressed={showBacklinks} aria-label={t('toggleBacklinks')} title={t('toggleBacklinks')}>
            <Icon name="pen" />
          </button>
          <div className="toolbar-divider" />
          <button className="btn icon-only" onClick={handleOpenGraphModal} aria-label={t('graphView')} title={t('graphView')}>
            <Icon name="graph" />
          </button>
          <button className="btn icon-only" onClick={() => setShowSettings(true)} aria-label={t('settings')} title={t('settings')}>
            <Icon name="settings" />
          </button>
        </div>
      </header>
      <div className="app-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {showSidebar && (
          <>
            <Sidebar
              files={files} activeFile={activeFile} onFileSelect={loadFile} onDeleteFile={handleDeleteFile}
              onNewNote={handleOpenNewNoteModal} currentCalendarMonth={currentCalendarMonth}
              onCalendarMonthChange={setCurrentCalendarMonth} onOpenDailyNote={handleOpenDailyNote}
              noteDates={noteDates} t={t} locale={locale} showCalendar={showCalendar}
            />
            <div
              className="resizer"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 240;
                const handleMove = (me: MouseEvent) => {
                  const newWidth = Math.max(200, Math.min(400, startWidth + (me.clientX - startX)));
                  document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
                };
                const handleUp = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
                window.addEventListener('mousemove', handleMove);
                window.addEventListener('mouseup', handleUp);
              }}
              aria-label="Resize sidebar" role="separator"
            />
          </>
        )}
        <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
          <Editor
            fileName={activeFile} content={content} onContentChange={setContent} onLinkClick={handleLinkClick}
            onDeleteFile={handleDeleteFile} onOpenVault={() => setShowVaultDialog(true)}
            showEditor={showEditor} setShowEditor={setShowEditor}
            showSearchBar={showSearchBar} setShowSearchBar={setShowSearchBar}
            t={t}
          />
        </div>
        {showBacklinks && (
          <>
            <div
              className="resizer"
              style={{ left: 'auto', right: 'auto' }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--backlinks-width')) || 300;
                const handleMove = (me: MouseEvent) => {
                  const newWidth = Math.max(200, Math.min(400, startWidth - (me.clientX - startX)));
                  document.documentElement.style.setProperty('--backlinks-width', `${newWidth}px`);
                };
                const handleUp = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
                window.addEventListener('mousemove', handleMove);
                window.addEventListener('mouseup', handleUp);
              }}
              aria-label="Resize backlinks pane" role="separator"
            />
            <BacklinksPane currentFile={activeFile} onFileSelect={loadFile} t={t} />
          </>
        )}
      </div>

      {showVaultDialog && (
        <div className="modal-overlay" onClick={handleVaultDialogCancel} role="dialog" aria-modal="true" aria-labelledby="vault-dialog-title">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="vault-dialog-title">{t('selectVaultFolder')}</h2>
              <button className="modal-close-btn" onClick={handleVaultDialogCancel} aria-label={t('cancel')}><Icon name="x" size={20} /></button>
            </header>
            <div className="modal-body">
              <p className="modal-description">{t('chooseVaultDesc')}</p>
              <div className="modal-path-input">
                <label htmlFor="vault-path-input" className="modal-label">{t('vaultPath')}</label>
                <div className="modal-input-wrapper">
                  <input id="vault-path-input" type="text" value={vaultDialogPath}
                    onChange={(e) => setVaultDialogPath(e.target.value)}
                    placeholder={t('vaultPlaceholder')} className="modal-input" autoFocus />
                  <button className="btn secondary" onClick={handleOpenVaultDialog}><Icon name="folder" /> {t('browse')}</button>
                </div>
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn secondary" onClick={handleVaultDialogCancel}>{t('cancel')}</button>
              <button className="btn primary" onClick={handleVaultDialogConfirm} disabled={!vaultDialogPath.trim()}>{t('selectVault')}</button>
            </footer>
          </div>
        </div>
      )}

      {showNewNoteModal && (
        <div className="modal-overlay" onClick={handleNewNoteCancel} role="dialog" aria-modal="true" aria-labelledby="newnote-dialog-title">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="newnote-dialog-title">{t('newNoteTitle')}</h2>
              <button className="modal-close-btn" onClick={handleNewNoteCancel} aria-label={t('cancel')}><Icon name="x" size={20} /></button>
            </header>
            <div className="modal-body">
              <div className="modal-path-input">
                <label htmlFor="newnote-name-input" className="modal-label">{t('noteName')}</label>
                <input id="newnote-name-input" type="text" value={newNoteName}
                  onChange={(e) => setNewNoteName(e.target.value)} placeholder={t('noteNamePlaceholder')}
                  className="modal-input" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNewNoteConfirm(); if (e.key === 'Escape') handleNewNoteCancel(); }} />
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn secondary" onClick={handleNewNoteCancel}>{t('cancel')}</button>
              <button className="btn primary" onClick={handleNewNoteConfirm} disabled={!newNoteName.trim()}>{t('create')}</button>
            </footer>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)} role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title">
          <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="settings-dialog-title">{t('settings')}</h2>
              <button className="modal-close-btn" onClick={() => setShowSettings(false)} aria-label={t('cancel')}><Icon name="x" size={20} /></button>
            </header>
            <div className="modal-body">
              <div className="settings-body">
                <div className="settings-section">
                  <h3 className="settings-section-title">{t('settingsAppearance')}</h3>
                  <div className="settings-row language-row">
                    <label htmlFor="language" className="language-label">
                      <span className="label-icon">🌐</span>
                      {t('settingsLanguage')}
                    </label>
                    <select id="language" className="modal-input language-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                      {(Object.keys(LANG_LABELS) as Lang[]).map((code) => (
                        <option key={code} value={code}>{LANG_LABELS[code]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="settings-row">
                    <label htmlFor="theme">{t('settingsTheme')}</label>
                    <select id="theme" className="modal-input" value={theme} onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}>
                      <option value="light">{t('settingsLight')}</option>
                      <option value="dark">{t('settingsDark')}</option>
                    </select>
                  </div>
                </div>
                <div className="settings-section">
                  <h3 className="settings-section-title">{t('settingsVault')}</h3>
                  <div className="settings-row">
                    <div className="setting-label">
                      <span className="setting-label-text">{t('currentVault')}</span>
                      <span className="setting-label-desc">{vaultPath || t('noVaultSelected')}</span>
                    </div>
                    <button className="btn secondary" onClick={() => { setShowSettings(false); setShowVaultDialog(true); }}>
                      {t('changeVault')}
                    </button>
                  </div>
                  {recentVaults.length > 0 && (
                    <div className="recent-vaults">
                      <h4>{t('recentVaults')}</h4>
                      <ul className="recent-vaults-list">
                        {recentVaults.map((vault) => (
                          <li key={vault} className="recent-vault-item">
                            <span className="vault-path">{vault}</span>
                            <div className="vault-actions">
                              <button className="vault-switch-btn" onClick={() => handleSwitchVault(vault)}>{t('settingsSwitch')}</button>
                              <button className="vault-remove-btn" onClick={() => handleRemoveRecentVault(vault)} title={t('settingsRemove')}>×</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="settings-section">
                  <h3 className="settings-section-title">{t('dailyNotesSection')}</h3>
                  <div className="settings-row">
                    <div className="setting-label">
                      <span className="setting-label-text">{t('dailyNotesFolder')}</span>
                      <span className="setting-label-desc">{t('dailyNotesFolderDesc')}</span>
                    </div>
                    <div className="setting-control" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '300px' }}>
                      <input type="text" value={dailyNotesFolder} onChange={(e) => handleSetDailyNotesFolder(e.target.value)}
                        placeholder="Daily/" className="modal-input" style={{ flex: 1, fontSize: '14px', fontFamily: 'var(--font-mono)' }} />
                      <button className="btn secondary" onClick={handleSelectDailyFolder} title={t('browse')} style={{ whiteSpace: 'nowrap' }}>
                        <Icon name="folder" /> {t('browse')}
                      </button>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div className="setting-label">
                      <span className="setting-label-text">{t('template')}</span>
                      <span className="setting-label-desc">{t('templateDesc')}</span>
                    </div>
                    <div className="setting-control">
                      <code style={{ background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                        {'# {{date}}\n\n'}{t('dailyNoteTemplateHeading')}
                      </code>
                    </div>
                  </div>
                </div>
                <div className="settings-section">
                  <h3 className="settings-section-title">{t('settingsAppearance')}</h3>
                  <div className="setting-row">
                    <div className="setting-label">
                      <span className="setting-label-text">{t('transparentBg')}</span>
                      <span className="setting-label-desc">{t('transparentBgDesc')}</span>
                    </div>
                    <div className="setting-control">
                      <label className="toggle-switch">
                        <input type="checkbox" checked={transparentBg} onChange={() => setTransparentBg(!transparentBg)} />
                        <span className="toggle-slider"></span>
                      </label>
                      <span style={{ color: 'var(--fg-muted)', fontSize: '13px', marginRight: '12px' }}>{transparentBg ? t('on') : t('off')}</span>
                    </div>
                  </div>
                  {transparentBg && (
                    <div className="setting-row">
                      <div className="setting-label">
                        <span className="setting-label-text">{t('windowOpacity')}</span>
                        <span className="setting-label-desc">{t('windowOpacityDesc')}</span>
                      </div>
                      <div className="setting-control" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '300px' }}>
                        <input type="range" min="0.6" max="1" step="0.05" value={windowOpacity}
                          onChange={(e) => handleSetOpacity(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--accent)' }} />
                        <span style={{ color: 'var(--fg-muted)', fontSize: '13px', minWidth: '45px', textAlign: 'right' }}>
                          {Math.round(windowOpacity * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="settings-section">
                  <div className="settings-section-header">
                    <h3 className="settings-section-title">{t('settingsShortcuts')}</h3>
                    <button className="reset-shortcuts-btn" onClick={resetShortcuts}>{t('settingsResetShortcuts')}</button>
                  </div>
                  <div className="shortcuts-list">
                    {Object.entries(shortcuts).map(([action, keybinding]) => (
                      <div key={action} className="shortcut-item"
                        onClick={() => { setEditingShortcut(action); setRecordedKeys([]); setIsRecording(true); }}>
                        <span className="shortcut-action">{t((SHORTCUT_LABEL_KEYS[action] ?? action) as never)}</span>
                        <div className="shortcut-keys">
                          {editingShortcut === action && isRecording ? (
                            <span className="shortcut-recording">{t('settingsPressKeys')}</span>
                          ) : (
                            keybinding.split('+').map((key, idx) => (
                              <kbd key={idx} className="shortcut-kbd">{key}</kbd>
                            ))
                          )}
                          <span className="shortcut-edit-icon">✎</span>
                        </div>
                      </div>
                    ))}
                    {editingShortcut && !isRecording && recordedKeys.length > 0 && (
                      <div className="shortcut-save-modal">
                        <div className="shortcut-save-content">
                          <p>{t('settingsNewShortcut')}: <strong>{recordedKeys.join('+')}</strong></p>
                          <div className="shortcut-save-actions">
                            <button className="shortcut-save-btn" onClick={() => saveShortcut(editingShortcut)}>{t('settingsSave')}</button>
                            <button className="shortcut-cancel-btn" onClick={() => { setEditingShortcut(null); setIsRecording(false); setRecordedKeys([]); }}>{t('settingsCancel')}</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <footer className="modal-footer">
                <span className="version-badge footer-version">Quartz v{appVersion}</span>
                <button className="btn primary" onClick={() => setShowSettings(false)}>{t('done')}</button>
              </footer>
            </div>
          </div>
        </div>
      )}

      {showGraphModal && (
        <GraphModal
          isOpen={showGraphModal}
          onClose={handleGraphModalCancel}
          files={files}
          onNoteOpen={(name) => loadFile(name.endsWith('.md') ? name : `${name}.md`)}
          lang={lang}
        />
      )}
    </div>
  );
}

export default App;