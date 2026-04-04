/**
 * Tek kaynak: Filtre, Menü Ekle, restoran detay (yönetici kategori), Keşfet → Listeler kartları.
 * cuisine_primary / category_slug değerleri bu slug listesi ile uyumlu olmalı.
 */
export const VENUE_CATEGORIES: { slug: string; labelTr: string }[] = [
  { slug: 'balikci', labelTr: 'Balıkçı' },
  { slug: 'bar', labelTr: 'Bar' },
  { slug: 'beach', labelTr: 'Plaj' },
  { slug: 'burger', labelTr: 'Burger' },
  { slug: 'cafe', labelTr: 'Cafe' },
  { slug: 'meyhane', labelTr: 'Meyhane' },
  { slug: 'nargile', labelTr: 'Nargile' },
  { slug: 'pizza', labelTr: 'Pizza' },
  { slug: 'restaurant', labelTr: 'Restoran' },
  { slug: 'street_food', labelTr: 'Sokak lezzetleri' },
  { slug: 'dessert', labelTr: 'Tatlı' },
  { slug: 'other', labelTr: 'Diğer' },
];

/** @deprecated Aynı liste; eski importlar kırılmasın diye alias. */
export const ADMIN_VENUE_CATEGORIES = VENUE_CATEGORIES;

/** Keşfet → Listeler kategori kartları (sıra VENUE_CATEGORIES ile aynı). */
export const VENUE_CATEGORY_CARD_COLORS = [
  '#0277BD',
  '#2196F3',
  '#00BCD4',
  '#FF9800',
  '#795548',
  '#9C27B0',
  '#673AB7',
  '#F44336',
  '#4CAF50',
  '#E91E63',
  '#009688',
  '#607D8B',
];

/** Eski DB cuisine_primary slug → Türkçe (sadece metin gösterimi). */
const LEGACY_CUISINE_LABELS: Record<string, string> = {
  fastfood: 'Fast Food',
  bistro: 'Bistro & Lounge',
  coffee: 'Kahveciler',
  bakery: 'Tatlı & Fırın',
};

/** DB / eski cuisine_primary metinlerinden uygulama slug'ına */
export function appSlugFromStoredCuisine(cuisine: string | null | undefined): string | null {
  if (cuisine == null || !String(cuisine).trim()) return null;
  const s = String(cuisine).trim();
  if (s === 'sokak-lezzetleri') return 'street_food';
  if (s === 'tatli') return 'dessert';
  if (s === 'diger') return 'other';
  return s;
}

/** Üstteki satırda ham slug yerine okunaklı Türkçe (legacy slug'lar dahil). */
export function venueCategoryDisplayLabelTr(cuisine: string | null | undefined): string {
  if (cuisine == null || !String(cuisine).trim()) return '';
  const raw = String(cuisine).trim();
  const slug = appSlugFromStoredCuisine(raw) ?? raw;
  const row = VENUE_CATEGORIES.find((c) => c.slug === slug);
  if (row) return row.labelTr;
  return LEGACY_CUISINE_LABELS[slug] ?? raw;
}
