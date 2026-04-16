import { useEffect, useRef } from 'react';
import { Form } from '@bpmn-io/form-js-viewer';
import '@bpmn-io/form-js-viewer/dist/assets/form-js.css';

interface CamundaFormRendererProps {
  schema: Record<string, unknown>;
  data?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onError?: (errors: Record<string, unknown>) => void;
  submitLabel?: string;
  submitting?: boolean;
}

export default function CamundaFormRenderer({
  schema,
  data = {},
  onSubmit,
  onError,
  submitLabel,
  submitting = false,
}: CamundaFormRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<InstanceType<typeof Form> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const form = new Form({ container: containerRef.current });
    formRef.current = form;

    form.importSchema(schema, data);

    form.on(
      'submit',
      (event: { data: Record<string, unknown>; errors: Record<string, unknown> }) => {
        if (Object.keys(event.errors).length > 0) {
          onError?.(event.errors);
          return;
        }
        onSubmit(event.data);
      }
    );

    return () => {
      form.destroy();
      formRef.current = null;
    };
  }, [schema]);

  return (
    <div className="camunda-form-wrapper">
      <div ref={containerRef} className="camunda-form-container" />
      {submitLabel && (
        <div className="camunda-form-actions">
          <button
            className="btn btn-primary camunda-submit-btn"
            disabled={submitting}
            onClick={() => formRef.current?.submit()}
          >
            {submitting ? 'Submitting…' : submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
