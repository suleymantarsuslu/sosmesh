import Link from 'next/link';

import { SosMeshLogo } from '../components/brand/SosMeshLogo';

export default function Home() {
  return (
    <main className="container marketing-home">
      <header className="marketing-home__header">
        <SosMeshLogo size={64} priority />
        <h1>SOSMesh Operator Dashboard</h1>
      </header>
      <div className="warning-banner" role="note">
        <p>
          <strong>ÖNEMLİ:</strong> SOSMesh, 112 resmî acil çağrı hizmetinin yerine geçmez.
          Deneysel bir acil durum haberleşme mesh ağı prototipidir.
        </p>
      </div>
      <p className="marketing-home__lead">
        Operatör paneline giriş yapın veya yardım bölümünü inceleyin.
      </p>
      <div className="marketing-home__actions">
        <Link className="ui-button ui-button--primary" href="/operator/login">
          Operatör girişi
        </Link>
        <Link className="ui-button ui-button--ghost" href="/operator/help">
          Yardım
        </Link>
      </div>
    </main>
  );
}
