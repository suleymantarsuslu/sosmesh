import { AiDashboardView } from '../../../../../features/ai/AiDashboardView';
import type { AiStatusView } from '../../../../../features/ai/types';
import { fetchWithSession } from '../../../../../lib/session';

export const dynamic = 'force-dynamic';

async function getAiStatus(): Promise<AiStatusView> {
  try {
    const res = await fetchWithSession('/v1/operator/ai/status');

    if (!res.ok) {
      return {
        enabled: false,
        circuitState: 'open',
        budgetUsedToday: 0,
        budgetTotalLimit: 150,
        budgetDailyLimit: 30,
        lastAnalysisAt: null,
        queueDepth: 0,
        modelsAvailable: { spark: false, asr: false, sam: false },
      };
    }

    return await res.json();
  } catch {
    return {
      enabled: false,
      circuitState: 'open',
      budgetUsedToday: 0,
      budgetTotalLimit: 150,
      budgetDailyLimit: 30,
      lastAnalysisAt: null,
      queueDepth: 0,
      modelsAvailable: { spark: false, asr: false, sam: false },
    };
  }
}

export default async function AiDashboardPage() {
  const status = await getAiStatus();
  return <AiDashboardView status={status} />;
}
