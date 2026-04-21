import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoConfig } from '../hooks/useDemoConfig';
import { useStartForm } from '../hooks/useStartForm';
import { useTaskLoop } from '../hooks/useTaskLoop';
import {
  getProcessDefinitionKey,
  startProcessInstance,
} from '../api/processApi';
import type { DemoConfig } from '../types/demo';
import CamundaFormRenderer from '../components/CamundaFormRenderer';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';

function PulseIcon() {
  return (
    <div className="pulse-icon">
      <div className="pulse-dot" />
      <div className="pulse-ring pulse-ring--1" />
      <div className="pulse-ring pulse-ring--2" />
      <div className="pulse-ring pulse-ring--3" />
    </div>
  );
}

// Delays (ms) at which steps 1, 2, 3... become active.
// The last step stays in "active" (spinning) state until the task actually arrives.
const STEP_DELAYS = [3500, 9000, 17000];

function StepTracker({ steps }: { steps: string[] }) {
  const [active, setActive] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current = steps.slice(1).map((_, i) =>
      setTimeout(
        () => setActive(prev => Math.max(prev, i + 1)),
        STEP_DELAYS[i] ?? (i + 1) * 6000,
      ),
    );
    return () => timersRef.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="step-tracker">
      {steps.map((label, i) => {
        const done = i < active;
        const current = i === active;
        const cls = done ? 'is-done' : current ? 'is-active' : 'is-pending';
        return (
          <div key={i} className={`step-item ${cls}`}>
            <div className="step-icon">
              {done && <span className="step-check">✓</span>}
              {current && <span className="step-spin" />}
            </div>
            <span className="step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TaskLoopPanel({
  processInstanceKey,
  config,
}: {
  processInstanceKey: string;
  config: DemoConfig;
}) {
  const navigate = useNavigate();
  const { state, completeTask } = useTaskLoop(processInstanceKey, config.taskLoop);

  useEffect(() => {
    if (state.status === 'done') navigate('success');
  }, [state.status, navigate]);

  if (state.status === 'error') {
    return <ErrorBanner message={state.message} />;
  }

  if (state.status === 'polling' || state.status === 'completing') {
    const steps = config.taskLoop?.waitingSteps;
    return (
      <div className="task-loop-waiting">
        {config.branding.logo && (
          <div className="task-loop-logo-wrap">
            <img src={config.branding.logo} alt="" className="task-loop-logo" />
          </div>
        )}
        {steps ? (
          <>
            <p className="task-loop-waiting-label task-loop-waiting-label--steps">
              {config.taskLoop?.waitingTitle ?? 'Processing your request…'}
            </p>
            <StepTracker steps={steps} />
          </>
        ) : (
          <>
            <PulseIcon />
            <p className="task-loop-waiting-label">
              {config.taskLoop?.waitingTitle ?? 'Waiting for a response…'}
            </p>
            {config.taskLoop?.waitingSubtitle && (
              <p className="task-loop-waiting-sub">{config.taskLoop.waitingSubtitle}</p>
            )}
          </>
        )}
      </div>
    );
  }

  if (state.status === 'task-active') {
    return (
      <div className="demo-form-page">
        {state.task.name && (
          <h2 className="task-loop-task-name">{state.task.name}</h2>
        )}
        <CamundaFormRenderer
          schema={state.formSchema}
          data={state.variables}
          submitLabel="Send Response"
          onSubmit={completeTask}
        />
      </div>
    );
  }

  return null;
}

export default function DemoFormPage() {
  const { config } = useDemoConfig();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [processInstanceKey, setProcessInstanceKey] = useState<string | null>(null);

  const { schema, loading, error } = useStartForm(
    config!.processId,
    config!.formSchema
  );

  if (!config) return null;

  if (config.customFormPage) {
    const CustomPage = config.customFormPage;
    return (
      <CustomPage
        config={config}
        onSubmit={async (variables) => {
          const merged = { ...config.staticVariables, ...variables };
          const key = await getProcessDefinitionKey(config.processId);
          await startProcessInstance(key, merged);
        }}
      />
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!schema) return <ErrorBanner message="No form available for this process." />;

  // Non-taskLoop path: original behaviour unchanged
  if (!config.taskLoop) {
    return (
      <div className="demo-form-page">
        <p className="demo-form-desc">{config.description}</p>
        {submitError && <ErrorBanner message={submitError} />}
        <CamundaFormRenderer
          schema={schema}
          submitLabel="Submit Application"
          submitting={submitting}
          onSubmit={async (data) => {
            setSubmitting(true);
            setSubmitError(null);
            try {
              const merged = { ...config.staticVariables, ...data };
              const key = await getProcessDefinitionKey(config.processId);
              await startProcessInstance(key, merged);
              navigate('success');
            } catch (e) {
              setSubmitError((e as Error).message);
            } finally {
              setSubmitting(false);
            }
          }}
        />
      </div>
    );
  }

  // taskLoop path: once the process starts, swap the form out entirely for the task loop panel
  if (processInstanceKey) {
    return <TaskLoopPanel processInstanceKey={processInstanceKey} config={config} />;
  }

  return (
    <div className="demo-form-page">
      <p className="demo-form-desc">{config.description}</p>
      {submitError && <ErrorBanner message={submitError} />}
      <CamundaFormRenderer
        schema={schema}
        submitLabel="Submit"
        submitting={submitting}
        onSubmit={async (data) => {
          setSubmitting(true);
          setSubmitError(null);
          try {
            const merged = { ...config.staticVariables, ...data };
            const key = await getProcessDefinitionKey(config.processId);
            const instance = await startProcessInstance(key, merged);
            setProcessInstanceKey(instance.processInstanceKey);
          } catch (e) {
            setSubmitError((e as Error).message);
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
}
