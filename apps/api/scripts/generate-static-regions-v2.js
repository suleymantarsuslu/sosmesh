const { writeFileSync, readFileSync } = require('fs');
const { join } = require('path');

const provincesData = JSON.parse(readFileSync('/tmp/provinces2.json', 'utf-8'));

const provinces = provincesData.elements
  .filter((el) => el.tags?.name && el.bounds)
  .map((el) => {
    const bounds = el.bounds;
    const lat = (bounds.minlat + bounds.maxlat) / 2;
    const lon = (bounds.minlon + bounds.maxlon) / 2;
    return {
      osmId: `relation/${el.id}`,
      name: el.tags.name,
      lat,
      lon,
      boundingBox: [bounds.minlat, bounds.maxlat, bounds.minlon, bounds.maxlon],
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

console.log(`Provinces: ${provinces.length}`);

async function fetchDistrictsForProvince(province, endpoint, attempt = 0) {
  const relationId = province.osmId.replace('relation/', '');
  const areaId = 3600000000 + parseInt(relationId, 10);

  const query = `
    [out:json][timeout:50];
    area(${areaId})->.a;
    rel(area.a)[boundary=administrative][admin_level=6];
    out tags center bb;
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'User-Agent': 'SOSMesh/1.0 (+https://sosmesh.antiosoft.com)',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.elements
      .filter((el) => el.tags?.name && el.bounds)
      .map((el) => {
        const bounds = el.bounds;
        let lat, lon;
        if (el.center) {
          lat = el.center.lat;
          lon = el.center.lon;
        } else {
          lat = (bounds.minlat + bounds.maxlat) / 2;
          lon = (bounds.minlon + bounds.maxlon) / 2;
        }
        return {
          osmId: `relation/${el.id}`,
          name: el.tags.name,
          lat,
          lon,
          boundingBox: [bounds.minlat, bounds.maxlat, bounds.minlon, bounds.maxlon],
        };
      });
  } catch (err) {
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.private.coffee/api/interpreter',
      ];
      return fetchDistrictsForProvince(province, endpoints[(attempt + 1) % 3], attempt + 1);
    }
    console.error(`  Failed for ${province.name}: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllDistricts(provinces) {
  const allDistricts = [];
  const endpoint = 'https://overpass-api.de/api/interpreter';

  for (let i = 0; i < provinces.length; i++) {
    const province = provinces[i];
    console.log(`[${i + 1}/${provinces.length}] ${province.name}...`);

    const districts = await fetchDistrictsForProvince(province, endpoint);
    allDistricts.push(...districts);
    console.log(`  ✓ ${districts.length} districts (total: ${allDistricts.length})`);

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return allDistricts.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

async function main() {
  console.log('\n=== Fetching Districts for All Provinces ===\n');
  
  const districts = await fetchAllDistricts(provinces);

  const data = {
    generatedAt: new Date().toISOString(),
    provinces,
    districts,
  };

  const outputPath = join(__dirname, '../src/broadcast/static-regions.json');
  writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`\n✓ Saved to ${outputPath}`);
  console.log(`  Provinces: ${provinces.length}`);
  console.log(`  Districts: ${districts.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
