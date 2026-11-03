/**
 * SAM Output Parser Test
 * Work Package C - Vision
 * 
 * Tests the SAM 3.1 output parsing with a fixture response
 */

import { MetaModelClient } from '../src/ai/meta-model-client';

describe('SAM Output Parser', () => {
  let client: MetaModelClient;

  beforeEach(() => {
    client = new MetaModelClient();
  });

  it('should parse SAM output with boxes and masks', () => {
    // Real SAM 3.1 output format (simplified fixture)
    const samOutput = `<0f>ID1<|box;x1=100.5;y1=200.3;x2=250.7;y2=350.9;w=1280;h=960;c=0.95|><|mask;x=100;y=200;c=0.95;data=151,151,!ABCDEFGHIJabcdefghij123456789XYZ|>ID2<|box;x1=500;y1=600;x2=700;y2=800;w=1280;h=960;c=0.87|>`;

    // Use the private parseSamOutput method via any cast for testing
    const segments = (client as any).parseSamOutput(samOutput);

    expect(segments).toHaveLength(2);

    // First segment with mask
    expect(segments[0].id).toBe('1');
    expect(segments[0].confidence).toBe(0.95);
    expect(segments[0].boundingBox).toEqual({
      x1: 100.5,
      y1: 200.3,
      x2: 250.7,
      y2: 350.9,
      width: 1280,
      height: 960,
    });
    expect(segments[0].mask).not.toBeNull();
    expect(segments[0].mask?.x).toBe(100);
    expect(segments[0].mask?.y).toBe(200);
    expect(segments[0].mask?.width).toBe(151);
    expect(segments[0].mask?.height).toBe(151);
    expect(segments[0].mask?.encoding).toBe('!');
    expect(segments[0].mask?.data).toContain('!ABCDEFGHIJ');

    // Second segment without mask
    expect(segments[1].id).toBe('2');
    expect(segments[1].confidence).toBe(0.87);
    expect(segments[1].boundingBox.x1).toBe(500);
    expect(segments[1].mask).toBeNull();
  });

  it('should handle empty SAM output', () => {
    const samOutput = '<0f>';
    const segments = (client as any).parseSamOutput(samOutput);
    expect(segments).toHaveLength(0);
  });

  it('should parse segments without confidence', () => {
    const samOutput = `ID3<|box;x1=10;y1=20;x2=30;y2=40;w=640;h=480|>`;
    const segments = (client as any).parseSamOutput(samOutput);

    expect(segments).toHaveLength(1);
    expect(segments[0].id).toBe('3');
    expect(segments[0].confidence).toBeNull();
  });
});
