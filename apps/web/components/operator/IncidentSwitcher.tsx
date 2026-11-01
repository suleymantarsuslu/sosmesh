'use client';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

export type IncidentOption = { id: string; state: string };

export function IncidentSwitcher({
  incidents,
}: {
  incidents: IncidentOption[];
}) {
  const { t, activeIncidentId, setActiveIncidentId } = useOperatorPreferences();

  return (
    <label className="operator-incident-switcher">
      <span>{t('web.shell.incidentSwitcher')}</span>
      <select
        data-testid="incident-switcher"
        value={activeIncidentId ?? ''}
        onChange={(event) =>
          setActiveIncidentId(event.target.value ? event.target.value : null)
        }
      >
        <option value="">{t('web.shell.incidentAll')}</option>
        {incidents.map((incident) => (
          <option key={incident.id} value={incident.id}>
            {incident.id.slice(0, 8)}… ({incident.state})
          </option>
        ))}
      </select>
    </label>
  );
}
