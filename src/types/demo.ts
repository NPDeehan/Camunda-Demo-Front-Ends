import type { ComponentType } from 'react';

export interface TaskLoopConfig {
  /** Polling interval in ms while waiting for a user task to become active. Default: 2000 */
  pollIntervalMs?: number;
  /** Only surface user tasks whose BPMN element ID is in this list. If omitted, all tasks on the instance are shown. */
  taskDefinitionIds?: string[];
  /** Heading shown on the waiting screen while the agent is processing */
  waitingTitle?: string;
  /** Supporting text shown beneath the waiting heading (ignored when waitingSteps is set) */
  waitingSubtitle?: string;
  /** When set, replaces the pulse animation with a step-by-step progress tracker */
  waitingSteps?: string[];
  /** Heading shown on the success page after the process completes */
  successTitle?: string;
  /** Body text shown on the success page after the process completes */
  successMessage?: string;
}

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
  /** When set, after process start the demo polls for user tasks and renders them in a loop */
  taskLoop?: TaskLoopConfig;
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
