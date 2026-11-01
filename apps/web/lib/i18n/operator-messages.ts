import contentEn from '../../../../docs/ux/content-en.json';
import contentTr from '../../../../docs/ux/content-tr.json';

export type OperatorLocale = 'tr' | 'en';

type MessageTree = typeof contentTr;

const MESSAGES: Record<OperatorLocale, MessageTree> = {
  tr: contentTr,
  en: contentEn as MessageTree,
};

export function translate(locale: OperatorLocale, key: string): string {
  const parts = key.split('.');
  let node: unknown = MESSAGES[locale];
  for (const part of parts) {
    if (typeof node !== 'object' || node === null || !(part in node)) {
      return key;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : key;
}

export function operatorNavLabels(locale: OperatorLocale) {
  return {
    dashboard: translate(locale, 'web.shell.nav.dashboard'),
    cases: translate(locale, 'web.shell.nav.cases'),
    admin: translate(locale, 'web.shell.nav.admin'),
  };
}
