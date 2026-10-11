/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */
import { Platform } from 'react-native';

export const Colors = {
  light: {
    primary: '#16a34a',
    primaryLight: '#dcfce7',
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0FDF4',
    backgroundSelected: '#DCFCE7',
    textSecondary: '#64748B',
  },
  dark: {
    primary: '#22c55e',
    primaryLight: '#14532d',
    text: '#ffffff',
    background: '#0f172a',
    backgroundElement: '#1e293b',
    backgroundSelected: '#334155',
    textSecondary: '#94a3b8',
  },
} as const;

export const BrandColors = {
  primary: '#16a34a',
  primaryDark: '#15803d',
  primaryLight: '#22c55e',
  primarySubtle: '#dcfce7',
  primaryBg: '#f0fdf4',
  white: '#ffffff',
  slateDark: '#0f172a',
  slateText: '#334155',
  slateMuted: '#64748b',
  slateBorder: '#e2e8f0',
  slateBg: '#f8fafc',
  error: '#ef4444',
  success: '#16a34a',
  blue: '#2563eb',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
