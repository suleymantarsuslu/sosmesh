import { Injectable, Logger } from '@nestjs/common';
import staticRegions from './static-data/static-regions.json';
import neighborhoodsData from './static-data/neighborhoods.json';

export type RegionArea = {
  osmId: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  boundingBox: [number, number, number, number];
};

type ErrorResponse = {
  code: string;
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

type NominatimResult = {
  place_id: number;
  osm_type: string;
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
};

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'SOSMesh/1.0 (+https://sosmesh.antiosoft.com)';
const OVERPASS_TIMEOUT_MS = 60000;

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
  private readonly cache = new SimpleCache<string, RegionArea[]>({ max: 500, ttl: 1000 * 60 * 60 * 24 });
  private lastRequestTime = 0;
  private readonly requestQueue = Promise.resolve();

  private async overpassQuery(query: string): Promise<OverpassResponse> {
    await this.requestQueue;
    
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < 1100) {
      await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
    }
    this.lastRequestTime = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

    try {
      const res = await fetch(OVERPASS_API, {
        method: 'POST',
        headers: { 
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Overpass returned ${res.status}`);
      }

      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
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
    const cacheKey = `provinces:${countryOsmId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (countryOsmId !== 'relation/174737') {
      return [];
    }

    try {
      const query = `
        [out:json][timeout:50];
        area["ISO3166-1"="TR"]->.a;
        rel(area.a)[boundary=administrative][admin_level=4];
        out tags center bb;
      `;

      const data = await this.overpassQuery(query);
      const provinces: RegionArea[] = data.elements
        .filter((el) => el.tags?.name && el.center && el.bounds)
        .map((el) => {
          const bounds = el.bounds!;
          return {
            osmId: `relation/${el.id}`,
            name: el.tags!.name,
            displayName: el.tags!.name,
            lat: el.center!.lat,
            lon: el.center!.lon,
            boundingBox: [bounds.minlat, bounds.maxlat, bounds.minlon, bounds.maxlon] as [number, number, number, number],
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

      this.cache.set(cacheKey, provinces);
      return provinces;
    } catch (err) {
      this.logger.error(`Failed to fetch provinces from Overpass`, err);
      return [];
    }
  }

  async getDistricts(provinceOsmId: string): Promise<RegionArea[]> {
    const cacheKey = `districts:${provinceOsmId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const match = provinceOsmId.match(/^relation\/(\d+)$/);
    if (!match) {
      return [];
    }

    const relationId = match[1];
    const areaId = 3600000000 + parseInt(relationId, 10);

    try {
      const query = `
        [out:json][timeout:50];
        area(${areaId})->.a;
        rel(area.a)[boundary=administrative][admin_level=6];
        out tags center bb;
      `;

      const data = await this.overpassQuery(query);
      const districts: RegionArea[] = data.elements
        .filter((el) => el.tags?.name && el.center && el.bounds)
        .map((el) => {
          const bounds = el.bounds!;
          return {
            osmId: `relation/${el.id}`,
            name: el.tags!.name,
            displayName: el.tags!.name,
            lat: el.center!.lat,
            lon: el.center!.lon,
            boundingBox: [bounds.minlat, bounds.maxlat, bounds.minlon, bounds.maxlon] as [number, number, number, number],
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

      this.cache.set(cacheKey, districts);
      return districts;
    } catch (err) {
      this.logger.error(`Failed to fetch districts for ${provinceOsmId}`, err);
      return [];
    }
  }

  async getNeighborhoods(districtOsmId: string): Promise<RegionArea[]> {
    const cacheKey = `neighborhoods:${districtOsmId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if this is a static district ID (not a relation/... format)
    const isStaticDistrict = !districtOsmId.match(/^relation\/(\d+)$/);
    
    if (isStaticDistrict) {
      // Handle static district - load from bundled data
      const neighborhoods = neighborhoodsData.neighborhoods
        .filter((n: any) => n.districtId === districtOsmId)
        .map((n: any) => ({
          osmId: n.osmId,
          name: n.name,
          displayName: n.name,
          lat: n.lat,
          lon: n.lon,
          boundingBox: n.boundingBox as [number, number, number, number],
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

      this.cache.set(cacheKey, neighborhoods);
      return neighborhoods;
    }

    // Legacy path: handle OSM relation IDs via Overpass API
    const match = districtOsmId.match(/^relation\/(\d+)$/);
    if (!match) {
      return [];
    }

    const relationId = match[1];
    const areaId = 3600000000 + parseInt(relationId, 10);

    try {
      const query = `
        [out:json][timeout:50];
        area(${areaId})->.a;
        (
          rel(area.a)[boundary=administrative][admin_level=8];
          node(area.a)[place~"neighbourhood|quarter"];
        );
        out tags center bb;
      `;

      const data = await this.overpassQuery(query);
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

      this.cache.set(cacheKey, neighborhoods);
      return neighborhoods;
    } catch (err) {
      this.logger.error(`Failed to fetch neighborhoods for ${districtOsmId}`, err);
      return [];
    }
  }

  async getStreets(neighborhoodOsmId: string): Promise<RegionArea[]> {
    const cacheKey = `streets:${neighborhoodOsmId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if this is a static neighborhood ID
    const isStaticNeighborhood = !neighborhoodOsmId.match(/^(relation|node)\/(\d+)$/);
    
    if (isStaticNeighborhood) {
      // Find the neighborhood in static data
      const neighborhood = neighborhoodsData.neighborhoods.find((n: any) => n.osmId === neighborhoodOsmId);
      
      if (!neighborhood) {
        // Empty list for unknown neighborhoods, not an error
        return [];
      }

      // If neighborhood has coordinates, query Overpass for streets around it
      if (neighborhood.lat && neighborhood.lon) {
        try {
          const lat = neighborhood.lat;
          const lon = neighborhood.lon;
          const bbox = neighborhood.boundingBox;
          const radius = 1000; // 1km radius for street search

          const query = `
            [out:json][timeout:25];
            (
              way(around:${radius},${lat},${lon})[highway][name];
            );
            out tags center bb;
          `;

          const data = await this.overpassQuery(query);
          
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

          this.cache.set(cacheKey, streets);
          return streets;
        } catch (err) {
          this.logger.warn(`Could not fetch streets for ${neighborhoodOsmId} from Overpass, returning empty list`, err);
          // Return empty list on error, don't throw
          return [];
        }
      } else {
        // No coordinates available, return empty list (street is optional)
        return [];
      }
    }

    // Legacy path: handle OSM relation/node IDs via Overpass API
    const match = neighborhoodOsmId.match(/^(relation|node)\/(\d+)$/);
    if (!match) {
      return [];
    }

    const [, type, idStr] = match;
    let areaId: number;

    if (type === 'relation') {
      areaId = 3600000000 + parseInt(idStr, 10);
    } else if (type === 'node') {
      areaId = 3400000000 + parseInt(idStr, 10);
    } else {
      return [];
    }

    try {
      const query = `
        [out:json][timeout:50];
        area(${areaId})->.a;
        way(area.a)[highway][name];
        out tags center bb;
      `;

      const data = await this.overpassQuery(query);
      
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

      this.cache.set(cacheKey, streets);
      return streets;
    } catch (err) {
      this.logger.error(`Failed to fetch streets for ${neighborhoodOsmId}`, err);
      return [];
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
