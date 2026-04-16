import type { DemoConfig } from '../types/demo';

const configModules = import.meta.glob<{ default: DemoConfig }>(
  '../demos/*/config.ts',
  { eager: true }
);

export const demos: DemoConfig[] = Object.values(configModules).map(
  (mod) => mod.default
);

export function getDemoById(id: string): DemoConfig | undefined {
  return demos.find((d) => d.id === id);
}
