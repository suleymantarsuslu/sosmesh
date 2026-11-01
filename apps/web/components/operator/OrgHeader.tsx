'use client';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

export function OrgHeader({
  organizationName,
  teamName,
  role,
}: {
  organizationName: string | null;
  teamName: string | null;
  role: string;
}) {
  const { t } = useOperatorPreferences();
  return (
    <div className="operator-org-header" data-testid="operator-org-header">
      <p className="operator-org-header__label">{t('web.shell.orgHeader')}</p>
      <p className="operator-org-header__name">
        {organizationName ?? '—'}
        {teamName ? <span className="operator-org-header__team"> · {teamName}</span> : null}
      </p>
      <p className="operator-org-header__role">{role}</p>
    </div>
  );
}
