'use client';

type Props = {
  visible: boolean;
};

export function DemoModeBanner({ visible }: Props) {
  if (!visible) {
    return null;
  }
  return (
    <div
      className="ui-demo-mode-banner"
      role="status"
      data-testid="demo-mode-banner"
    >
      DEMO MODE — Sentetik/mock veri; gerçek acil durum kaydı değildir.
    </div>
  );
}
