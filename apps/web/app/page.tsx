import Link from 'next/link';

import { SosMeshLogo } from '../components/brand/SosMeshLogo';

export default function Home() {
  return (
    <main className="container marketing-home" data-testid="marketing-home">
      <header className="marketing-home__header">
        <SosMeshLogo size={72} priority />
        <div className="marketing-home__titles">
          <h1>SOSMesh</h1>
          <p className="marketing-home__tagline">Acil durum mesh haberleşme prototipi</p>
        </div>
      </header>
      <div
        className="warning-banner marketing-home__not112"
        role="note"
        data-testid="marketing-not112-banner"
      >
        <p>
          <strong>ÖNEMLİ:</strong> SOSMesh, 112 resmî acil çağrı hizmetinin yerine geçmez.
          Deneysel bir acil durum haberleşme mesh ağı prototipidir.
        </p>
      </div>
      <div className="marketing-home__actions">
        <Link
          className="ui-button ui-button--primary"
          href="/operator/login"
          data-testid="marketing-operator-login"
        >
          Operatör paneline giriş
        </Link>
        <Link className="ui-button ui-button--ghost" href="/operator/help">
          Yardım
        </Link>
      </div>
    </main>
  );
}
