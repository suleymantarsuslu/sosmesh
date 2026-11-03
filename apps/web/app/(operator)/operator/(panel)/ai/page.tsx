import { AiDashboardView } from '../../../../../features/ai/AiDashboardView';
import type { AiStatusView } from '../../../../../features/ai/types';

export const dynamic = 'force-dynamic';

async function getAiStatus(): Promise<AiStatusView> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/v1/operator/ai/status`, {
      cache: 'no-store',
    });

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
