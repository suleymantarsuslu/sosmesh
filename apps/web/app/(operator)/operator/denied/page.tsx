import Link from 'next/link';

export default function OperatorDeniedPage() {
  return (
    <main className="denied-page" data-testid="role-denied">
      <h1>Yetki gerekli</h1>
      <p>Bu sayfayı görüntülemek için uygun operatör rolüne sahip değilsiniz.</p>
      <Link className="ui-button ui-button--primary" href="/operator/dashboard">
        Panele dön
      </Link>
    </main>
  );
}
