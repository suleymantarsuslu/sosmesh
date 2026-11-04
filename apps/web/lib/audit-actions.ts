import type { IconName } from '../features/cases/detail/icons';

export type AuditCategory = 'case' | 'ai' | 'task' | 'privacy' | 'other';

/** i18n keys for known audit action codes (shared by the Activity page and the case audit log). */
export const AUDIT_ACTION_KEY: Record<string, string> = {
  OPERATOR_SEEN: 'web.activity.actionOperatorSeen',
  REVIEW_STATUS_CHANGED: 'web.activity.actionReviewStatusChanged',
  METADATA_CORRECTION: 'web.activity.actionMetadataCorrection',
  AI_OVERRIDE: 'web.activity.actionAiOverride',
  PRIVACY_EXPORT: 'web.activity.actionPrivacyExport',
  PRIVACY_ERASE_REQUEST: 'web.activity.actionPrivacyEraseRequest',
  RETENTION_PURGE: 'web.activity.actionRetentionPurge',
  'recommendation.confirm': 'web.activity.actionRecommendationConfirm',
  'recommendation.reject': 'web.activity.actionRecommendationReject',
  'recommendation.feedback': 'web.activity.actionRecommendationFeedback',
  'work_task.create': 'web.activity.actionTaskCreate',
  'work_task.ai_draft': 'web.activity.actionTaskAiDraft',
  'work_task.assign': 'web.activity.actionTaskAssign',
  'work_task.assign_team': 'web.activity.actionTaskAssignTeam',
  'work_task.accept': 'web.activity.actionTaskAccept',
  'work_task.withdraw': 'web.activity.actionTaskWithdraw',
  'work_task.close': 'web.activity.actionTaskClose',
};

export const AUDIT_ACTION_ICON: Record<string, IconName> = {
  OPERATOR_SEEN: 'eye',
  REVIEW_STATUS_CHANGED: 'check',
  METADATA_CORRECTION: 'edit',
  AI_OVERRIDE: 'sparkles',
  PRIVACY_EXPORT: 'archive',
  PRIVACY_ERASE_REQUEST: 'shield',
  RETENTION_PURGE: 'archive',
  'recommendation.confirm': 'check',
  'recommendation.reject': 'close',
  'recommendation.feedback': 'message',
  'work_task.assign_team': 'users',
};

export function auditCategoryOf(action: string): AuditCategory {
  if (action.startsWith('AI_') || action.startsWith('recommendation.')) {
    return 'ai';
  }
  if (action.startsWith('PRIVACY_') || action.startsWith('RETENTION_')) {
    return 'privacy';
  }
  if (
    action.startsWith('TASK_') ||
    action.startsWith('TEAM_') ||
    action.startsWith('RESOURCE_') ||
    action.startsWith('work_task.')
  ) {
    return 'task';
  }
  if (
    action === 'OPERATOR_SEEN' ||
    action === 'REVIEW_STATUS_CHANGED' ||
    action === 'METADATA_CORRECTION' ||
    action.startsWith('CASE_') ||
    action.startsWith('INCIDENT_')
  ) {
    return 'case';
  }
  return 'other';
}

/** Unknown audit codes still read well: "SOME_ACTION.CODE" -> "Some action code". */
export function humanizeAuditAction(action: string): string {
  const spaced = action.toLowerCase().replace(/[_.]/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function auditActionLabel(t: (key: string) => string, action: string): string {
  const key = AUDIT_ACTION_KEY[action];
  return key ? t(key) : humanizeAuditAction(action);
}

/** Team name recorded in the audit details (assignment confirmations), if any. */
export function auditTeamName(after: unknown): string | null {
  if (after && typeof after === 'object' && 'teamName' in after) {
    const value = (after as { teamName?: unknown }).teamName;
    return typeof value === 'string' && value ? value : null;
  }
  return null;
}
