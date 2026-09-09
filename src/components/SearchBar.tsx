import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { TFunc } from '../i18n';

export interface SearchMatch { start: number; end: number; }

interface SearchBarProps {
  content: string;
  onClose: () => void;
  onSelect: (start: number, end: number) => void;
  onReplaceCurrent: (start: number, end: number, replacement: string) => void;
  onReplaceAll: (matches: SearchMatch[], replacement: string) => void;
  t: TFunc;
}

export function SearchBar({ content, onClose, onSelect, onReplaceCurrent, onReplaceAll, t }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [current, setCurrent] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const matches = useMemo<SearchMatch[]>(() => {
    if (!query) return [];
    try {
      const escaped = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b(?:${escaped})\\b` : escaped;
      const re = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      const out: SearchMatch[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length });
        if (m[0].length === 0) re.lastIndex++;
        if (out.length > 5000) break;
      }
      return out;
    } catch {
      return [];
    }
  }, [content, query, caseSensitive, useRegex, wholeWord]);

  useEffect(() => {
    if (current >= matches.length) setCurrent(Math.max(0, matches.length - 1));
  }, [matches.length, current]);

  useEffect(() => {
    const m = matches[current];
    if (m) onSelect(m.start, m.end);
  }, [current, matches, onSelect]);

  const goNext = () => { if (matches.length) setCurrent((current + 1) % matches.length); };
  const goPrev = () => { if (matches.length) setCurrent((current - 1 + matches.length) % matches.length); };

  return (
    <div
      className="search-bar"
      role="search"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
    >
      <div className="search-row">
        <Icon name="search" />
        <input
          ref={inputRef}
          className="search-input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCurrent(0); }}
          placeholder={t('searchPlaceholder')}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? goPrev() : goNext(); }
          }}
        />
        <span className="search-count">
          {query ? (matches.length ? `${current + 1}/${matches.length}` : '0/0') : ''}
        </span>
        <button className="search-btn" onClick={goPrev} disabled={!matches.length} title={t('previousMatch')}>
          <Icon name="chevron-up" />
        </button>
        <button className="search-btn" onClick={goNext} disabled={!matches.length} title={t('nextMatch')}>
          <Icon name="chevron-down" />
        </button>
        <button className={`search-btn ${showReplace ? 'active' : ''}`} onClick={() => setShowReplace(!showReplace)} title={showReplace ? t('hideReplace') : t('showReplace')}>
          <Icon name="replace" />
        </button>
        <button className="search-btn" onClick={onClose} title="Esc">
          <Icon name="x" />
        </button>
      </div>
      {showReplace && (
        <div className="search-row">
          <input
            className="search-input"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder={t('replacePlaceholder')}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <button
            className="search-btn"
            disabled={!matches.length}
            onClick={() => { const m = matches[current]; if (m) onReplaceCurrent(m.start, m.end, replaceText); }}
          >
            {t('replace')}
          </button>
          <button className="search-btn" disabled={!matches.length} onClick={() => onReplaceAll(matches, replaceText)}>
            {t('replaceAll')}
          </button>
        </div>
      )}
      <div className="search-options">
        <label className="search-option"><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />{t('caseSensitive')}</label>
        <label className="search-option"><input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />{t('useRegex')}</label>
        <label className="search-option"><input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} />{t('wholeWord')}</label>
      </div>
    </div>
  );
}