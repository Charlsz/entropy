import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

function getVariantClasses(variant: ButtonVariant): string {
  if (variant === 'secondary') {
    return 'border border-entropy-border bg-entropy-panel text-entropy-text hover:border-entropy-borderStrong hover:bg-entropy-panelSoft';
  }

  return 'border border-entropy-text bg-entropy-text text-entropy-background hover:bg-[#e3e3ef] hover:border-[#e3e3ef]';
}

export default function Button({ children, className = '', variant = 'primary', type = 'button', ...props }: PropsWithChildren<ButtonProps>) {
  return (
    <button
      type={type}
      className={[
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium tracking-[0.01em] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-entropy-text focus-visible:ring-offset-2 focus-visible:ring-offset-entropy-background disabled:cursor-not-allowed disabled:opacity-50',
        getVariantClasses(variant),
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}