'use client';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

type Props = {
  visible: boolean;
};

export function DemoModeBanner({ visible }: Props) {
  const { t } = useOperatorPreferences();
  if (!visible) {
    return null;
  }
  return (
    <div
      className="ui-demo-mode-banner"
      role="status"
      data-testid="demo-mode-banner"
    >
      {t('web.shell.demoModeBanner')}
    </div>
  );
}
