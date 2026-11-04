#!/usr/bin/env node
/**
 * Generate static regions data (provinces and districts) from geoBoundaries open dataset.
 * 
 * Data source: geoBoundaries (www.geoboundaries.org)
 * License: Creative Commons 4.0 CC BY License
 * Citation: Runfola, D. et al. (2020) geoBoundaries: A global database of political administrative boundaries. 
 *           PLoS ONE 15(4): e0231866. https://doi.org/10.1371/journal.pone.0231866
 * 
 * This script fetches Turkish provinces (ADM1) and districts (ADM2) from geoBoundaries
 * and generates a static JSON file for instant serving without network calls.
 * 
 * Usage: cd apps/api && node scripts/generate-static-regions.js
 */

const { writeFileSync } = require('fs');
const { join } = require('path');

const GEOBOUNDARIES_API = 'https://www.geoboundaries.org/api/current/gbOpen';

async function fetchGeoBoundaries(adminLevel) {
  console.log(`Fetching geoBoundaries API metadata for TUR ADM${adminLevel}...`);
  
  const apiUrl = `${GEOBOUNDARIES_API}/TUR/ADM${adminLevel}/`;
  const res = await fetch(apiUrl);
  
  if (!res.ok) {
    throw new Error(`geoBoundaries API returned ${res.status}`);
  }
  
  const metadata = await res.json();
  const downloadUrl = metadata.simplifiedGeometryGeoJSON || metadata.gjDownloadURL;
  
  if (!downloadUrl) {
    throw new Error('No GeoJSON download URL found');
  }
  
  console.log(`  Downloading GeoJSON from ${downloadUrl}...`);
  const geoRes = await fetch(downloadUrl);
  
  if (!geoRes.ok) {
    throw new Error(`GeoJSON download returned ${geoRes.status}`);
  }
  
  return await geoRes.json();
}

function computeBounds(coordinates) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  
  function processCoords(coords) {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    } else {
      coords.forEach(processCoords);
    }
  }
  
  processCoords(coordinates);
  
  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
    centerLat: (minLat + maxLat) / 2,
    centerLon: (minLon + maxLon) / 2,
  };
}

function processProvinces(geoJSON) {
  console.log('\nProcessing provinces...');
  
  const provinces = geoJSON.features.map((feature) => {
    const props = feature.properties;
    const bounds = computeBounds(feature.geometry.coordinates);
    
    return {
      osmId: props.shapeID || `adm1-${props.shapeGroup}`,
      name: props.shapeName,
      iso: props.shapeISO || props.shapeGroup,
      lat: bounds.centerLat,
      lon: bounds.centerLon,
      boundingBox: [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon],
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  
  console.log(`  ✓ Processed ${provinces.length} provinces`);
  return provinces;
}

function pointInPolygon(point, polygon) {
  const [lon, lat] = point;
  let inside = false;
  
  function testRing(ring) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      
      const intersect = ((yi > lat) !== (yj > lat)) &&
                       (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
  }
  
  if (polygon[0] && typeof polygon[0][0] === 'number') {
    testRing(polygon);
  } else {
    polygon.forEach(testRing);
  }
  
  return inside;
}

function findParentProvince(districtCenter, provinceGeoJSON) {
  for (const feature of provinceGeoJSON.features) {
    const coords = feature.geometry.coordinates;
    
    if (feature.geometry.type === 'Polygon') {
      if (pointInPolygon(districtCenter, coords)) {
        return feature.properties.shapeID || `adm1-${feature.properties.shapeGroup}`;
      }
    } else if (feature.geometry.type === 'MultiPolygon') {
      for (const polygon of coords) {
        if (pointInPolygon(districtCenter, polygon)) {
          return feature.properties.shapeID || `adm1-${feature.properties.shapeGroup}`;
        }
      }
    }
  }
  
  return null;
}

function processDistricts(geoJSON, provinceGeoJSON) {
  console.log('\nProcessing districts...');
  
  const districts = geoJSON.features.map((feature) => {
    const props = feature.properties;
    const bounds = computeBounds(feature.geometry.coordinates);
    const center = [bounds.centerLon, bounds.centerLat];
    
    const parentId = findParentProvince(center, provinceGeoJSON);
    
    return {
      osmId: props.shapeID || `adm2-${props.shapeGroup}`,
      name: props.shapeName,
      parentId,
      lat: bounds.centerLat,
      lon: bounds.centerLon,
      boundingBox: [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon],
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  
  console.log(`  ✓ Processed ${districts.length} districts`);
  return districts;
}

async function main() {
  console.log('SOSMesh Static Regions Generator (geoBoundaries)');
  console.log('==================================================\n');
  console.log('Data source: geoBoundaries.org (CC BY 4.0 License)');
  console.log('Fetching Turkish administrative boundaries...\n');
  
  const provinceGeoJSON = await fetchGeoBoundaries(1);
  const districtGeoJSON = await fetchGeoBoundaries(2);
  
  const provinces = processProvinces(provinceGeoJSON);
  const districts = processDistricts(districtGeoJSON, provinceGeoJSON);
  
  const data = {
    generatedAt: new Date().toISOString(),
    source: 'geoBoundaries.org',
    license: 'CC BY 4.0',
    citation: 'Runfola et al. (2020) geoBoundaries: A global database of political administrative boundaries. PLoS ONE 15(4): e0231866.',
    provinces,
    districts,
  };
  
  const outputPath = join(__dirname, '../src/broadcast/static-regions.json');
  writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log(`\n✓ Saved to ${outputPath}`);
  console.log(`  Provinces: ${provinces.length}`);
  console.log(`  Districts: ${districts.length}`);
  console.log('\n✓ Done!');
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
