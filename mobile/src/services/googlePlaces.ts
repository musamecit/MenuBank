import { GOOGLE_PLACES_API_KEY } from '../config/env';

interface PlacePrediction {
  placeId: string;
  displayName: string;
  formattedAddress: string;
}

interface PlaceDetail {
  id: string;
  displayName: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  photos?: { name: string }[];
  rating?: number;
  userRatingCount?: number;
}

const BASE = 'https://places.googleapis.com/v1';

export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
  if (!query.trim()) return [];
  if (!GOOGLE_PLACES_API_KEY) return [];

  try {
    const res = await fetch(`${BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'tr',
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const places = data.places ?? [];
    
    return places.map((p: any) => ({
      placeId: p.id,
      displayName: p.displayName?.text ?? '',
      formattedAddress: p.formattedAddress ?? '',
    }));
  } catch (error) {
    console.error('searchPlaces Error:', error);
    return [];
  }
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetail | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  const path = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
  
  try {
    const res = await fetch(`${BASE}/${path}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,photos,rating,userRatingCount',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data as PlaceDetail;
  } catch (error) {
    console.error('getPlaceDetails Error:', error);
    return null;
  }
}

