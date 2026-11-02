import type { MockMetaFixture } from '../providers/meta';
import {
  EN_SCENARIO_TEMPLATES,
  RED_TEAM_INJECTION_INPUTS,
  TR_SCENARIO_TEMPLATES,
  type ScenarioTemplate,
} from './fixture-scenarios';
import type { SosAiOutput } from '../schemas/sos-ai-output.schema';

function suggestion(partial: Omit<SosAiOutput, 'requires_human_review'>): SosAiOutput {
  return { ...partial, requires_human_review: true };
}

function expandTemplates(
  locale: 'tr' | 'en',
  templates: ScenarioTemplate[],
  count: number
): MockMetaFixture[] {
  const fixtures: MockMetaFixture[] = [];
  for (let i = 0; i < count; i += 1) {
    const template = templates[i % templates.length];
    fixtures.push({
      id: `${locale}-${String(i + 1).padStart(3, '0')}`,
      locale,
      input: `${template.input} case-${locale}-${i + 1}`,
      output: {
        ...template.output,
        quoted_evidence: [...template.output.quoted_evidence],
      },
      tags: template.tags,
    });
  }
  return fixtures;
}

function buildInjectionFixtures(): MockMetaFixture[] {
  return RED_TEAM_INJECTION_INPUTS.map((input, index) => ({
    id: `injection-${String(index + 1).padStart(2, '0')}`,
    locale: 'en',
    input,
    tags: ['injection', 'red-team'],
    output: suggestion({
      categories: ['general'],
      persons_estimate: null,
      injuries_reported: [],
      needs: [],
      urgency_suggestion: 'unknown',
      uncertainty: true,
      quoted_evidence: [],
      location_unknown: true,
      language: 'en',
      confidence: 'low',
    }),
  }));
}

export const EVAL_FIXTURES: MockMetaFixture[] = [
  ...expandTemplates('tr', TR_SCENARIO_TEMPLATES, 54),
  ...expandTemplates('en', EN_SCENARIO_TEMPLATES, 54),
  ...buildInjectionFixtures(),
  {
    id: 'default',
    locale: 'en',
    input: 'generic sos help needed',
    tags: ['en', 'fallback'],
    output: suggestion({
      categories: ['general'],
      persons_estimate: null,
      injuries_reported: [],
      needs: ['assistance'],
      urgency_suggestion: 'unknown',
      uncertainty: true,
      quoted_evidence: ['help needed'],
      location_unknown: true,
      language: 'en',
      confidence: 'low',
    }),
  },
];

export const EVAL_FIXTURE_COUNT = EVAL_FIXTURES.length;
