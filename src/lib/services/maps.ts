/**
 * Maps integration architecture
 *
 * Currently works without keys:
 *  - Haversine distance (in auth.ts)
 *  - Open external Google Maps for navigation
 *
 * When you add a key, you can enable:
 *  - Static map images
 *  - Embed live map
 *  - Directions API
 *
 * Env:
 *   NEXT_PUBLIC_GOOGLE_MAPS_KEY=...
 *   NEXT_PUBLIC_MAPBOX_TOKEN=...
 */

export function hasGoogleMapsKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY)
}

export function hasMapboxToken(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
}

/** Deep link that opens Google Maps app / website – works without API key */
export function googleMapsNavUrl(lat: number, lng: number, label?: string): string {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving`
}

/** Static map image URL (requires Google Maps key) */
export function staticMapUrl(
  lat: number,
  lng: number,
  zoom = 15,
  width = 600,
  height = 300
): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!key) return null
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=color:green%7C${lat},${lng}&key=${key}`
}

/** Mapbox static image (requires token) */
export function mapboxStaticUrl(
  lat: number,
  lng: number,
  zoom = 14,
  width = 600,
  height = 300
): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return null
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+16a34a(${lng},${lat})/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${token}`
}
