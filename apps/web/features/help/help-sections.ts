export const HELP_SECTION_IDS = [
  'offline',
  'permissions',
  'relay',
  'watch',
  'ack',
  'failed',
  'limits',
  'matrix',
] as const;

export type HelpSectionId = (typeof HELP_SECTION_IDS)[number];

export const HELP_I18N_KEYS: Record<
  HelpSectionId,
  { title: string; body: string }
> = {
  offline: { title: 'web.help.offlineTitle', body: 'web.help.offlineBody' },
  permissions: {
    title: 'web.help.permissionsTitle',
    body: 'web.help.permissionsBody',
  },
  relay: { title: 'web.help.relayTitle', body: 'web.help.relayBody' },
  watch: { title: 'web.help.watchTitle', body: 'web.help.watchBody' },
  ack: { title: 'web.help.ackTitle', body: 'web.help.ackBody' },
  failed: { title: 'web.help.failedTitle', body: 'web.help.failedBody' },
  limits: { title: 'web.help.limitsTitle', body: 'web.help.limitsBody' },
  matrix: { title: 'web.help.matrixTitle', body: 'web.help.matrixBody' },
};

export const HELP_REQUIRED_KEYS = [
  'web.help.title',
  'web.help.intro',
  'web.help.not112',
  'web.help.supportTitle',
  'web.help.supportNote',
  'web.help.supportBlocked',
  'web.help.linkPrivacy',
  'web.help.linkTerms',
  'web.help.linkSecurity',
  'web.help.docLinksTitle',
  ...HELP_SECTION_IDS.flatMap((id) => [
    HELP_I18N_KEYS[id].title,
    HELP_I18N_KEYS[id].body,
  ]),
] as const;

export const REPO_DOC_BASE =
  'https://github.com/suleymantarsuslu/sosmesh/blob/main';

export const HELP_DOC_LINKS = {
  privacy: `${REPO_DOC_BASE}/docs/legal/privacy-policy-draft.md`,
  terms: `${REPO_DOC_BASE}/docs/legal/terms-of-use-draft.md`,
  security: `${REPO_DOC_BASE}/SECURITY.md`,
  guideTr: `${REPO_DOC_BASE}/docs/user/kullanici-rehberi-tr.md`,
  guideEn: `${REPO_DOC_BASE}/docs/user/user-guide-en.md`,
} as const;
