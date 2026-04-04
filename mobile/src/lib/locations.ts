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

let geoCache: any[] | null = null;

async function getGeoData(): Promise<any[]> {
  if (!geoCache) {
    const data = await import('./geoData.json');
    geoCache = data.default || data;
  }
  return geoCache!;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Önce Supabase; boş / hata → geoData.json (tam şehir + ilçe listesi) */
export async function fetchCountries(): Promise<Country[]> {
  try {
    const { data, error } = await supabase.from('countries').select('code, name').order('name');
    if (!error && data && data.length > 0) return data as Country[];
  } catch (e) {
    console.warn('fetchCountries supabase', e);
  }
  const geo = await getGeoData();
  return geo.map((c: { code: string; name: string }) => ({ code: c.code, name: c.name }));
}

export async function fetchCities(countryCode: string): Promise<City[]> {
  const cc = countryCode?.trim().toUpperCase();
  if (!cc) return [];
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('id, name')
      .eq('country_code', cc)
      .order('name');
    if (!error && data && data.length > 0) {
      return data.map((c: { id: string; name: string }) => ({ id: String(c.id), name: c.name }));
    }
  } catch (e) {
    console.warn('fetchCities supabase', e);
  }
  const geo = await getGeoData();
  const country = geo.find((c: { code: string }) => c.code.toUpperCase() === cc);
  if (!country?.cities) return [];
  return country.cities.map((city: { id: string | number; name: string }) => ({
    id: String(city.id),
    name: city.name,
  }));
}

/** İlçeler: UUID şehirde önce areas tablosu; yoksa veya plaka id ise geoData */
export async function fetchAreas(countryCode: string, cityIdRaw: string): Promise<Area[]> {
  const cc = countryCode?.trim().toUpperCase();
  if (!cc || !cityIdRaw) return [];

  if (isUuid(cityIdRaw)) {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('id, name')
        .eq('city_id', cityIdRaw)
        .order('name');
      if (!error && data && data.length > 0) {
        return data.map((area: { id: string; name: string }) => ({
          id: String(area.id),
          name: area.name,
        }));
      }
      const { data: cityRow } = await supabase
        .from('cities')
        .select('name')
        .eq('id', cityIdRaw)
        .maybeSingle();
      const cityName = (cityRow as { name?: string } | null)?.name;
      if (cityName) {
        return areasFromGeoByCityName(cc, cityName);
      }
    } catch (e) {
      console.warn('fetchAreas supabase', e);
    }
  }

  const geo = await getGeoData();
  const country = geo.find((c: { code: string }) => c.code.toUpperCase() === cc);
  if (!country?.cities) return [];
  const city = country.cities.find((c: { id: string | number }) => String(c.id) === cityIdRaw);
  if (!city?.areas?.length) return [];
  return (city.areas as string[]).map((name: string, index: number) => ({
    id: `area-${index}`,
    name,
  }));
}

async function areasFromGeoByCityName(countryCodeUpper: string, cityName: string): Promise<Area[]> {
  const geo = await getGeoData();
  const country = geo.find((c: { code: string }) => c.code.toUpperCase() === countryCodeUpper);
  if (!country?.cities) return [];
  const city = country.cities.find(
    (c: { name: string }) => c.name.trim() === cityName.trim(),
  );
  if (!city?.areas?.length) return [];
  return (city.areas as string[]).map((name: string, index: number) => ({
    id: `area-${index}`,
    name,
  }));
}
