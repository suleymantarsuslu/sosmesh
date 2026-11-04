import { Injectable, Logger } from '@nestjs/common';

export type RegionArea = {
  osmId: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  boundingBox: [number, number, number, number];
};

class SimpleCache<K, V> {
  private cache = new Map<K, { value: V; expires: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(options: { max: number; ttl: number }) {
    this.maxSize = options.max;
    this.ttl = options.ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { value, expires: Date.now() + this.ttl });
  }
}

type NominatimResult = {
  place_id: number;
  osm_type: string;
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
};

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'SOSMesh/1.0 (Emergency Coordination System)';
const RATE_LIMIT_MS = 1100;

@Injectable()
export class RegionsService {
  private readonly logger = new Logger(RegionsService.name);
  private readonly cache = new SimpleCache<string, RegionArea[]>({ max: 500, ttl: 1000 * 60 * 60 });
  private lastRequestTime = 0;

  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
    return fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
  }

  async getCountries(): Promise<RegionArea[]> {
    return [
      {
        osmId: 'relation/174737',
        name: 'Türkiye',
        displayName: 'Türkiye',
        lat: 39.0,
        lon: 35.0,
        boundingBox: [36.0, 42.0, 26.0, 45.0],
      },
    ];
  }

  async getProvinces(countryOsmId: string): Promise<RegionArea[]> {
    const cacheKey = `provinces:${countryOsmId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (countryOsmId === 'relation/174737') {
      const provinces: RegionArea[] = TURKEY_PROVINCES.map((p) => ({
        osmId: `province:${p.code}`,
        name: p.name,
        displayName: p.name,
        lat: p.lat,
        lon: p.lon,
        boundingBox: [p.boundingBox[0], p.boundingBox[1], p.boundingBox[2], p.boundingBox[3]] as [number, number, number, number],
      }));
      this.cache.set(cacheKey, provinces);
      return provinces;
    }

    return [];
  }

  async getDistricts(provinceOsmId: string): Promise<RegionArea[]> {
    const cacheKey = `districts:${provinceOsmId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const provinceCode = provinceOsmId.replace('province:', '');
    const province = TURKEY_PROVINCES.find((p) => p.code === provinceCode);
    if (!province) {
      return [];
    }

    try {
      const url = `${NOMINATIM_BASE}/search?` +
        `q=${encodeURIComponent(province.name)}&` +
        `country=TR&` +
        `addressdetails=1&` +
        `format=json&` +
        `limit=100`;

      const res = await this.rateLimitedFetch(url);
      if (!res.ok) {
        this.logger.warn(`Nominatim returned ${res.status} for districts of ${province.name}`);
        return [];
      }

      const data = (await res.json()) as NominatimResult[];
      const districts = data
        .filter((item) => item.osm_type === 'relation' || item.osm_type === 'way')
        .map((item) => ({
          osmId: `${item.osm_type}/${item.osm_id}`,
          name: item.display_name.split(',')[0].trim(),
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          boundingBox: item.boundingbox.map((v) => parseFloat(v)) as [number, number, number, number],
        }));

      this.cache.set(cacheKey, districts);
      return districts;
    } catch (err) {
      this.logger.error(`Failed to fetch districts for ${province.name}`, err);
      return [];
    }
  }

  async getNeighborhoods(districtName: string, provinceName: string): Promise<RegionArea[]> {
    const cacheKey = `neighborhoods:${provinceName}:${districtName}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${NOMINATIM_BASE}/search?` +
        `q=${encodeURIComponent(districtName + ', ' + provinceName)}&` +
        `country=TR&` +
        `addressdetails=1&` +
        `format=json&` +
        `limit=100`;

      const res = await this.rateLimitedFetch(url);
      if (!res.ok) {
        this.logger.warn(`Nominatim returned ${res.status} for neighborhoods of ${districtName}`);
        return [];
      }

      const data = (await res.json()) as NominatimResult[];
      const neighborhoods = data
        .filter((item) => item.display_name.toLowerCase().includes('mahalle'))
        .map((item) => ({
          osmId: `${item.osm_type}/${item.osm_id}`,
          name: item.display_name.split(',')[0].trim(),
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          boundingBox: item.boundingbox.map((v) => parseFloat(v)) as [number, number, number, number],
        }));

      this.cache.set(cacheKey, neighborhoods);
      return neighborhoods;
    } catch (err) {
      this.logger.error(`Failed to fetch neighborhoods for ${districtName}`, err);
      return [];
    }
  }

  async getStreets(neighborhoodName: string, districtName: string, provinceName: string): Promise<RegionArea[]> {
    const cacheKey = `streets:${provinceName}:${districtName}:${neighborhoodName}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${NOMINATIM_BASE}/search?` +
        `q=${encodeURIComponent(neighborhoodName + ', ' + districtName + ', ' + provinceName)}&` +
        `country=TR&` +
        `addressdetails=1&` +
        `format=json&` +
        `limit=100`;

      const res = await this.rateLimitedFetch(url);
      if (!res.ok) {
        this.logger.warn(`Nominatim returned ${res.status} for streets of ${neighborhoodName}`);
        return [];
      }

      const data = (await res.json()) as NominatimResult[];
      const streets = data
        .filter((item) => item.display_name.toLowerCase().includes('sokak') || item.display_name.toLowerCase().includes('cadde'))
        .map((item) => ({
          osmId: `${item.osm_type}/${item.osm_id}`,
          name: item.display_name.split(',')[0].trim(),
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          boundingBox: item.boundingbox.map((v) => parseFloat(v)) as [number, number, number, number],
        }));

      this.cache.set(cacheKey, streets);
      return streets;
    } catch (err) {
      this.logger.error(`Failed to fetch streets for ${neighborhoodName}`, err);
      return [];
    }
  }

  computeRadiusKm(boundingBox: [number, number, number, number]): number {
    const [minLat, maxLat, minLon, maxLon] = boundingBox;
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;
    const latKm = latDiff * 111.32;
    const lonKm = lonDiff * 111.32 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
    const diagonal = Math.sqrt(latKm * latKm + lonKm * lonKm);
    const radius = diagonal / 2;
    const min = 0.3;
    const max = 500;
    return Math.max(min, Math.min(max, radius));
  }
}

