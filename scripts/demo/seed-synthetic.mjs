#!/usr/bin/env node
/**
 * Synthetic Demo SOS Seed
 * Work Package D - Demo Seed
 * 
 * Creates 8-10 synthetic SOS messages in a demo region
 * 2-3 are designed to trigger fusion (same event)
 * 
 * Usage: OPERATOR_TOKEN=xxx node scripts/demo/seed-synthetic.mjs
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const OPERATOR_TOKEN = process.env.OPERATOR_TOKEN;

if (!OPERATOR_TOKEN) {
  console.error('Error: OPERATOR_TOKEN environment variable required');
  process.exit(1);
}

const DEMO_REGION = {
  name: 'Demo Bölgesi',
  centerLat: 39.9334,
  centerLon: 32.8597,
};

function randomCoord(center, radiusMeters) {
  const earthRadius = 6371000;
  const deltaLat = (radiusMeters / earthRadius) * (180 / Math.PI);
  const deltaLon =
    (radiusMeters / (earthRadius * Math.cos((center * Math.PI) / 180))) *
    (180 / Math.PI);

  const lat = center + (Math.random() - 0.5) * 2 * deltaLat;
  const lon = center + (Math.random() - 0.5) * 2 * deltaLon;

  return { lat, lon };
}

function coarseCoord(lat, lon) {
  return {
    lat: Math.round(lat * 100) / 100,
    lon: Math.round(lon * 100) / 100,
  };
}

async function createSOS(text, priority, latitude, longitude) {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('priority', priority.toString());
  formData.append('language', 'tr');
  
  if (latitude !== undefined && longitude !== undefined) {
    formData.append('latitude', latitude.toString());
    formData.append('longitude', longitude.toString());
  }

  const response = await fetch(`${API_BASE}/v1/operator/demo/sos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPERATOR_TOKEN}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to create SOS: ${response.status} ${response.statusText} - ${text}`
    );
  }

  return response.json();
}

async function main() {
  console.log('🌱 Seeding synthetic demo data...');

  const baseCoord = randomCoord(DEMO_REGION.centerLat, 5000);
  const sameEventCoarse = coarseCoord(baseCoord.lat, baseCoord.lon);

  const fusionGroup = [
    {
      text: 'SENTETİK DEMO: Yardım! Binamız çöktü, üç kişiyiz enkaz altında. Lütfen yardım gönderin!',
      priority: 1,
      latitude: sameEventCoarse.lat + 0.001,
      longitude: sameEventCoarse.lon + 0.001,
    },
    {
      text: 'SENTETİK DEMO: Help! Building collapsed on Main Street. We need rescue team urgently!',
      priority: 1,
      latitude: sameEventCoarse.lat + 0.0005,
      longitude: sameEventCoarse.lon - 0.0005,
    },
    {
      text: 'SENTETİK DEMO: Çok sayıda kişi mahsur! Ana Cadde, enkaz var!',
      priority: 1,
      latitude: sameEventCoarse.lat,
      longitude: sameEventCoarse.lon,
    },
  ];

  const otherCoords = [
    randomCoord(DEMO_REGION.centerLat, 3000),
    randomCoord(DEMO_REGION.centerLat, 4000),
    randomCoord(DEMO_REGION.centerLat, 6000),
    randomCoord(DEMO_REGION.centerLat, 2000),
    randomCoord(DEMO_REGION.centerLat, 5000),
  ];

  const otherIncidents = [
    {
      text: 'SENTETİK DEMO: Yangın var! Ormanlık alanda büyüyen yangın.',
      priority: 2,
      latitude: otherCoords[0].lat,
      longitude: otherCoords[0].lon,
    },
    {
      text: 'SENTETİK DEMO: Yaralı var, ambulans gerekli. Ciddi yaralanma.',
      priority: 1,
      latitude: otherCoords[1].lat,
      longitude: otherCoords[1].lon,
    },
    {
      text: 'SENTETİK DEMO: Five people need evacuation. Water supply cut.',
      priority: 3,
      latitude: otherCoords[2].lat,
      longitude: otherCoords[2].lon,
    },
    {
      text: 'SENTETİK DEMO: Elektrik kesildi, sekiz kişi sıkıştı asansörde.',
      priority: 2,
      latitude: otherCoords[3].lat,
      longitude: otherCoords[3].lon,
    },
    {
      text: 'SENTETİK DEMO: Chronic patient needs medication urgently.',
      priority: 2,
      latitude: otherCoords[4].lat,
      longitude: otherCoords[4].lon,
    },
  ];

  const allSOSes = [...fusionGroup, ...otherIncidents];

  console.log(
    `Creating ${allSOSes.length} synthetic SOS messages (${fusionGroup.length} fusion group + ${otherIncidents.length} other)...`
  );

  let created = 0;
  let failed = 0;

  for (const sos of allSOSes) {
    try {
      const result = await createSOS(sos.text, sos.priority, sos.latitude, sos.longitude);
      console.log(`✅ Created SOS: ${result.incidentId} / ${result.messageId}`);
      created += 1;

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Failed to create SOS:`, error.message);
      failed += 1;
    }
  }

  console.log(`\n✨ Seeding complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Failed: ${failed}`);
  console.log(
    `\n💡 Fusion group: ${fusionGroup.length} SOSes near ${sameEventCoarse.lat.toFixed(2)}, ${sameEventCoarse.lon.toFixed(2)}`
  );
  console.log('   These should trigger link suggestions after AI triage.\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
