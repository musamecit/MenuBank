/** Tek kaynak: mekan / menü akışındaki cuisine_primary slug'ları */
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

/** Keşfet → Listeler kartlarında kullanılan ek slug'lar */
const VENUE_CATEGORIES_EXTRA_FOR_LISTS: { slug: string; labelTr: string }[] = [
  { slug: 'fastfood', labelTr: 'Fast Food' },
  { slug: 'bistro', labelTr: 'Bistro & Lounge' },
  { slug: 'coffee', labelTr: 'Kahveciler' },
  { slug: 'bakery', labelTr: 'Tatlı & Fırın' },
];

const adminCatBySlug = new Map<string, { slug: string; labelTr: string }>();
for (const c of VENUE_CATEGORIES) adminCatBySlug.set(c.slug, c);
for (const c of VENUE_CATEGORIES_EXTRA_FOR_LISTS) {
  if (!adminCatBySlug.has(c.slug)) adminCatBySlug.set(c.slug, c);
}

/** Admin restoran kategorisi + Keşfet listeleri ile uyumlu tüm venue slug'ları */
export const ADMIN_VENUE_CATEGORIES: { slug: string; labelTr: string }[] = Array.from(adminCatBySlug.values()).sort((a, b) =>
  a.labelTr.localeCompare(b.labelTr, 'tr'),
);

/** DB / eski cuisine_primary metinlerinden uygulama slug'ına */
export function appSlugFromStoredCuisine(cuisine: string | null | undefined): string | null {
  if (cuisine == null || !String(cuisine).trim()) return null;
  const s = String(cuisine).trim();
  if (s === 'sokak-lezzetleri') return 'street_food';
  if (s === 'tatli') return 'dessert';
  if (s === 'diger') return 'other';
  return s;
}
