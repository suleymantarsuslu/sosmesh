import Image from 'next/image';

type SosMeshLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Master-derived logo (`branding/sosmesh-logo-source.png` → `/brand/sosmesh-logo.png`). */
export function SosMeshLogo({ size = 48, className, priority = false }: SosMeshLogoProps) {
  return (
    <Image
      src="/brand/sosmesh-logo.png"
      alt="SOSMesh"
      width={size}
      height={size}
      className={className}
      data-testid="sosmesh-logo"
      priority={priority}
    />
  );
}
