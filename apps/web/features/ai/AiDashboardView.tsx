'use client';

import { useState } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { AiStatusView } from './types';
import { AiStatusCard } from './AiStatusCard';
import { MissionCopilotCard } from './MissionCopilotCard';
import { DemoSosForm } from './DemoSosForm';

type Props = {
  status: AiStatusView;
};

export function AiDashboardView({ status }: Props) {
  const { t } = useOperatorPreferences();

  return (
    <div className="ai-dashboard" data-testid="ai-dashboard">
      <header className="ai-dashboard__header">
        <h1>{t('web.ai.dashboardTitle')}</h1>
      </header>

      <div className="ai-dashboard__disclaimer" role="note">
        {t('web.ai.disclaimer')}
      </div>

      <div className="ai-dashboard__grid">
        <AiStatusCard status={status} />
        <MissionCopilotCard />
        <DemoSosForm />
      </div>
    </div>
  );
}
