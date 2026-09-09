import type { Lang } from './i18n';

export interface ChangelogEntry {
  version: string;
  date: string;
  items: Record<Lang, string[]>;
}

// Tek kaynak: uygulama-içi "Yenilikler" penceresi buradan beslenir.
// Public CHANGELOG.md gerektiğinde bu listeden üretilir (çift kayıt yok).
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.2.18', date: '2026-09-09',
    items: {
      en: ['Search highlight no longer drifts on scrolled documents.'],
      tr: ['Arama vurgusu kaydırılmış belgelerde artık kaymıyor.'],
      de: ['Such-Hervorhebung verrutscht nicht mehr in gescrollten Dokumenten.'],
      fr: ['La surbrillance de recherche ne dérive plus dans les documents défilés.'],
      es: ['El resaltado de búsqueda ya no se desplaza en documentos con scroll.'],
    },
  },
  {
    version: '0.2.17', date: '2026-09-09',
    items: {
      en: ['Revamped find & replace: styled panel, all-match highlighting, cursor no longer jumps while typing.'],
      tr: ['Bul/değiştir yenilendi: şık panel, tüm eşleşmeler vurgulu, yazarken imleç zıplamıyor.'],
      de: ['Suchen & Ersetzen überarbeitet: gestaltetes Panel, alle Treffer markiert, Cursor springt nicht mehr.'],
      fr: ['Recherche/remplacement repensés : panneau stylé, tous les résultats surlignés, curseur stable.'],
      es: ['Buscar/reemplazar renovado: panel con estilo, todas las coincidencias resaltadas, cursor estable.'],
    },
  },
  {
    version: '0.2.16', date: '2026-09-09',
    items: {
      en: ['Fixed Ctrl+Shift+Z (redo) never firing.'],
      tr: ['Hiç çalışmayan Ctrl+Shift+Z (ileri al) düzeltildi.'],
      de: ['Strg+Umschalt+Z (Wiederherstellen) funktioniert wieder.'],
      fr: ['Ctrl+Maj+Z (rétablir) fonctionne à nouveau.'],
      es: ['Ctrl+Mayús+Z (rehacer) funciona de nuevo.'],
    },
  },
  {
    version: '0.2.15', date: '2026-09-09',
    items: {
      en: ['Graph view overhaul: links render again, click to select, double-click to open, proper SVG/PNG export.'],
      tr: ['Grafik görünümü elden geçti: bağlantılar görünüyor, tıkla-seç, çift tıkla-aç, düzgün SVG/PNG dışa aktarma.'],
      de: ['Graphansicht überholt: Verbindungen sichtbar, Klick zum Auswählen, Doppelklick zum Öffnen, SVG/PNG-Export.'],
      fr: ['Vue graphe révisée : liens visibles, clic pour sélectionner, double-clic pour ouvrir, export SVG/PNG.'],
      es: ['Vista de grafo renovada: enlaces visibles, clic para seleccionar, doble clic para abrir, exportar SVG/PNG.'],
    },
  },
  {
    version: '0.2.14', date: '2026-09-09',
    items: {
      en: ['Fixed broken settings (gear) icon and stretched version badge in Settings footer.'],
      tr: ['Bozuk ayarlar (çark) ikonu ve Ayarlar altındaki uzamış sürüm çerçevesi düzeltildi.'],
      de: ['Defektes Einstellungs-Symbol und gedehntes Versions-Badge korrigiert.'],
      fr: ['Icône paramètres cassée et badge de version étiré corrigés.'],
      es: ['Icono de ajustes roto e insignia de versión estirada corregidos.'],
    },
  },
  {
    version: '0.2.13', date: '2026-09-09',
    items: {
      en: ['Toolbar no longer squeezes the settings button on narrow windows.'],
      tr: ['Dar pencerelerde araç çubuğu ayarlar butonunu artık ezmiyor.'],
      de: ['Symbolleiste quetscht die Einstellungsschaltfläche nicht mehr.'],
      fr: ['La barre d’outils n’écrase plus le bouton paramètres.'],
      es: ['La barra ya no aplasta el botón de ajustes en ventanas estrechas.'],
    },
  },
  {
    version: '0.2.12', date: '2026-09-05',
    items: {
      en: ['Version badge in toolbar and Settings; fully offline (no CDN); editor toolbar styles.'],
      tr: ['Araç çubuğu ve Ayarlar’da sürüm rozeti; tam çevrimdışı; editör araç çubuğu stilleri.'],
      de: ['Versions-Badge in Symbolleiste und Einstellungen; komplett offline; Editor-Stile.'],
      fr: ['Badge de version dans la barre d’outils et les paramètres ; 100 % hors ligne.'],
      es: ['Insignia de versión en la barra y ajustes; totalmente sin conexión.'],
    },
  },
  {
    version: '0.2.11', date: '2026-09-03',
    items: {
      en: ['Undo/redo system, find & replace, formatting toolbar, Lucide icons.'],
      tr: ['Geri/ileri al, bul/değiştir, biçimlendirme araç çubuğu, Lucide ikonları.'],
      de: ['Rückgängig/Wiederherstellen, Suchen & Ersetzen, Formatierungsleiste, Lucide-Icons.'],
      fr: ['Annuler/rétablir, rechercher/remplacer, barre de mise en forme, icônes Lucide.'],
      es: ['Deshacer/rehacer, buscar/reemplazar, barra de formato, iconos Lucide.'],
    },
  },
  {
    version: '0.2.10', date: '2026-09-03',
    items: {
      en: ['Stylesheet rewrite, dark-mode dropdown fixes, graph stability and performance.'],
      tr: ['Stil dosyası baştan yazıldı, koyu mod menü düzeltmeleri, grafik kararlılığı ve hızı.'],
      de: ['Stylesheet neu geschrieben, Dark-Mode-Fixes, Graph-Stabilität und -Tempo.'],
      fr: ['Feuille de style réécrite, correctifs mode sombre, stabilité du graphe.'],
      es: ['Hoja de estilos reescrita, correcciones de modo oscuro, estabilidad del grafo.'],
    },
  },
  {
    version: '0.2.9', date: '2026-09-02',
    items: {
      en: ['Calendar toggle (Ctrl+Shift+C), sidebar search focus (Ctrl+F), Settings readability.'],
      tr: ['Takvim aç/kapat (Ctrl+Shift+C), kenar çubuğu arama odağı (Ctrl+F), Ayarlar okunabilirliği.'],
      de: ['Kalender-Umschalter, Sidebar-Suchfokus, bessere Lesbarkeit der Einstellungen.'],
      fr: ['Bascule du calendrier, focus de recherche, lisibilité des paramètres.'],
      es: ['Alternar calendario, foco de búsqueda, legibilidad de ajustes.'],
    },
  },
  {
    version: '0.2.8', date: '2026-09-02',
    items: {
      en: ['Interface in 5 languages (TR/EN/DE/FR/ES) with auto-detection.'],
      tr: ['Arayüz 5 dilde (TR/EN/DE/FR/ES), otomatik algılamalı.'],
      de: ['Oberfläche in 5 Sprachen mit Auto-Erkennung.'],
      fr: ['Interface en 5 langues avec détection auto.'],
      es: ['Interfaz en 5 idiomas con detección automática.'],
    },
  },
  {
    version: '0.2.7', date: '2026-08-31',
    items: {
      en: ['Daily notes & calendar, vault path memory, configurable folders.'],
      tr: ['Günlük notlar ve takvim, vault yolu hafızası, ayarlanabilir klasörler.'],
      de: ['Tagesnotizen & Kalender, Vault-Pfad wird gemerkt, konfigurierbare Ordner.'],
      fr: ['Notes quotidiennes et calendrier, chemin du vault mémorisé.'],
      es: ['Notas diarias y calendario, ruta del vault recordada.'],
    },
  },
  {
    version: '0.2.0–0.2.6', date: '2026-08',
    items: {
      en: ['Graph view, KaTeX math, transparency & opacity, themes, logo, backlinks, custom vault dialog.'],
      tr: ['Grafik görünümü, KaTeX matematik, şeffaflık, temalar, logo, backlinkler, özel vault penceresi.'],
      de: ['Graphansicht, KaTeX-Mathematik, Transparenz, Designs, Logo, Backlinks.'],
      fr: ['Vue graphe, maths KaTeX, transparence, thèmes, logo, backlinks.'],
      es: ['Vista de grafo, matemáticas KaTeX, transparencia, temas, logo, backlinks.'],
    },
  },
];
