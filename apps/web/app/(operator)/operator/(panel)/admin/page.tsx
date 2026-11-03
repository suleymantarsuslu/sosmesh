import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  translate,
  type OperatorLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
} from '../../../../../lib/i18n/operator-messages';
import { readSession } from '../../../../../lib/session';

export default async function OperatorAdminPage() {
  const session = await readSession();
  if (!session) {
    redirect('/operator/login?next=/operator/admin');
  }
  if (session.role !== 'ADMIN') {
    redirect('/operator/denied');
  }
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale: OperatorLocale = value === 'tr' ? 'tr' : DEFAULT_LOCALE;

  return (
    <>
      <h1>{translate(locale, 'web.admin.title')}</h1>
      <p>{translate(locale, 'web.admin.intro')}</p>
    </>
  );
}
