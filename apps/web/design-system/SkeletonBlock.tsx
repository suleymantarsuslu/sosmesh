export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ds-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="ds-skeleton__line" />
      ))}
    </div>
  );
}
