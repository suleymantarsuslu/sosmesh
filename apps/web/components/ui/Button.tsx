import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  children: ReactNode;
};

export function Button({ variant = 'primary', className = '', children, ...rest }: Props) {
  return (
    <button type="button" className={`ui-button ui-button--${variant} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
