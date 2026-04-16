import type { DemoConfig } from '../types/demo';

export function applyDemoTheme(config: DemoConfig) {
  const root = document.documentElement;
  const { branding } = config;
  root.style.setProperty('--demo-primary', branding.primaryColor);
  root.style.setProperty('--demo-accent', branding.accentColor || branding.primaryColor);
  root.style.setProperty('--demo-bg', branding.backgroundColor || '#ffffff');
}

export function clearDemoTheme() {
  const root = document.documentElement;
  root.style.removeProperty('--demo-primary');
  root.style.removeProperty('--demo-accent');
  root.style.removeProperty('--demo-bg');
}
