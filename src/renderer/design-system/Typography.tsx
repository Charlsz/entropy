import React from 'react';

/**
 * Typography primitives.
 *
 * Instead of a single component with a giant `as` prop,
 * we export named components. This is more readable and IDE-friendly.
 *
 * All components accept a className override for one-off adjustments.
 */

interface TextProps {
  children: React.ReactNode;
  className?: string;
}

export function Heading1({ children, className = '' }: TextProps) {
  return (
    <h1 className={`text-2xl font-semibold tracking-tight text-text-primary ${className}`}>
      {children}
    </h1>
  );
}

export function Heading2({ children, className = '' }: TextProps) {
  return (
    <h2 className={`text-xl font-semibold tracking-tight text-text-primary ${className}`}>
      {children}
    </h2>
  );
}

export function Heading3({ children, className = '' }: TextProps) {
  return (
    <h3 className={`text-base font-medium text-text-primary ${className}`}>
      {children}
    </h3>
  );
}

export function Body({ children, className = '' }: TextProps) {
  return (
    <p className={`text-sm leading-relaxed text-text-secondary ${className}`}>
      {children}
    </p>
  );
}

export function Caption({ children, className = '' }: TextProps) {
  return (
    <span className={`text-xs text-text-muted ${className}`}>
      {children}
    </span>
  );
}

export function Label({ children, className = '' }: TextProps) {
  return (
    <span className={`text-xs font-medium uppercase tracking-widest text-text-muted ${className}`}>
      {children}
    </span>
  );
}

export function Code({ children, className = '' }: TextProps) {
  return (
    <code
      className={`rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text-primary ${className}`}
    >
      {children}
    </code>
  );
}
