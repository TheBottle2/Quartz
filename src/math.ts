import katex from 'katex';

function renderTex(tex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return null;
  }
}

export function renderMathInHtml(html: string): string {
  const codeBlocks: string[] = [];
  let safe = html.replace(/<(?:code|pre)[^>]*>[\s\S]*?<\/(?:code|pre)>/g, (match) => {
    codeBlocks.push(match);
    return `\u0000MATHBLOCK${codeBlocks.length - 1}\u0000`;
  });

  // Display math: $$...$$ or \[...\]
  safe = safe.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g,
    (_m, dollarTex?: string, bracketTex?: string) => {
      const tex = (dollarTex ?? bracketTex ?? '').trim();
      if (!tex) return _m;
      return renderTex(tex, true) ?? _m;
    });

  // Inline math: $...$
  safe = safe.replace(/\$([^\s$][^$\n]*?)\$/g, (match, tex: string) =>
    renderTex(tex.trim(), false) ?? match);

  // \(...\) — ONLY escaped parentheses
  safe = safe.replace(/\\\(([\s\S]+?)\\\)/g, (match, tex: string) =>
    renderTex(tex.trim(), false) ?? match);

  safe = safe.replace(/\u0000MATHBLOCK(\d+)\u0000/g, (_m, i: string) =>
    codeBlocks[parseInt(i, 10)]);

  return safe;
}