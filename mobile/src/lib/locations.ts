import { supabase } from './supabase';

export interface Country {
  code: string;
  name: string;
}

export interface City {
  id: string;
  name: string;
}

export interface Area {
  id: string;
  name: string;
}

const COUNTRY_NAMES: Record<string, string> = { TR: 'Türkiye', US: 'ABD', GB: 'İngiltere', DE: 'Almanya' };

export async function fetchCountries(): Promise<Country[]> {
  try {
    const { data } = await supabase
      .from('countries')
      .select('code, name')
      .order('name', { ascending: true });
    if (data && data.length > 0) return data as Country[];
  } catch {}
  const { data } = await supabase
    .from('restaurants')
    .select('country_code')
    .eq('status', 'active')
    .is('deleted_at', null);
  const codes = [...new Set((data ?? []).map((r: { country_code: string }) => r.country_code).filter(Boolean))];
  return codes.map((code) => ({ code, name: COUNTRY_NAMES[code] ?? code }));
}

const cityIdToName = new Map<string, string>();

export async function fetchCities(countryCode: string): Promise<City[]> {
  if (!countryCode) return [];
  try {
    const { data } = await supabase
      .from('cities')
      .select('id, name')
      .eq('country_code', countryCode)
      .order('name', { ascending: true });
    if (data && data.length > 0) {
      (data as City[]).forEach((c) => cityIdToName.set(c.id, c.name));
      return data as City[];
    }
  } catch {}
  const { data } = await supabase
    .from('restaurants')
    .select('city_name')
    .eq('country_code', countryCode)
    .eq('status', 'active')
    .is('deleted_at', null);
  const names = [...new Set((data ?? []).map((r: { city_name: string }) => r.city_name).filter(Boolean))].sort();
  const result = names.map((name, i) => {
    const id = `city-${i}`;
    cityIdToName.set(id, name);
    return { id, name };
  });
  return result;
}

export async function fetchAreas(cityId: string): Promise<Area[]> {
  if (!cityId) return [];
  try {
    const { data } = await supabase
      .from('areas')
      .select('id, name')
      .eq('city_id', cityId)
      .order('name', { ascending: true });
    if (data && data.length > 0) return data as Area[];
  } catch {}
  const cityName = cityIdToName.get(cityId);
  if (!cityName) return [];
  const nameToUse = cityName;
  const { data } = await supabase
    .from('restaurants')
    .select('area_name')
    .eq('city_name', nameToUse)
    .eq('status', 'active')
    .is('deleted_at', null);
  const names = [...new Set((data ?? []).map((r: { area_name: string }) => r.area_name).filter(Boolean))].sort();
  return names.map((name, i) => ({ id: `area-${i}`, name }));
}

