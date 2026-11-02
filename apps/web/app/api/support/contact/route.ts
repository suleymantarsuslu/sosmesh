import { NextResponse } from 'next/server';

/**
 * Support intake is intentionally disabled until prod contact addresses are approved.
 */
export async function POST() {
  return NextResponse.json(
    {
      status: 'BLOCKED_APPROVAL',
      message:
        'Destek kanalı yapılandırılmadı (BLOCKED_APPROVAL). İletişim yer tutucusu: DESTEK_ILETISIM_TBD.',
    },
    { status: 503 }
  );
}
