import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDemoConfig } from '../hooks/useDemoConfig';
import { useTaskLoop } from '../hooks/useTaskLoop';
import CamundaFormRenderer from '../components/CamundaFormRenderer';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';

interface TaskLoopLocationState {
  processInstanceKey?: string;
}

export default function DemoTaskLoopPage() {
  const { config } = useDemoConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const { processInstanceKey } = (location.state ?? {}) as TaskLoopLocationState;

  const { state, completeTask } = useTaskLoop(
    processInstanceKey ?? '',
    config?.taskLoop
  );

  useEffect(() => {
    if (state.status === 'done') {
      navigate('../success', { replace: true });
    }
  }, [state.status, navigate]);

  if (!processInstanceKey) {
    return <ErrorBanner message="No process instance key — navigate here via the start form." />;
  }

  if (state.status === 'error') {
    return <ErrorBanner message={state.message} />;
  }

  if (state.status === 'polling') {
    return (
      <div className="task-loop-waiting">
        <LoadingSpinner />
        <p className="task-loop-waiting-label">The agent is working on a response…</p>
        <p className="task-loop-waiting-sub">This may take a moment. You'll be notified as soon as a response is ready.</p>
      </div>
    );
  }

  if (state.status === 'completing') {
    return (
      <div className="task-loop-waiting">
        <LoadingSpinner />
        <p className="task-loop-waiting-label">Sending your response…</p>
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
          submitLabel="Complete Task"
          onSubmit={completeTask}
        />
      </div>
    );
  }

  return null;
}
