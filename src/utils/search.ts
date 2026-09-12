export interface TextMatch { start: number; end: number; }

/**
 * Türkçe-İ güvenli katlama: İ/ı → i, sonra küçük harf.
 * Neden: `"İ".toLowerCase()` 2 birimlik "i̇" üretir; uzunluk bozulunca
 * `indexOf`/`split` ile bulunan indisler orijinal metne uymaz (ve ASCII
 * "iznik", "İznik" sorgusuyla hiç bulunamaz). Bu eşleme 1:1 uzunluk
 * korur, indisler orijinal metinde geçerlidir.
 */
export function foldCase(s: string): string {
  return s.replace(/İ/g, 'i').replace(/ı/g, 'i').toLowerCase();
}

/**
 * Düz-metin (regexsiz), büyük/küçük harf duyarsız isabet konumları.
 * Katlanmış metinde arar; katlama uzunluk koruduğu için indisler
 * ORİJİNAL metne aittir. Büyük/küçük harf + Türkçe-İ güvenlidir.
 */
export function findFoldedMatches(text: string, query: string, cap = 500): TextMatch[] {
  const out: TextMatch[] = [];
  if (!query) return out;
  const ft = foldCase(text);
  const fq = foldCase(query);
  if (ft.length !== text.length || fq.length !== query.length) return out; // güvenlik: uzunluk bozulduysa vazgeç
  let i = ft.indexOf(fq);
  while (i !== -1 && out.length < cap) {
    out.push({ start: i, end: i + fq.length });
    i = ft.indexOf(fq, i + 1);
  }
  return out;
}
