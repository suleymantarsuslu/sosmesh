import { Injectable, Logger } from '@nestjs/common';
import staticRegionsData from './static-regions.json';
import neighborhoodsData from './neighborhoods.json';

export type RegionArea = {
  osmId: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  boundingBox: [number, number, number, number];
};

export type RegionError = {
  code: 'OVERPASS_UNAVAILABLE' | 'TIMEOUT' | 'RATE_LIMITED' | 'NETWORK_ERROR';
  messageEN: string;
  messageTR: string;
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

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'SOSMesh/1.0 (+https://sosmesh.antiosoft.com)';
const OVERPASS_TIMEOUT_MS = 45000;
const SUCCESS_CACHE_TTL = 1000 * 60 * 60 * 24;
const FAILURE_CACHE_TTL = 1000 * 60;

type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
};

type OverpassResponse = {
  elements: OverpassElement[];
};

@Injectable()
export class RegionsService {
  private readonly logger = new Logger(RegionsService.name);
  private readonly successCache = new SimpleCache<string, RegionArea[]>({ max: 500, ttl: SUCCESS_CACHE_TTL });
  private readonly failureCache = new SimpleCache<string, RegionError>({ max: 100, ttl: FAILURE_CACHE_TTL });
  private lastRequestTime = 0;
  private staticRegions = staticRegionsData;

