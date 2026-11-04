'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { OpsModal } from '../ops/OpsModal';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { TeamRow } from './TeamsView';

type TeamFormData = {
  name: string;
  type: string;
  capacity: string;
  contactInfo: string;
  status: string;
  zoneCode: string;
};

export function TeamFormModal({ team, onClose }: { team: TeamRow | null; onClose: () => void }) {
  const { t } = useOperatorPreferences();
  const router = useRouter();
  const [formData, setFormData] = useState<TeamFormData>({
    name: team?.name ?? '',
    type: team?.type ?? 'GENERAL',
    capacity: team?.capacity?.toString() ?? '',
    contactInfo: team?.contactInfo ?? '',
    status: team?.status ?? 'ACTIVE',
    zoneCode: team?.zoneCode ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TeamFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof TeamFormData, string>> = {};
    if (!formData.name.trim()) {
      newErrors.name = t('web.teams.fieldRequired');
    }
    if (!formData.status) {
      newErrors.status = t('web.teams.fieldRequired');
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
      const url = team ? `/api/operator/teams/${team.id}` : '/api/operator/teams';
      const method = team ? 'PATCH' : 'POST';
      const payload: Record<string, unknown> = {
        name: formData.name,
        status: formData.status,
      };
      if (formData.type) payload.type = formData.type;
      if (formData.capacity) payload.capacity = parseInt(formData.capacity, 10);
      if (formData.contactInfo) payload.contactInfo = formData.contactInfo;
      if (formData.zoneCode) payload.zoneCode = formData.zoneCode;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(team ? t('web.teams.updateError') : t('web.teams.createError'));
      }

      onClose();
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof TeamFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <OpsModal
      title={team ? t('web.teams.editTeamTitle') : t('web.teams.createTeamTitle')}
      icon="users"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="form-field">
          <label htmlFor="team-name">
            {t('web.teams.teamName')} <span aria-label={t('web.teams.required')}>*</span>
          </label>
          <input
            id="team-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'team-name-error' : undefined}
            required
          />
          {errors.name && (
            <span id="team-name-error" className="form-error" role="alert">
              {errors.name}
            </span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="team-type">{t('web.teams.teamType')}</label>
          <select
            id="team-type"
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
          >
            <option value="GENERAL">{t('web.teams.typeGeneral')}</option>
            <option value="MEDICAL">{t('web.teams.typeMedical')}</option>
            <option value="SEARCH_RESCUE">{t('web.teams.typeSearchRescue')}</option>
            <option value="FIRE">{t('web.teams.typeFire')}</option>
            <option value="POLICE">{t('web.teams.typePolice')}</option>
            <option value="TECHNICAL">{t('web.teams.typeTechnical')}</option>
            <option value="LOGISTICS">{t('web.teams.typeLogistics')}</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="team-capacity">{t('web.teams.teamCapacity')}</label>
          <input
            id="team-capacity"
            type="number"
            min="1"
            max="1000"
            value={formData.capacity}
            onChange={(e) => handleChange('capacity', e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="team-contact">{t('web.teams.teamContact')}</label>
          <input
            id="team-contact"
            type="text"
            value={formData.contactInfo}
            onChange={(e) => handleChange('contactInfo', e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="team-status">
            {t('web.teams.teamStatus')} <span aria-label={t('web.teams.required')}>*</span>
          </label>
          <select
            id="team-status"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            aria-invalid={!!errors.status}
            required
          >
            <option value="ACTIVE">{t('web.teams.statusActive')}</option>
            <option value="STANDBY">{t('web.teams.statusStandby')}</option>
            <option value="OFF_DUTY">{t('web.teams.statusOffDuty')}</option>
          </select>
          {errors.status && (
            <span className="form-error" role="alert">
              {errors.status}
            </span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="team-zone">{t('web.teams.teamZone')}</label>
          <input
            id="team-zone"
            type="text"
            value={formData.zoneCode}
            onChange={(e) => handleChange('zoneCode', e.target.value)}
          />
        </div>

        {submitError && (
          <div className="form-error" role="alert">
            {submitError}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="cd2-btn">
            {t('common.cancel')}
          </button>
          <button type="submit" className="cd2-btn cd2-btn--primary" disabled={submitting}>
            {submitting ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </OpsModal>
  );
}
