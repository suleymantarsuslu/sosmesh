#!/usr/bin/env tsx
/**
 * Generate static regions data (provinces and districts) from OpenStreetMap Overpass API.
 * This script fetches all Turkish provinces (admin_level=4) and districts (admin_level=6)
 * and saves them to a JSON file for instant serving without network calls.
 * 
 * Usage: cd apps/api && npx tsx scripts/generate-static-regions.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const USER_AGENT = 'SOSMesh/1.0 (+https://sosmesh.antiosoft.com)';

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

type Region = {
  osmId: string;
  name: string;
  lat: number;
  lon: number;
  boundingBox: [number, number, number, number];
};

type StaticRegionsData = {
  generatedAt: string;
  provinces: Region[];
  districts: Region[];
};

async function queryOverpass(query: string, attempt = 0): Promise<OverpassResponse> {
  const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
  console.log(`[Attempt ${attempt + 1}] Querying ${endpoint}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`  Failed: ${err}`);
    if (attempt < OVERPASS_ENDPOINTS.length * 2 - 1) {
      const delay = Math.min(1000 * Math.pow(2, Math.floor(attempt / OVERPASS_ENDPOINTS.length)), 8000);
      console.log(`  Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return queryOverpass(query, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchProvinces(): Promise<Region[]> {
  console.log('\n=== Fetching Turkish Provinces ===');
  const query = `
    [out:json][timeout:50];
    area["ISO3166-1"="TR"]->.a;
    rel(area.a)[boundary=administrative][admin_level=4];
    out tags center bb;
  `;

  const data = await queryOverpass(query);
  const provinces = data.elements
    .filter((el) => el.tags?.name && el.center && el.bounds)
    .map((el) => {
      const bounds = el.bounds!;
      return {
        osmId: `relation/${el.id}`,
        name: el.tags!.name,
        lat: el.center!.lat,
        lon: el.center!.lon,
        boundingBox: [bounds.minlat, bounds.maxlat, bounds.minlon, bounds.maxlon] as [number, number, number, number],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  console.log(`✓ Fetched ${provinces.length} provinces`);
  return provinces;
}

async function fetchDistricts(provinces: Region[]): Promise<Region[]> {
  console.log('\n=== Fetching Districts for All Provinces ===');
  const allDistricts: Region[] = [];

  for (let i = 0; i < provinces.length; i++) {
    const province = provinces[i];
    const relationId = province.osmId.replace('relation/', '');
    const areaId = 3600000000 + parseInt(relationId, 10);

    console.log(`[${i + 1}/${provinces.length}] ${province.name}...`);

    const query = `
      [out:json][timeout:50];
      area(${areaId})->.a;
      rel(area.a)[boundary=administrative][admin_level=6];
      out tags center bb;
    `;

    try {
      const data = await queryOverpass(query);
      const districts = data.elements
        .filter((el) => el.tags?.name && el.center && el.bounds)
        .map((el) => {
          const bounds = el.bounds!;
          return {
            osmId: `relation/${el.id}`,
            name: el.tags!.name,
            lat: el.center!.lat,
            lon: el.center!.lon,
            boundingBox: [bounds.minlat, bounds.maxlat, bounds.minlon, bounds.maxlon] as [number, number, number, number],
          };
        });

      allDistricts.push(...districts);
      console.log(`  ✓ ${districts.length} districts`);

      await new Promise((resolve) => setTimeout(resolve, 1100));
    } catch (err) {
      console.error(`  ✗ Failed to fetch districts for ${province.name}: ${err}`);
    }
  }

  allDistricts.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  console.log(`\n✓ Total: ${allDistricts.length} districts`);
  return allDistricts;
}

async function main() {
  console.log('SOSMesh Static Regions Generator');
  console.log('=================================\n');

  const provinces = await fetchProvinces();
  const districts = await fetchDistricts(provinces);

  const data: StaticRegionsData = {
    generatedAt: new Date().toISOString(),
    provinces,
    districts,
  };

  const outputPath = join(__dirname, '../src/broadcast/static-regions.json');
  writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`\n✓ Saved to ${outputPath}`);
  console.log(`  Provinces: ${provinces.length}`);
  console.log(`  Districts: ${districts.length}`);
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
