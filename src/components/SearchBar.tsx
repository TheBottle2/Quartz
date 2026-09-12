import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { findFoldedMatches } from '../utils/search';
import type { TFunc } from '../i18n';

export interface SearchMatch { start: number; end: number; }

interface SearchBarProps {
  content: string;
  onClose: () => void;
  onSelect: (start: number, end: number) => void;
  onReplaceCurrent: (start: number, end: number, replacement: string) => void;
  onReplaceAll: (matches: SearchMatch[], replacement: string) => void;
  onMatchesChange: (info: { query: string; matches: SearchMatch[]; current: number }) => void;
  t: TFunc;
}

export function SearchBar({ content, onClose, onSelect, onReplaceCurrent, onReplaceAll, onMatchesChange, t }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [current, setCurrent] = useState(0);
  // Artar: kullanıcı Enter/ok ile gezindiğinde. Yazarken imleci oynatmamak
  // için seçim SADECE bu sayaç değişince yapılır.
  const [nav, setNav] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const matches = useMemo<SearchMatch[]>(() => {
    if (!query) return [];
    // Düz metin + duyarsız: katlamalı arama (Türkçe-İ güvenli, indisler orijinal metne ait).
    if (!useRegex && !wholeWord && !caseSensitive) return findFoldedMatches(content, query);
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

  // Vurgu katmanını besle (seçim YAPMAZ — yazarken imleç zıplamasın).
  useEffect(() => {
    onMatchesChange({ query, matches, current });
  }, [query, matches, current, onMatchesChange]);

  // İmleç SADECE gezinince oynar.
  useEffect(() => {
    if (nav === 0) return;
    const m = matches[current];
    if (m) onSelect(m.start, m.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  const goNext = () => {
    if (!matches.length) return;
    if (nav === 0) { setNav(1); return; } // ilk adım: mevcut eşleşmeyi seç
    setCurrent((current + 1) % matches.length); setNav((n) => n + 1);
  };
  const goPrev = () => {
    if (!matches.length) return;
    if (nav === 0) { setCurrent(matches.length - 1); setNav(1); return; } // ilk adım: son eşleşme
    setCurrent((current - 1 + matches.length) % matches.length); setNav((n) => n + 1);
  };
  const resetNav = () => { setCurrent(0); setNav(0); };

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
          onChange={(e) => { setQuery(e.target.value); resetNav(); }}
          placeholder={t('searchPlaceholder')}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') { onClose(); return; }
            // İlk Enter mevcut eşleşmeyi seçer, sonrakiler ilerler.
            if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? goPrev() : (nav === 0 ? setNav(1) : goNext()); }
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
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') { onClose(); return; }
              if (e.key === 'Enter') { e.preventDefault(); const m = matches[current]; if (m) onReplaceCurrent(m.start, m.end, replaceText); }
            }}
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
        <label className="search-option"><input type="checkbox" checked={caseSensitive} onChange={(e) => { setCaseSensitive(e.target.checked); resetNav(); }} />{t('caseSensitive')}</label>
        <label className="search-option"><input type="checkbox" checked={useRegex} onChange={(e) => { setUseRegex(e.target.checked); resetNav(); }} />{t('useRegex')}</label>
        <label className="search-option"><input type="checkbox" checked={wholeWord} onChange={(e) => { setWholeWord(e.target.checked); resetNav(); }} />{t('wholeWord')}</label>
      </div>
    </div>
  );
}