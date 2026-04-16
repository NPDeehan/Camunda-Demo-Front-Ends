import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoConfig } from '../hooks/useDemoConfig';
import { useStartForm } from '../hooks/useStartForm';
import {
  getProcessDefinitionKey,
  startProcessInstance,
} from '../api/processApi';
import CamundaFormRenderer from '../components/CamundaFormRenderer';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';

export default function DemoFormPage() {
  const { config } = useDemoConfig();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
          // Navigation intentionally omitted — custom pages manage their own post-submit UX
        }}
      />
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!schema) return <ErrorBanner message="No form available for this process." />;

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
