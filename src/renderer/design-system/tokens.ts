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
  background: '#212121',
  surface: '#242424',
  surfaceElevated: '#2a2a2a',
  surfaceBorder: '#242424',

  // Text
  textPrimary: '#f8f8ff',
  textSecondary: '#f4f4ff',
  textMuted: '#d8d8e6',
  textDisabled: '#a8a8b8',

  // Accent
  accent: '#f4f4ff',
  accentHover: '#ffffff',
  accentSubtle: '#2a2a2a',

  // Semantic
  danger: '#e05c5c',
  dangerSubtle: '#2d2222',
  success: '#5cba8a',
  successSubtle: '#222d26',
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
  sm: '0 1px 3px #00000066',
  md: '0 4px 12px #00000080',
  lg: '0 8px 24px #00000099',
} as const;

export const transition = {
  fast: '100ms ease',
  normal: '160ms ease',
  slow: '240ms ease',
} as const;
