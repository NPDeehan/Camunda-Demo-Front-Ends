import type { ComponentType } from 'react';

export interface DemoConfig {
  /** URL-safe slug, must match folder name */
  id: string;
  /** Human-readable title */
  title: string;
  /** Short description for the hub card */
  description: string;
  /** The bpmnProcessId deployed to Camunda 8 */
  processId: string;
  /** Branding options */
  branding: {
    primaryColor: string;
    accentColor?: string;
    backgroundColor?: string;
    logo?: string;
    backgroundImage?: string;
  };
  /** Optional additional pages */
  pages?: DemoPage[];
  /** Optional React component that replaces the default form page */
  customFormPage?: ComponentType<CustomFormPageProps>;
  /** Optional hardcoded form schema (skip Camunda API fetch) */
  formSchema?: Record<string, unknown>;
  /** Optional static variables merged with form data on submission */
  staticVariables?: Record<string, unknown>;
}

export interface DemoPage {
  path: string;
  label: string;
  component: ComponentType<Record<string, unknown>>;
}

export interface CustomFormPageProps {
  config: DemoConfig;
  onSubmit: (variables: Record<string, unknown>) => Promise<void>;
}
