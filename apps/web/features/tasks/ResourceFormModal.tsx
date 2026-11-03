'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { ResourceRow, TeamRow } from './TeamsView';

type ResourceFormData = {
  name: string;
  kind: string;
  capacity: string;
  zoneCode: string;
  teamId: string;
  isActive: boolean;
  availableFrom: string;
  availableUntil: string;
};

export function ResourceFormModal({
  resource,
  teams,
  onClose,
}: {
  resource: ResourceRow | null;
  teams: TeamRow[];
  onClose: () => void;
}) {
  const { t } = useOperatorPreferences();
  const router = useRouter();
  const [formData, setFormData] = useState<ResourceFormData>({
    name: resource?.name ?? '',
    kind: resource?.kind ?? 'FIELD_TEAM',
    capacity: resource?.capacity?.toString() ?? '1',
    zoneCode: resource?.zoneCode ?? '',
    teamId: resource?.teamId ?? '',
    isActive: resource?.isActive ?? true,
    availableFrom: resource?.availableFrom ?? '',
    availableUntil: resource?.availableUntil ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ResourceFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ResourceFormData, string>> = {};
    if (!formData.name.trim()) {
      newErrors.name = t('web.teams.fieldRequired');
    }
    if (!formData.kind) {
      newErrors.kind = t('web.teams.fieldRequired');
    }
    if (!formData.capacity || parseInt(formData.capacity, 10) < 1) {
      newErrors.capacity = t('web.teams.fieldRequired');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const url = resource ? `/v1/operator/resources/${resource.id}` : '/v1/operator/resources';
      const method = resource ? 'PATCH' : 'POST';
      const payload: Record<string, unknown> = {
        name: formData.name,
        kind: formData.kind,
        capacity: parseInt(formData.capacity, 10),
        isActive: formData.isActive,
      };
      if (formData.zoneCode) payload.zoneCode = formData.zoneCode;
      if (formData.teamId) payload.teamId = formData.teamId;
      if (formData.availableFrom) payload.availableFrom = formData.availableFrom;
      if (formData.availableUntil) payload.availableUntil = formData.availableUntil;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(resource ? t('web.teams.updateError') : t('web.teams.createError'));
      }

      onClose();
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof ResourceFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>
            {resource ? t('web.teams.editResourceTitle') : t('web.teams.createResourceTitle')}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </header>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label htmlFor="resource-name">
              {t('web.teams.resourceName')} <span aria-label="required">*</span>
            </label>
            <input
              id="resource-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'resource-name-error' : undefined}
              required
            />
            {errors.name && (
              <span id="resource-name-error" className="form-error" role="alert">
                {errors.name}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="resource-kind">
              {t('web.teams.resourceKind')} <span aria-label="required">*</span>
            </label>
            <select
              id="resource-kind"
              value={formData.kind}
              onChange={(e) => handleChange('kind', e.target.value)}
              aria-invalid={!!errors.kind}
              required
            >
              <option value="FIELD_TEAM">{t('web.teams.kindFieldTeam')}</option>
              <option value="VEHICLE">{t('web.teams.kindVehicle')}</option>
              <option value="EQUIPMENT">{t('web.teams.kindEquipment')}</option>
              <option value="SHELTER">{t('web.teams.kindShelter')}</option>
            </select>
            {errors.kind && (
              <span className="form-error" role="alert">
                {errors.kind}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="resource-capacity">
              {t('web.teams.resourceCapacity')} <span aria-label="required">*</span>
            </label>
            <input
              id="resource-capacity"
              type="number"
              min="1"
              max="1000"
              value={formData.capacity}
              onChange={(e) => handleChange('capacity', e.target.value)}
              aria-invalid={!!errors.capacity}
              required
            />
            {errors.capacity && (
              <span className="form-error" role="alert">
                {errors.capacity}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="resource-zone">{t('web.teams.resourceZone')}</label>
            <input
              id="resource-zone"
              type="text"
              value={formData.zoneCode}
              onChange={(e) => handleChange('zoneCode', e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="resource-team">{t('web.teams.resourceTeam')}</label>
            <select
              id="resource-team"
              value={formData.teamId}
              onChange={(e) => handleChange('teamId', e.target.value)}
            >
              <option value="">{t('web.teams.noTeamAssignment')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
              />
              {t('web.teams.statusActive')}
            </label>
          </div>

          <div className="form-field">
            <label htmlFor="resource-from">{t('web.teams.resourceAvailableFrom')}</label>
            <input
              id="resource-from"
              type="datetime-local"
              value={formData.availableFrom}
              onChange={(e) => handleChange('availableFrom', e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="resource-until">{t('web.teams.resourceAvailableUntil')}</label>
            <input
              id="resource-until"
              type="datetime-local"
              value={formData.availableUntil}
              onChange={(e) => handleChange('availableUntil', e.target.value)}
            />
          </div>

          {submitError && (
            <div className="form-error" role="alert">
              {submitError}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="button button--secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
