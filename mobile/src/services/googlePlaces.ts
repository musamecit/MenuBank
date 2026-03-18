import { GOOGLE_PLACES_API_KEY } from '../config/env';

const BASE = 'https://places.googleapis.com/v1';

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

export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
  if (!query.trim() || !GOOGLE_PLACES_API_KEY) return [];
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
      includedType: 'restaurant',
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.places ?? []).map((p: PlaceDetail) => ({
    placeId: p.id,
    displayName: p.displayName?.text ?? '',
    formattedAddress: p.formattedAddress ?? '',
  }));
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetail | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  const path = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
  const res = await fetch(`${BASE}/${path}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,photos,rating,userRatingCount',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export function getPhotoUrl(photoName: string, maxWidth = 800): string {
  return `${BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}`;
}
