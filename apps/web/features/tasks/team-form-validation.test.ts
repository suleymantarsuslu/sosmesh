/**
 * Team form validation tests
 */

import { describe, it, expect } from 'vitest';

type TeamFormData = {
  name: string;
  type: string;
  capacity: string;
  contactInfo: string;
  status: string;
  zoneCode: string;
};

function validateTeamForm(data: TeamFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.name.trim()) {
    errors.name = 'This field is required';
  }
  if (!data.status) {
    errors.status = 'This field is required';
  }
  if (data.capacity && parseInt(data.capacity, 10) < 1) {
    errors.capacity = 'Capacity must be at least 1';
  }
  if (data.capacity && parseInt(data.capacity, 10) > 1000) {
    errors.capacity = 'Capacity must not exceed 1000';
  }

  return errors;
}

describe('Team form validation', () => {
  it('should pass validation with valid data', () => {
    const data: TeamFormData = {
      name: 'Fire Team Alpha',
      type: 'FIRE',
      capacity: '10',
      contactInfo: 'radio-123',
      status: 'ACTIVE',
      zoneCode: 'Z1',
    };

    const errors = validateTeamForm(data);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should require team name', () => {
    const data: TeamFormData = {
      name: '',
      type: 'GENERAL',
      capacity: '',
      contactInfo: '',
      status: 'ACTIVE',
      zoneCode: '',
    };

    const errors = validateTeamForm(data);
    expect(errors.name).toBe('This field is required');
  });

  it('should require status', () => {
    const data: TeamFormData = {
      name: 'Test Team',
      type: 'GENERAL',
      capacity: '',
      contactInfo: '',
      status: '',
      zoneCode: '',
    };

    const errors = validateTeamForm(data);
    expect(errors.status).toBe('This field is required');
  });

  it('should validate capacity minimum', () => {
    const data: TeamFormData = {
      name: 'Test Team',
      type: 'GENERAL',
      capacity: '0',
      contactInfo: '',
      status: 'ACTIVE',
      zoneCode: '',
    };

    const errors = validateTeamForm(data);
    expect(errors.capacity).toBe('Capacity must be at least 1');
  });

  it('should validate capacity maximum', () => {
    const data: TeamFormData = {
      name: 'Test Team',
      type: 'GENERAL',
      capacity: '1001',
      contactInfo: '',
      status: 'ACTIVE',
      zoneCode: '',
    };

    const errors = validateTeamForm(data);
    expect(errors.capacity).toBe('Capacity must not exceed 1000');
  });

  it('should allow optional fields to be empty', () => {
    const data: TeamFormData = {
      name: 'Minimal Team',
      type: '',
      capacity: '',
      contactInfo: '',
      status: 'ACTIVE',
      zoneCode: '',
    };

    const errors = validateTeamForm(data);
    expect(Object.keys(errors)).toHaveLength(0);
  });
});
