export const lightColors = {
  primary: '#369596',
  backgroundLight: '#f9fafb',
  surfaceLight: '#ffffff',
  text: '#0f172a',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  error: '#ef4444',
  success: '#10b981',
};

export const darkColors = {
  primary: '#38bdf8', // Light Blue 400 - more vibrant against dark slate
  backgroundLight: '#0f172a', // Slate 900
  surfaceLight: '#1e293b', // Slate 800
  text: '#f1f5f9', // Slate 100
  textSecondary: '#94a3b8', // Slate 400
  border: '#334155', // Slate 700
  error: '#f87171', // Red 400
  success: '#4ade80', // Green 400
};

// Static export for layout values (shared between modes)
// Colors here are light-mode defaults used in StyleSheet.create (fallback)
export const colors = lightColors;

export const theme = {
  colors,
  spacing: {
    xs: 4,
    s: 8,
    m: 12,
    l: 16,
    xl: 24,
    xxl: 32,
  },
  borderRadius: {
    s: 4,
    m: 8,
    l: 12,
    xl: 16,
    full: 9999,
  },
};
