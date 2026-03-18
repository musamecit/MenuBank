export interface ColorSet {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  subtext?: string; // alias for textSecondary (legacy)
  accent: string;
  accentDark: string;
  accentMuted: string;
  border: string;
  error: string;
  skeleton: string;
  card: string;
  tabBar: string;
  tabBarBorder: string;
  mapStyle: 'standard' | 'dark';
}

export const lightColors: ColorSet = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  subtext: '#6B7280',
  accent: '#16A34A',
  accentDark: '#15803D',
  accentMuted: '#DCFCE7',
  border: '#E5E7EB',
  error: '#EF4444',
  skeleton: '#E5E7EB',
  card: '#FFFFFF',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  mapStyle: 'standard',
};

export const darkColors: ColorSet = {
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  subtext: '#94A3B8',
  accent: '#22C55E',
  accentDark: '#16A34A',
  accentMuted: '#14532D',
  border: '#334155',
  error: '#F87171',
  skeleton: '#334155',
  card: '#1E293B',
  tabBar: '#0F172A',
  tabBarBorder: '#1E293B',
  mapStyle: 'dark',
};
