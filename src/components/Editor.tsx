import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react';
import { parseMarkdown, writeFile, confirmDialog } from '../api';
import { useDebounce } from '../hooks/useDebounce';
import { renderMathInHtml } from '../math';
import { Logo } from './Logo';
import { Icon } from './Icon';
import { SearchBar, type SearchMatch } from './SearchBar';
import type { TFunc } from '../i18n';

interface EditorProps {
  fileName: string | null;
  content: string;
  onContentChange: (content: string) => void;
  onLinkClick: (link: string) => void;
  onDeleteFile?: (fileName: string) => void;
  onOpenVault?: () => void;
  showEditor: boolean;
  setShowEditor: (show: boolean) => void;
  showSearchBar: boolean;
  setShowSearchBar: (show: boolean) => void;
  pendingSelect: { file: string; start: number; end: number } | null;
  onPendingSelectConsumed: () => void;
  t: TFunc;
}

interface HistoryEntry { content: string; cursorStart: number; cursorEnd: number; }
const MAX_HISTORY = 100;

export function Editor({
  fileName, content, onContentChange, onLinkClick, onDeleteFile, onOpenVault,
  showEditor, setShowEditor, showSearchBar, setShowSearchBar,
  pendingSelect, onPendingSelectConsumed, t,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const pendingSave = useRef<{ name: string; text: string } | null>(null);
  // Bul/değiştir vurgu katmanı verisi (SearchBar'dan beslenir)
  const [searchInfo, setSearchInfo] = useState<{ query: string; matches: SearchMatch[]; current: number }>(
    { query: '', matches: [], current: 0 }
  );
  const handleMatchesChange = useCallback(
    (info: { query: string; matches: SearchMatch[]; current: number }) => setSearchInfo(info),
    []
  );
  const handleSearchClose = useCallback(() => {
    setShowSearchBar(false);
    setSearchInfo({ query: '', matches: [], current: 0 });
  }, [setShowSearchBar]);
  const syncMirrorScroll = useCallback(() => {
    const ta = textareaRef.current, mirror = mirrorRef.current;
    if (!ta || !mirror) return;
    mirror.scrollTop = ta.scrollTop;
    mirror.scrollLeft = ta.scrollLeft;
    // Textarea'nın dikey kaydırma çubuğu içerik kutusunu daraltır; mirror'da
    // aynı oluğu bırakmazsak satır kaymaları tutmaz ve vurgu gittikçe kayar.
    const gutter = ta.offsetWidth - ta.clientWidth;
    mirror.style.paddingRight = `${20 + Math.max(0, gutter)}px`;
    // Satır kaydırma birebir tutsun diye metrikleri textarea'dan kopyala:
    // tarayıcı/tema ne yaparsa mirror aynısını yapar (tahmin yok).
    const cs = getComputedStyle(ta);
    mirror.style.fontFamily = cs.fontFamily;
    mirror.style.fontSize = cs.fontSize;
    mirror.style.lineHeight = cs.lineHeight;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.style.wordSpacing = cs.wordSpacing;
    mirror.style.tabSize = cs.tabSize;
    mirror.style.whiteSpace = cs.whiteSpace;
    mirror.style.overflowWrap = cs.overflowWrap;
    mirror.style.wordBreak = cs.wordBreak;
  }, []);

  // Katman her belirdiğinde/güncellendiğinde kaydırma + oluğu eşitle.
  // Yoksa textarea kaydırılmışken açılan mirror tepede (scrollTop=0) kalır ve
  // ilk scroll'a kadar boş/yanlış bölümü işaretler.
  useLayoutEffect(() => {
    if (showSearchBar && searchInfo.query.length > 0) syncMirrorScroll();
  }, [showSearchBar, searchInfo, content, syncMirrorScroll]);

  // ---- Undo/Redo (ref tabanlı, dosya değişiminde sıfırlanır) ----
  const historyRef = useRef<HistoryEntry[]>([]);
  const indexRef = useRef(-1);
  const isUndoRedo = useRef(false);
  const pushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncButtons = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
  }, []);

  useEffect(() => {
    if (fileName !== null) {
      historyRef.current = [{ content, cursorStart: 0, cursorEnd: 0 }];
      indexRef.current = 0;
    } else {
      historyRef.current = [];
      indexRef.current = -1;
    }
    syncButtons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName, syncButtons]);

  useEffect(() => () => { if (pushTimeout.current) clearTimeout(pushTimeout.current); }, []);

  const pushHistory = useCallback((newContent: string, start: number, end: number) => {
    if (isUndoRedo.current) return;
    if (pushTimeout.current) clearTimeout(pushTimeout.current);
    pushTimeout.current = setTimeout(() => {
      const truncated = historyRef.current.slice(0, indexRef.current + 1);
      historyRef.current = [...truncated, { content: newContent, cursorStart: start, cursorEnd: end }].slice(-MAX_HISTORY);
      indexRef.current = historyRef.current.length - 1;
      syncButtons();
    }, 300);
  }, [syncButtons]);

  const debouncedSave = useDebounce(
    useCallback(async (name: string, text: string) => {
      try { await writeFile(name, text); pendingSave.current = null; }
      catch (err) { console.error('Failed to save file:', err); }
    }, []),
    2000
  );

  const debouncedParse = useDebounce(
    useCallback(async (text: string) => {
      try {
        const result = await parseMarkdown(text);
        setPreviewHtml(renderMathInHtml(result.html));
      } catch (err) { console.error('Failed to parse markdown:', err); setPreviewHtml(''); }
    }, []),
    300
  );

  const applyEntry = useCallback((entry: HistoryEntry) => {
    isUndoRedo.current = true;
    onContentChange(entry.content);
    if (fileName) {
      pendingSave.current = { name: fileName, text: entry.content };
      debouncedSave(fileName, entry.content);
    }
    const s = entry.cursorStart, e = entry.cursorEnd;
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(s, e); }
      isUndoRedo.current = false;
    }, 0);
  }, [onContentChange, fileName, debouncedSave]);

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    applyEntry(historyRef.current[indexRef.current]);
    syncButtons();
  }, [applyEntry, syncButtons]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    applyEntry(historyRef.current[indexRef.current]);
    syncButtons();
  }, [applyEntry, syncButtons]);

  useEffect(() => {
    if (fileName) debouncedParse(content);
    else setPreviewHtml('');
  }, [content, fileName, debouncedParse]);

  // ---- Arama çubuğu yardımcıları ----
  const selectRange = useCallback((start: number, end: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(start, end);
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    const line = ta.value.slice(0, start).split('\n').length - 1;
    ta.scrollTop = Math.max(0, line * lineHeight - ta.clientHeight / 2);
    syncMirrorScroll();
  }, [syncMirrorScroll]);

  // Dışarıdan gelen "şu isabete git" isteğini bir kez uygula (arama yönlendirmesi).
  useEffect(() => {
    if (pendingSelect && pendingSelect.file === fileName) {
      selectRange(pendingSelect.start, pendingSelect.end);
      onPendingSelectConsumed();
    }
  }, [pendingSelect, fileName, selectRange, onPendingSelectConsumed]);

  // Bayat programatik seçimi temizle: sorgu/seçenek değişince isabet kümesi
  // yenilenir; eski mavi seçim ekranda asılı kalır ve "yanlış bölge" gibi
  // görünür. Gezinmede matches referansı AYNI kalır → dokunulmaz. Yazarken
  // imleç zaten çöküktür → no-op. IME birleşimi sırasında ASLA dokunma.
  const prevMatchesRef = useRef<SearchMatch[] | null>(null);
  useEffect(() => {
    const prev = prevMatchesRef.current;
    prevMatchesRef.current = searchInfo.matches;
    if (prev === null || prev === searchInfo.matches || composingRef.current) return;
    const ta = textareaRef.current;
    if (ta && ta.selectionStart !== ta.selectionEnd) {
      ta.setSelectionRange(ta.selectionStart, ta.selectionStart);
    }
  }, [searchInfo]);

  const replaceCurrent = useCallback((start: number, end: number, replacement: string) => {
    const next = content.slice(0, start) + replacement + content.slice(end);
    onContentChange(next);
    pushHistory(next, start, start + replacement.length);
    if (fileName) { pendingSave.current = { name: fileName, text: next }; debouncedSave(fileName, next); }
  }, [content, fileName, onContentChange, pushHistory, debouncedSave]);

  const replaceAll = useCallback((matchesArr: SearchMatch[], replacement: string) => {
    let next = ''; let last = 0;
    for (const m of matchesArr) { next += content.slice(last, m.start) + replacement; last = m.end; }
    next += content.slice(last);
    onContentChange(next);
    pushHistory(next, 0, next.length);
    if (fileName) { pendingSave.current = { name: fileName, text: next }; debouncedSave(fileName, next); }
  }, [content, fileName, onContentChange, pushHistory, debouncedSave]);

  // ---- Format yardımcıları ----
  const wrapSelection = useCallback((prefix: string, suffix: string = prefix) => {
    const ta = textareaRef.current; if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = prefix + selectedText + suffix;
    const newContent = content.substring(0, start) + newText + content.substring(end);
    onContentChange(newContent);
    pushHistory(newContent, start, start + newText.length);
    if (fileName) { pendingSave.current = { name: fileName, text: newContent }; debouncedSave(fileName, newContent); }
    setTimeout(() => { ta.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length); ta.focus(); }, 0);
  }, [content, onContentChange, pushHistory, fileName, debouncedSave]);

  const wrapLines = useCallback((prefix: string) => {
    const ta = textareaRef.current; if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const startLine = content.lastIndexOf('\n', start - 1) + 1;
    let endLine = content.indexOf('\n', end);
    if (endLine === -1) endLine = content.length;
    const selectedText = content.substring(startLine, endLine);
    const newText = selectedText.split('\n').map(l => (l ? prefix + l : l)).join('\n');
    const newContent = content.substring(0, startLine) + newText + content.substring(endLine);
    onContentChange(newContent);
    pushHistory(newContent, startLine, startLine + newText.length);
    if (fileName) { pendingSave.current = { name: fileName, text: newContent }; debouncedSave(fileName, newContent); }
    setTimeout(() => { ta.setSelectionRange(startLine, startLine + newText.length); ta.focus(); }, 0);
  }, [content, onContentChange, pushHistory, fileName, debouncedSave]);

  const toggleFormat = useCallback((markdown: string) => {
    const ta = textareaRef.current; if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selectedText = content.substring(start, end);
    const beforeText = content.substring(0, start);
    const afterText = content.substring(end);
    const isFormatted = beforeText.endsWith(markdown) && afterText.startsWith(markdown);
    let newContent: string, newStart: number, newEnd: number;
    if (isFormatted) {
      newContent = beforeText.slice(0, -markdown.length) + selectedText + afterText.slice(markdown.length);
      newStart = start - markdown.length; newEnd = end - markdown.length;
    } else {
      newContent = beforeText + markdown + selectedText + markdown + afterText;
      newStart = start + markdown.length; newEnd = end + markdown.length;
    }
    onContentChange(newContent);
    pushHistory(newContent, newStart, newEnd);
    if (fileName) { pendingSave.current = { name: fileName, text: newContent }; debouncedSave(fileName, newContent); }
    setTimeout(() => { ta.setSelectionRange(newStart, newEnd); ta.focus(); }, 0);
  }, [content, onContentChange, pushHistory, fileName, debouncedSave]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const start = e.currentTarget.selectionStart;
    const end = e.currentTarget.selectionEnd;
    onContentChange(newContent);
    pushHistory(newContent, start, end);
    if (fileName) { pendingSave.current = { name: fileName, text: newContent }; debouncedSave(fileName, newContent); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); setShowSearchBar(true); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      onContentChange(newContent);
      pushHistory(newContent, start + 2, start + 2);
      if (fileName) { pendingSave.current = { name: fileName, text: newContent }; debouncedSave(fileName, newContent); }
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleDelete = async () => {
    if (!fileName || !onDeleteFile) return;
    const ok = await confirmDialog(t('deleteNoteConfirm', { name: fileName.replace(/\.md$/, '') }));
    if (ok) onDeleteFile(fileName);
  };

  // Kapanırken bekleyen kaydı yaz
  useEffect(() => () => {
    const p = pendingSave.current;
    if (p) writeFile(p.name, p.text).catch(console.error);
  }, []);

  if (!fileName) {
    return (
      <div className="welcome-screen" role="main">
        <div className="welcome-icon"><Logo size={72} /></div>
        <h1 className="welcome-title">{t('welcomeTitle')}</h1>
        <p className="welcome-subtitle">{t('welcomeSubtitle')}</p>
        <div className="welcome-actions">
          <button className="btn primary" onClick={onOpenVault}>{t('openVault')}</button>
        </div>
      </div>
    );
  }

  const isPreviewEmpty = !previewHtml.trim();
  const showMarks = showSearchBar && searchInfo.query.length > 0;

  // Vurgu katmanı: içeriği <mark> parçalarına böler (React otomatik kaçırır).
  const renderSearchMarks = () => {
    const { matches, current } = searchInfo;
    if (matches.length === 0) return content;
    const out: React.ReactNode[] = [];
    let last = 0;
    matches.forEach((m, i) => {
      const s = Math.max(0, Math.min(m.start, content.length));
      const e = Math.max(s, Math.min(m.end, content.length));
      if (s > last) out.push(content.slice(last, s));
      const piece = content.slice(s, e);
      // Not: sıfır uzunluklu regex eşleşmesinde boş <mark> yer kaplamaz.
      out.push(piece
        ? <mark key={i} className={i === current ? 'current' : undefined}>{piece}</mark>
        : <mark key={i} className={i === current ? 'current' : undefined} />);
      last = e;
    });
    if (last < content.length) out.push(content.slice(last));
    return out;
  };

  return (
    <div className="editor-pane" role="main">
      <header className="editor-header">
        <span className="editor-title">{fileName.replace(/\.md$/, '')}</span>
        <div className="editor-actions">
          <button
            className="btn icon-only"
            onClick={() => setShowEditor(!showEditor)}
            aria-pressed={showEditor}
            aria-label={showEditor ? t('hideEditor') : t('showEditor')}
            title={showEditor ? t('hideEditor') : t('showEditor')}
          >
            <Icon name={showEditor ? 'eye-off' : 'eye'} />
          </button>
          <button
            className="btn icon-only"
            onClick={handleDelete}
            aria-label={t('deleteNote')}
            title={t('deleteNote')}
            disabled={!onDeleteFile}
          >
            <Icon name="trash" />
          </button>
        </div>
      </header>
      <div className="editor-split">
        {showEditor && (
          <div className="editor-half">
            <div className="editor-toolbar">
              <button className="toolbar-btn" onClick={() => toggleFormat('**')} title={t('formatBold')}><Icon name="bold" /></button>
              <button className="toolbar-btn" onClick={() => toggleFormat('*')} title={t('formatItalic')}><Icon name="italic" /></button>
              <button className="toolbar-btn" onClick={() => toggleFormat('_')} title={t('formatUnderline')}><Icon name="underline" /></button>
              <button className="toolbar-btn" onClick={() => toggleFormat('~~')} title={t('formatStrikethrough')}><Icon name="strikethrough" /></button>
              <div className="toolbar-divider" />
              <button className="toolbar-btn" onClick={() => wrapLines('- ')} title={t('formatList')}><Icon name="list" /></button>
              <button className="toolbar-btn" onClick={() => wrapLines('1. ')} title={t('formatListOrdered')}><Icon name="list-ordered" /></button>
              <div className="toolbar-divider" />
              <button className="toolbar-btn" onClick={undo} disabled={!canUndo} title={`${t('undo')} (Ctrl+Z)`}><Icon name="undo" /></button>
              <button className="toolbar-btn" onClick={redo} disabled={!canRedo} title={`${t('redo')} (Ctrl+Shift+Z)`}><Icon name="redo" /></button>
              <div className="toolbar-divider" />
              <button className="toolbar-btn" onClick={() => wrapSelection('[', '](')} title={t('insertLink')}><Icon name="link" /></button>
              <button className="toolbar-btn" onClick={() => wrapSelection('![', '](')} title={t('insertImage')}><Icon name="image" /></button>
              <button className="toolbar-btn" onClick={() => wrapLines('> ')} title={t('formatQuote')}><Icon name="quote" /></button>
              <button className="toolbar-btn" onClick={() => wrapLines('    ')} title={t('formatCode')}><Icon name="code" /></button>
            </div>
            <div className="editor-textarea-wrap">
              {showMarks && (
                <div ref={mirrorRef} className="search-mirror" aria-hidden="true">
                  {renderSearchMarks()}
                </div>
              )}
              <textarea
                ref={textareaRef}
                className={`editor-textarea${showMarks ? ' with-search' : ''}`}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={syncMirrorScroll}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; }}
                placeholder={t('editorPlaceholder')}
                spellCheck={true}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>
          </div>
        )}
        <div
          ref={previewRef}
          className="preview-pane"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a[data-wiki-link]');
            if (link) {
              e.preventDefault();
              const noteName = link.getAttribute('data-wiki-link');
              if (noteName) onLinkClick(noteName);
            }
          }}
          role="region"
          aria-label="Markdown preview"
        >
          {isPreviewEmpty ? (
            <div className="preview-empty">
              <div className="preview-empty-icon">📄</div>
              <div className="preview-empty-text">{t('emptyNote')}</div>
            </div>
          ) : (
            <div className="preview-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </div>
      </div>
      {showSearchBar && (
        <SearchBar
          content={content}
          onClose={handleSearchClose}
          onSelect={selectRange}
          onReplaceCurrent={replaceCurrent}
          onReplaceAll={replaceAll}
          onMatchesChange={handleMatchesChange}
          t={t}
        />
      )}
    </div>
  );
}