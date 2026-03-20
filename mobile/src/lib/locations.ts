export interface Country {
  code: string;
  name: string;
}

export interface City {
  id: string; // state/province iso code or city name
  name: string;
}

export interface Area {
  id: string; // District/city name
  name: string;
}

let geoCache: any[] | null = null;
let cityIdToCountryCode = new Map<string, string>();

async function getGeoData() {
  if (!geoCache) {
    // Dynamically import to avoid blocking the initial JS thread
    const data = await import('./geoData.json');
    geoCache = data.default || data;
  }
  return geoCache!;
}

export async function fetchCountries(): Promise<Country[]> {
  const data = await getGeoData();
  return data.map((c: any) => ({ code: c.code, name: c.name }));
}

export async function fetchCities(countryCode: string): Promise<City[]> {
  if (!countryCode) return [];
  const data = await getGeoData();
  const country = data.find((c: any) => c.code === countryCode);
  if (!country || !country.cities) return [];

  return country.cities.map((city: any) => {
    cityIdToCountryCode.set(String(city.id), countryCode);
    return { id: String(city.id), name: city.name };
  });
}

export async function fetchAreas(cityIdRaw: string): Promise<Area[]> {
  if (!cityIdRaw) return [];
  const countryCode = cityIdToCountryCode.get(cityIdRaw);
  if (!countryCode) return []; // Cannot resolve without country context

  const data = await getGeoData();
  const country = data.find((c: any) => c.code === countryCode);
  if (!country || !country.cities) return [];

  const city = country.cities.find((c: any) => String(c.id) === cityIdRaw);
  if (!city || !city.areas || city.areas.length === 0) return [];

  return city.areas.map((area: string, index: number) => ({
    id: `area-${index}`,
    name: area
  }));
}

