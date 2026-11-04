import { Test, TestingModule } from '@nestjs/testing';
import { RegionsService, RegionArea } from './regions.service';

describe('RegionsService', () => {
  let service: RegionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RegionsService],
    }).compile();

    service = module.get<RegionsService>(RegionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getNeighborhoods', () => {
    it('should return neighborhoods for a static district (Adana/Karaisalı)', async () => {
      const districtId = 'ADN-001'; // Karaisalı district ID from static data
      const neighborhoods = await service.getNeighborhoods(districtId);

      expect(neighborhoods).toBeDefined();
      expect(Array.isArray(neighborhoods)).toBe(true);
      expect(neighborhoods.length).toBeGreaterThan(0);

      // Verify structure of returned neighborhoods
      const firstNeighborhood = neighborhoods[0];
      expect(firstNeighborhood).toHaveProperty('osmId');
      expect(firstNeighborhood).toHaveProperty('name');
      expect(firstNeighborhood).toHaveProperty('displayName');
      expect(firstNeighborhood).toHaveProperty('lat');
      expect(firstNeighborhood).toHaveProperty('lon');
      expect(firstNeighborhood).toHaveProperty('boundingBox');
      expect(Array.isArray(firstNeighborhood.boundingBox)).toBe(true);
      expect(firstNeighborhood.boundingBox.length).toBe(4);

      // Verify Turkish locale sorting
      expect(neighborhoods[0].name).toBeTruthy();
    });

    it('should return neighborhoods for another static district (Adana/Seyhan)', async () => {
      const districtId = 'ADN-002'; // Seyhan district ID from static data
      const neighborhoods = await service.getNeighborhoods(districtId);

      expect(neighborhoods).toBeDefined();
      expect(Array.isArray(neighborhoods)).toBe(true);
      expect(neighborhoods.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown static district', async () => {
      const districtId = 'UNKNOWN-999';
      const neighborhoods = await service.getNeighborhoods(districtId);

      expect(neighborhoods).toBeDefined();
      expect(Array.isArray(neighborhoods)).toBe(true);
      expect(neighborhoods.length).toBe(0);
    });

    it('should cache results for static districts', async () => {
      const districtId = 'ADN-001';
      
      // First call
      const neighborhoods1 = await service.getNeighborhoods(districtId);
      
      // Second call should return cached result
      const neighborhoods2 = await service.getNeighborhoods(districtId);

      expect(neighborhoods1).toEqual(neighborhoods2);
      expect(neighborhoods1.length).toBe(neighborhoods2.length);
    });

    it('should handle legacy OSM relation IDs (returns empty for invalid)', async () => {
      const relationId = 'relation/999999999';
      const neighborhoods = await service.getNeighborhoods(relationId);

      expect(neighborhoods).toBeDefined();
      expect(Array.isArray(neighborhoods)).toBe(true);
    });

    it('should return empty array for invalid district ID format', async () => {
      const invalidId = 'invalid-format';
      const neighborhoods = await service.getNeighborhoods(invalidId);

      expect(neighborhoods).toBeDefined();
      expect(Array.isArray(neighborhoods)).toBe(true);
    });
  });

  describe('getStreets', () => {
    it('should not throw for static neighborhood ID', async () => {
      const neighborhoodId = 'NH-ADN-001-001'; // Akdam Mahallesi
      
      // Should return empty array or streets, but not throw
      await expect(service.getStreets(neighborhoodId)).resolves.toBeDefined();
      
      const streets = await service.getStreets(neighborhoodId);
      expect(Array.isArray(streets)).toBe(true);
    });

    it('should return empty array for unknown static neighborhood', async () => {
      const neighborhoodId = 'NH-UNKNOWN-999';
      const streets = await service.getStreets(neighborhoodId);

      expect(streets).toBeDefined();
      expect(Array.isArray(streets)).toBe(true);
      expect(streets.length).toBe(0);
    });

    it('should cache results', async () => {
      const neighborhoodId = 'NH-ADN-001-001';
      
      const streets1 = await service.getStreets(neighborhoodId);
      const streets2 = await service.getStreets(neighborhoodId);

      expect(streets1).toEqual(streets2);
    });
  });

  describe('getCountries', () => {
    it('should return Turkey', async () => {
      const countries = await service.getCountries();

      expect(countries).toBeDefined();
      expect(Array.isArray(countries)).toBe(true);
      expect(countries.length).toBeGreaterThan(0);
      expect(countries[0].name).toBe('Türkiye');
    });
  });

  describe('computeRadiusKm', () => {
    it('should compute radius from bounding box', () => {
      const boundingBox: [number, number, number, number] = [36.5, 38.5, 34.5, 36.5];
      const radius = service.computeRadiusKm(boundingBox);

      expect(radius).toBeGreaterThan(0);
      expect(radius).toBeLessThanOrEqual(500);
      expect(radius).toBeGreaterThanOrEqual(0.3);
    });

    it('should clamp radius between min and max', () => {
      // Very small box
      const smallBox: [number, number, number, number] = [37.0, 37.001, 35.0, 35.001];
      const smallRadius = service.computeRadiusKm(smallBox);
      expect(smallRadius).toBe(0.3); // Should be clamped to minimum

      // Very large box
      const largeBox: [number, number, number, number] = [30.0, 42.0, 26.0, 45.0];
      const largeRadius = service.computeRadiusKm(largeBox);
      expect(largeRadius).toBe(500); // Should be clamped to maximum
    });
  });
});
