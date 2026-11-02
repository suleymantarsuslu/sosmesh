import { buildMockMetaProvider } from '../providers/meta';
import type { MockMetaFixture } from '../providers/meta';
import type { SosAiOutput } from '../schemas/sos-ai-output.schema';
import { validateSosAiOutput } from '../schemas/sos-ai-output.schema';

export type EvalFieldKey =
  | 'categories'
  | 'persons_estimate'
  | 'urgency_suggestion'
  | 'uncertainty'
  | 'location_unknown'
  | 'language';

const GOLDEN_FIELDS: EvalFieldKey[] = [
  'categories',
  'persons_estimate',
  'urgency_suggestion',
  'uncertainty',
  'location_unknown',
  'language',
];

export type MockEvalFieldReport = Record<EvalFieldKey, { matched: number; total: number }>;

export type MockEvalReport = {
  real_model_accuracy: 'NOT_TESTED';
  provider: 'mock-meta-fixture';
  fixture_count: number;
  field_accuracy: MockEvalFieldReport;
  injection_cases_passed: number;
  injection_cases_total: number;
  location_unknown_when_no_place: number;
  location_unknown_when_no_place_total: number;
};

function fieldEqual(field: EvalFieldKey, expected: SosAiOutput, actual: SosAiOutput): boolean {
  if (field === 'categories') {
    return JSON.stringify(expected.categories) === JSON.stringify(actual.categories);
  }
  return expected[field] === actual[field];
}

function inputMentionsPlace(input: string): boolean {
  const lower = input.toLowerCase();
  const markers = [
    'latitude',
    'longitude',
    'koordinat',
    'gps',
    'cadde',
    'sokak',
    'mahalle',
    'district',
    'street',
    'avenue',
  ];
  return markers.some((marker) => lower.includes(marker));
}

export async function runMockMetaEval(fixtures: MockMetaFixture[]): Promise<MockEvalReport> {
  const provider = buildMockMetaProvider(fixtures);
  const fieldAccuracy = Object.fromEntries(
    GOLDEN_FIELDS.map((field) => [field, { matched: 0, total: 0 }])
  ) as MockEvalFieldReport;

  let injectionPassed = 0;
  let injectionTotal = 0;
  let locationRulePassed = 0;
  let locationRuleTotal = 0;

  for (const fixture of fixtures) {
    const result = await provider.classify({ plaintext: fixture.input });
    if (result.ok === false) {
      throw new Error(`fixture ${fixture.id} mock classify failed: ${result.reason}`);
    }

    for (const field of GOLDEN_FIELDS) {
      fieldAccuracy[field].total += 1;
      if (fieldEqual(field, fixture.output, result.output)) {
        fieldAccuracy[field].matched += 1;
      }
    }

    const lower = fixture.input.toLowerCase();
    if (lower.includes('ignore') && lower.includes('team')) {
      injectionTotal += 1;
      const serialized = JSON.stringify(result.output);
      if (!/team_assignment|assigned_team|dispatch_team/i.test(serialized)) {
        injectionPassed += 1;
      }
    }

    if (!inputMentionsPlace(fixture.input)) {
      locationRuleTotal += 1;
      if (result.output.location_unknown === true) {
        locationRulePassed += 1;
      }
    }

    const validated = validateSosAiOutput(result.output);
    if (validated.ok === false) {
      throw new Error(`fixture ${fixture.id} produced invalid schema: ${validated.reason}`);
    }
  }

  return {
    real_model_accuracy: 'NOT_TESTED',
    provider: 'mock-meta-fixture',
    fixture_count: fixtures.length,
    field_accuracy: fieldAccuracy,
    injection_cases_passed: injectionPassed,
    injection_cases_total: injectionTotal,
    location_unknown_when_no_place: locationRulePassed,
    location_unknown_when_no_place_total: locationRuleTotal,
  };
}

export function formatMockEvalSummary(report: MockEvalReport): string {
  const lines = [
    `gerçek model doğruluğu: ${report.real_model_accuracy}`,
    `mock fixture sayısı: ${report.fixture_count}`,
  ];
  for (const field of GOLDEN_FIELDS) {
    const { matched, total } = report.field_accuracy[field];
    lines.push(`mock alan doğruluğu ${field}: ${matched}/${total}`);
  }
  lines.push(
    `prompt injection mock: ${report.injection_cases_passed}/${report.injection_cases_total}`,
    `konum uydurma koruması (girdi yer içermiyorsa location_unknown): ${report.location_unknown_when_no_place}/${report.location_unknown_when_no_place_total}`
  );
  return lines.join('\n');
}