  private async overpassQueryWithFallback(query: string): Promise<OverpassResponse> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < 1100) {
      await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
    }
    this.lastRequestTime = Date.now();

    let lastError: Error | null = null;

    for (const mirror of OVERPASS_MIRRORS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

      try {
        this.logger.log(`Trying Overpass mirror: ${mirror}`);
        const res = await fetch(mirror, {
          method: 'POST',
          headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.status === 429) {
          this.logger.warn(`Mirror ${mirror} rate-limited (429)`);
          lastError = new Error('RATE_LIMITED');
          continue;
        }

        if (res.status >= 500) {
          this.logger.warn(`Mirror ${mirror} server error (${res.status})`);
          lastError = new Error('SERVER_ERROR');
          continue;
        }

        if (!res.ok) {
          this.logger.warn(`Mirror ${mirror} returned ${res.status}`);
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }

        const text = await res.text();
        let data: OverpassResponse;
        try {
          data = JSON.parse(text);
        } catch {
          this.logger.warn(`Mirror ${mirror} returned non-JSON`);
          lastError = new Error('INVALID_JSON');
          continue;
        }

        this.logger.log(`Successfully fetched from ${mirror}`);
        return data;
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          this.logger.warn(`Mirror ${mirror} timed out`);
          lastError = new Error('TIMEOUT');
        } else {
          this.logger.warn(`Mirror ${mirror} network error: ${err.message}`);
          lastError = err;
        }
      }
    }

    const errorMessage = lastError?.message || 'UNKNOWN';
    if (errorMessage.includes('TIMEOUT') || lastError?.name === 'AbortError') {
      throw Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' });
    }
    if (errorMessage.includes('RATE_LIMITED')) {
      throw Object.assign(new Error('RATE_LIMITED'), { code: 'RATE_LIMITED' });
    }
    throw Object.assign(new Error('OVERPASS_UNAVAILABLE'), { code: 'OVERPASS_UNAVAILABLE' });
  }

  async getCountries(): Promise<RegionArea[]> {
    return [
      {
        osmId: 'relation/174737',
        name: 'Türkiye',
        displayName: 'Türkiye',
        lat: 39.0,
        lon: 35.0,
        boundingBox: [35.8, 42.1, 25.7, 44.8],
      },
    ];
  }

  async getProvinces(countryOsmId: string): Promise<RegionArea[]> {
    if (countryOsmId !== 'relation/174737') {
      return [];
    }

    return this.staticRegions.provinces.map((p) => ({
      osmId: p.osmId,
      name: p.name,
      displayName: p.name,
      lat: p.lat,
      lon: p.lon,
      boundingBox: p.boundingBox as [number, number, number, number],
    }));
  }

  async getDistricts(provinceOsmId: string): Promise<RegionArea[]> {
    return this.staticRegions.districts
      .filter((d) => d.parentId === provinceOsmId)
      .map((d) => ({
        osmId: d.osmId,
        name: d.name,
        displayName: d.name,
        lat: d.lat,
        lon: d.lon,
        boundingBox: d.boundingBox as [number, number, number, number],
      }));
  }

  async getNeighborhoods(districtOsmId: string): Promise<RegionArea[] | RegionError> {
    const cacheKey = `neighborhoods:${districtOsmId}`;
    
    const cachedSuccess = this.successCache.get(cacheKey);
    if (cachedSuccess) {
      return cachedSuccess;
    }

    const cachedFailure = this.failureCache.get(cacheKey);
    if (cachedFailure) {
      return cachedFailure;
    }

    // Check if this is a static geoBoundaries district ID
    const isStaticDistrict = !districtOsmId.match(/^relation\/\d+$/);
    
    if (isStaticDistrict) {
      // Load from static neighborhoods data
      const neighborhoods = (neighborhoodsData.neighborhoods as any)[districtOsmId] || [];
      const result: RegionArea[] = neighborhoods.map((n: any) => ({
        osmId: n.osmId,
        name: n.name,
        displayName: n.name,
        lat: n.lat,
        lon: n.lon,
        boundingBox: n.boundingBox as [number, number, number, number],
      }))
        // Some OSM features are tagged with a placeholder name like "mahalle"; drop those.
        .filter((n: RegionArea) => !/^mahalle(si)?$/i.test(n.name.trim()))
        .sort((a: RegionArea, b: RegionArea) => a.name.localeCompare(b.name, 'tr'));

      this.successCache.set(cacheKey, result);
      return result;
    }

    // Legacy path: OSM relation IDs via Overpass
    const match = districtOsmId.match(/^relation\/(\d+)$/);
    if (!match) {
      const error: RegionError = {
        code: 'NETWORK_ERROR',
        messageEN: 'Invalid district ID',
        messageTR: 'Geçersiz ilçe ID',
      };
      this.failureCache.set(cacheKey, error);
      return error;
    }

    const idStr = match[1];
    const areaId = 3600000000 + parseInt(idStr, 10);

    try {
      const query = `
        [out:json][timeout:40];
        area(${areaId})->.a;
        (
          rel(area.a)[boundary=administrative][admin_level=8];
          node(area.a)[place~"neighbourhood|quarter"];
        );
        out tags center bb;
      `;

      const data = await this.overpassQueryWithFallback(query);
      const neighborhoods: RegionArea[] = data.elements
        .filter((el) => el.tags?.name)
        .map((el) => {
          let lat = 0, lon = 0;
          let boundingBox: [number, number, number, number] = [0, 0, 0, 0];

          if (el.type === 'relation' && el.center && el.bounds) {
            lat = el.center.lat;
            lon = el.center.lon;
            boundingBox = [el.bounds.minlat, el.bounds.maxlat, el.bounds.minlon, el.bounds.maxlon];
          } else if (el.type === 'node') {
            lat = (el as any).lat || 0;
            lon = (el as any).lon || 0;
            const delta = 0.01;
            boundingBox = [lat - delta, lat + delta, lon - delta, lon + delta];
          } else {
            return null;
          }

          return {
            osmId: `${el.type}/${el.id}`,
            name: el.tags!.name,
            displayName: el.tags!.name,
            lat,
            lon,
            boundingBox,
          };
        })
        .filter((n): n is RegionArea => n !== null)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

      this.successCache.set(cacheKey, neighborhoods);
      return neighborhoods;
    } catch (err: any) {
      this.logger.error(`Failed to fetch neighborhoods for ${districtOsmId}`, err);
      
      const error: RegionError = {
        code: err.code || 'OVERPASS_UNAVAILABLE',
        messageEN: 
          err.code === 'TIMEOUT' ? 'Request timed out. Please try again.' :
          err.code === 'RATE_LIMITED' ? 'Service temporarily unavailable due to rate limits.' :
          'OpenStreetMap service temporarily unavailable.',
        messageTR:
          err.code === 'TIMEOUT' ? 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.' :
          err.code === 'RATE_LIMITED' ? 'Hizmet geçici olarak kullanılamıyor (oran limiti).' :
          'OpenStreetMap hizmeti geçici olarak kullanılamıyor.',
      };
      
      this.failureCache.set(cacheKey, error);
      return error;
    }
  }

  async getStreets(neighborhoodOsmId: string): Promise<RegionArea[] | RegionError> {
    const cacheKey = `streets:${neighborhoodOsmId}`;
    
    const cachedSuccess = this.successCache.get(cacheKey);
    if (cachedSuccess) {
      return cachedSuccess;
    }

    const cachedFailure = this.failureCache.get(cacheKey);
    if (cachedFailure) {
      return cachedFailure;
    }

    // Check if this is a relation/node ID
    const match = neighborhoodOsmId.match(/^(relation|node)\/(\d+)$/);
    
    if (!match) {
      // Not a standard OSM ID - return empty array (street is optional)
      const emptyResult: RegionArea[] = [];
      this.successCache.set(cacheKey, emptyResult);
      return emptyResult;
    }

    const [, type, idStr] = match;
    let areaId: number;

    if (type === 'relation') {
      areaId = 3600000000 + parseInt(idStr, 10);
    } else if (type === 'node') {
      areaId = 3400000000 + parseInt(idStr, 10);
    } else {
      const error: RegionError = {
        code: 'NETWORK_ERROR',
        messageEN: 'Invalid neighborhood type',
        messageTR: 'Geçersiz mahalle tipi',
      };
      this.failureCache.set(cacheKey, error);
      return error;
    }

    try {
      const query = `
        [out:json][timeout:40];
        area(${areaId})->.a;
        way(area.a)[highway][name];
        out tags center bb;
      `;

      const data = await this.overpassQueryWithFallback(query);
      
      const streetMap = new Map<string, { ways: OverpassElement[]; minlat: number; maxlat: number; minlon: number; maxlon: number }>();
      
      for (const el of data.elements) {
        if (!el.tags?.name || !el.center || !el.bounds) {
          continue;
        }
        
        const name = el.tags.name;
        if (!streetMap.has(name)) {
          streetMap.set(name, { ways: [], minlat: el.bounds.minlat, maxlat: el.bounds.maxlat, minlon: el.bounds.minlon, maxlon: el.bounds.maxlon });
        }
        
        const entry = streetMap.get(name)!;
        entry.ways.push(el);
        entry.minlat = Math.min(entry.minlat, el.bounds.minlat);
        entry.maxlat = Math.max(entry.maxlat, el.bounds.maxlat);
        entry.minlon = Math.min(entry.minlon, el.bounds.minlon);
        entry.maxlon = Math.max(entry.maxlon, el.bounds.maxlon);
      }

      const streets: RegionArea[] = Array.from(streetMap.entries())
        .map(([name, { ways, minlat, maxlat, minlon, maxlon }]) => {
          const centerLat = (minlat + maxlat) / 2;
          const centerLon = (minlon + maxlon) / 2;
          
          return {
            osmId: `way/${ways[0].id}`,
            name,
            displayName: name,
            lat: centerLat,
            lon: centerLon,
            boundingBox: [minlat, maxlat, minlon, maxlon] as [number, number, number, number],
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

      this.successCache.set(cacheKey, streets);
      return streets;
    } catch (err: any) {
      this.logger.error(`Failed to fetch streets for ${neighborhoodOsmId}`, err);
      
      const error: RegionError = {
        code: err.code || 'OVERPASS_UNAVAILABLE',
        messageEN: 
          err.code === 'TIMEOUT' ? 'Request timed out. Please try again.' :
          err.code === 'RATE_LIMITED' ? 'Service temporarily unavailable due to rate limits.' :
          'OpenStreetMap service temporarily unavailable.',
        messageTR:
          err.code === 'TIMEOUT' ? 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.' :
          err.code === 'RATE_LIMITED' ? 'Hizmet geçici olarak kullanılamıyor (oran limiti).' :
          'OpenStreetMap hizmeti geçici olarak kullanılamıyor.',
      };
      
      this.failureCache.set(cacheKey, error);
      return error;
    }
  }

  computeRadiusKm(boundingBox: [number, number, number, number]): number {
    const [minLat, maxLat, minLon, maxLon] = boundingBox;
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;
    const latKm = latDiff * 111.32;
    const lonKm = lonDiff * 111.32 * Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
    const diagonal = Math.sqrt(latKm * latKm + lonKm * lonKm);
    const radius = diagonal / 2;
    return Math.max(0.3, Math.min(radius, 500));
  }
}
