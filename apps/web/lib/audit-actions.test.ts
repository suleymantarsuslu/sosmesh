import { describe, expect, it } from 'vitest';

import { auditActionLabel, auditCategoryOf, auditTeamName } from './audit-actions';

const t = (key: string) => `T(${key})`;

describe('audit actions', () => {
  it('maps assignment and task actions to localized labels', () => {
    expect(auditActionLabel(t, 'recommendation.confirm')).toBe(
      'T(web.activity.actionRecommendationConfirm)'
    );
    expect(auditActionLabel(t, 'work_task.assign_team')).toBe(
      'T(web.activity.actionTaskAssignTeam)'
    );
  });

  it('humanizes unknown codes instead of showing raw keys', () => {
    expect(auditActionLabel(t, 'some_new.action_code')).toBe('Some new action code');
  });

  it('categorizes recommendation and task actions', () => {
    expect(auditCategoryOf('recommendation.reject')).toBe('ai');
    expect(auditCategoryOf('work_task.close')).toBe('task');
    expect(auditCategoryOf('OPERATOR_SEEN')).toBe('case');
  });

  it('reads the team name recorded by an assignment confirmation', () => {
    expect(auditTeamName({ teamName: 'Alpha' })).toBe('Alpha');
    expect(auditTeamName(null)).toBeNull();
    expect(auditTeamName({ teamName: 3 })).toBeNull();
  });
});