const TURKEY_PROVINCES = [
  { code: '01', name: 'Adana', lat: 37.0, lon: 35.3213, boundingBox: [36.5, 37.5, 34.5, 36.2] },
  { code: '06', name: 'Ankara', lat: 39.9334, lon: 32.8597, boundingBox: [39.5, 40.5, 32.0, 33.5] },
  { code: '34', name: 'İstanbul', lat: 41.0082, lon: 28.9784, boundingBox: [40.8, 41.3, 28.5, 29.5] },
  { code: '35', name: 'İzmir', lat: 38.4237, lon: 27.1428, boundingBox: [38.0, 39.0, 26.5, 28.0] },
  { code: '02', name: 'Adıyaman', lat: 37.7648, lon: 38.2772, boundingBox: [37.5, 38.0, 37.5, 39.0] },
  { code: '03', name: 'Afyonkarahisar', lat: 38.7507, lon: 30.5567, boundingBox: [38.0, 39.5, 29.5, 31.5] },
  { code: '04', name: 'Ağrı', lat: 39.7191, lon: 43.0503, boundingBox: [39.0, 40.5, 42.0, 44.0] },
  { code: '05', name: 'Amasya', lat: 40.6499, lon: 35.8353, boundingBox: [40.0, 41.0, 35.0, 36.5] },
  { code: '07', name: 'Antalya', lat: 36.8969, lon: 30.7133, boundingBox: [36.0, 37.5, 29.5, 32.5] },
  { code: '08', name: 'Artvin', lat: 41.1828, lon: 41.8183, boundingBox: [40.5, 41.5, 41.0, 42.5] },
  { code: '09', name: 'Aydın', lat: 37.8560, lon: 27.8416, boundingBox: [37.0, 38.5, 27.0, 29.0] },
  { code: '10', name: 'Balıkesir', lat: 39.6484, lon: 27.8826, boundingBox: [39.0, 40.5, 26.5, 29.0] },
];
