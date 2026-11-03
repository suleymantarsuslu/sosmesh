import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', className = '', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
});
