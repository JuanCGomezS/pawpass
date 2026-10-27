export type IdentificationSettings = {
  location: boolean;
  phone: boolean;
  weight: boolean;
  sex: boolean;
  mapZoom: number;
  mapImage?: {
    url: string;
    latitude: number;
    longitude: number;
    photoUrl: string;
    zoom: number;
  };
};

export function readIdentificationSettings(
  value: unknown,
): IdentificationSettings {
  const data =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const zoom = data.mapZoom;
  const result: IdentificationSettings = {
    location: data.location === true,
    phone: data.phone === true,
    weight: data.weight === true,
    sex: data.sex === true,
    mapZoom:
      typeof zoom === "number" &&
      Number.isInteger(zoom) &&
      zoom >= 12 &&
      zoom <= 19
        ? zoom
        : 16,
  };
  const image = data.mapImage;
  if (image && typeof image === "object" && !Array.isArray(image)) {
    const map = image as Record<string, unknown>;
    if (
      Object.keys(map).length === 5 &&
      ["url", "latitude", "longitude", "photoUrl", "zoom"].every(
        (key) => key in map,
      ) &&
      typeof map.url === "string" &&
      /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?(\/[^ ]*)?$/.test(map.url) &&
      map.url.length <= 2048 &&
      typeof map.photoUrl === "string" &&
      /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?(\/[^ ]*)?$/.test(map.photoUrl) &&
      map.photoUrl.length <= 2048 &&
      typeof map.latitude === "number" &&
      Number.isFinite(map.latitude) &&
      Math.abs(map.latitude) <= 90 &&
      typeof map.longitude === "number" &&
      Number.isFinite(map.longitude) &&
      Math.abs(map.longitude) <= 180 &&
      typeof map.zoom === "number" &&
      Number.isInteger(map.zoom) &&
      map.zoom >= 12 &&
      map.zoom <= 19
    ) {
      result.mapImage = {
        url: map.url,
        latitude: map.latitude,
        longitude: map.longitude,
        photoUrl: map.photoUrl,
        zoom: map.zoom,
      };
    }
  }
  return result;
}
