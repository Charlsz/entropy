/**
 * Design tokens for Entropy.
 *
 * Why a single file?
 * Tokens are the source of truth for the entire design system.
 * Having them in one place makes global changes trivial.
 * We extend Tailwind with these instead of hardcoding values in components.
 */

export const colors = {
  // Base neutrals — dark mode first
  background: '#0d0d0d',
  surface: '#141414',
  surfaceElevated: '#1a1a1a',
  surfaceBorder: '#242424',

  // Text
  textPrimary: '#e8e8e8',
  textSecondary: '#888888',
  textMuted: '#555555',
  textDisabled: '#3a3a3a',

  // Accent — a single calm blue, never screaming
  accent: '#4a90d9',
  accentHover: '#5a9fe8',
  accentSubtle: 'rgba(74,144,217,0.12)',

  // Semantic
  danger: '#e05c5c',
  dangerSubtle: 'rgba(224,92,92,0.12)',
  success: '#5cba8a',
  successSubtle: 'rgba(92,186,138,0.12)',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
} as const;

export const typography = {
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  fontMono: "'JetBrains Mono', 'Fira Code', monospace",

  size: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
  },

  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  leading: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.65',
  },
} as const;

export const radius = {
  sm: '4px',
  md: '6px',
  lg: '10px',
  full: '9999px',
} as const;

export const shadow = {
  sm: '0 1px 3px rgba(0,0,0,0.4)',
  md: '0 4px 12px rgba(0,0,0,0.5)',
  lg: '0 8px 24px rgba(0,0,0,0.6)',
} as const;

export const transition = {
  fast: '100ms ease',
  normal: '160ms ease',
  slow: '240ms ease',
} as const;
