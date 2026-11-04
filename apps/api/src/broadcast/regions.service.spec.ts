import { Test, TestingModule } from '@nestjs/testing';
import { RegionsService, RegionArea } from './regions.service';
import staticRegions from './static-regions.json';
import neighborhoods from './neighborhoods.json';

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

  describe('getNeighborhoods with static district IDs', () => {
    it('should return neighborhoods for a geoBoundaries district ID', async () => {
      // Find Adana province
      const adanaProvince = staticRegions.provinces.find(p => p.name === 'Adana');
      expect(adanaProvince).toBeDefined();

      // Find Karaisalı district
      const karaisaliDistrict = staticRegions.districts.find(
        d => d.parentId === adanaProvince!.osmId && d.name === 'Karaisalı'
      );
      expect(karaisaliDistrict).toBeDefined();

      // Get neighborhoods for this district
      const result = await service.getNeighborhoods(karaisaliDistrict!.osmId);
      
      // Should return an array (not an error)
      expect(Array.isArray(result)).toBe(true);
      
      const neighborhoodsArray = result as RegionArea[];
      expect(neighborhoodsArray.length).toBeGreaterThan(0);

      // Verify structure
      const firstNeighborhood = neighborhoodsArray[0];
      expect(firstNeighborhood).toHaveProperty('osmId');
      expect(firstNeighborhood).toHaveProperty('name');
      expect(firstNeighborhood).toHaveProperty('displayName');
      expect(firstNeighborhood).toHaveProperty('lat');
      expect(firstNeighborhood).toHaveProperty('lon');
      expect(firstNeighborhood).toHaveProperty('boundingBox');
      expect(Array.isArray(firstNeighborhood.boundingBox)).toBe(true);
      expect(firstNeighborhood.boundingBox.length).toBe(4);

      // Should have real OSM IDs (relation/... or node/...)
      expect(firstNeighborhood.osmId).toMatch(/^(relation|node)\/\d+$/);
    });

    it('should return empty array for district with no neighborhoods', async () => {
      // Create a fake district ID that doesn't exist
      const result = await service.getNeighborhoods('NONEXISTENT-DISTRICT-ID');
      
      expect(Array.isArray(result)).toBe(true);
      const neighborhoodsArray = result as RegionArea[];
      expect(neighborhoodsArray.length).toBe(0);
    });

    it('should cache results for static districts', async () => {
      const adanaProvince = staticRegions.provinces.find(p => p.name === 'Adana');
      const karaisaliDistrict = staticRegions.districts.find(
        d => d.parentId === adanaProvince!.osmId && d.name === 'Karaisalı'
      );
      
      const result1 = await service.getNeighborhoods(karaisaliDistrict!.osmId);
      const result2 = await service.getNeighborhoods(karaisaliDistrict!.osmId);

      expect(result1).toEqual(result2);
    });

    it('should return neighborhoods with consistent names', async () => {
      const adanaProvince = staticRegions.provinces.find(p => p.name === 'Adana');
      const karaisaliDistrict = staticRegions.districts.find(
        d => d.parentId === adanaProvince!.osmId && d.name === 'Karaisalı'
      );
      
      const result = await service.getNeighborhoods(karaisaliDistrict!.osmId) as RegionArea[];
      
      // Verify all neighborhoods have names
      for (const neighborhood of result) {
        expect(neighborhood.name).toBeTruthy();
        expect(typeof neighborhood.name).toBe('string');
      }
    });
  });

  describe('getStreets', () => {
    it('should return empty array for non-OSM neighborhood IDs', async () => {
      // Static neighborhood IDs are not in relation/node format
      const result = await service.getStreets('SOME-STATIC-ID');
      
      expect(Array.isArray(result)).toBe(true);
      const streetsArray = result as RegionArea[];
      expect(streetsArray.length).toBe(0);
    });

    it('should cache empty results', async () => {
      const result1 = await service.getStreets('STATIC-ID-1');
      const result2 = await service.getStreets('STATIC-ID-1');

      expect(result1).toEqual(result2);
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

  describe('getProvinces', () => {
    it('should return all provinces from static data', async () => {
      const provinces = await service.getProvinces('relation/174737');

      expect(provinces).toBeDefined();
      expect(Array.isArray(provinces)).toBe(true);
      expect(provinces.length).toBe(81);
    });
  });

  describe('getDistricts', () => {
    it('should return districts for a province', async () => {
      const adanaProvince = staticRegions.provinces.find(p => p.name === 'Adana');
      expect(adanaProvince).toBeDefined();

      const districts = await service.getDistricts(adanaProvince!.osmId);

      expect(districts).toBeDefined();
      expect(Array.isArray(districts)).toBe(true);
      expect(districts.length).toBeGreaterThan(0);
      
      // Verify Karaisalı is in the list
      const karaisali = districts.find(d => d.name === 'Karaisalı');
      expect(karaisali).toBeDefined();
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
      const smallBox: [number, number, number, number] = [37.0, 37.001, 35.0, 35.001];
      const smallRadius = service.computeRadiusKm(smallBox);
      expect(smallRadius).toBe(0.3);

      const largeBox: [number, number, number, number] = [30.0, 42.0, 26.0, 45.0];
      const largeRadius = service.computeRadiusKm(largeBox);
      expect(largeRadius).toBe(500);
    });
  });
});
