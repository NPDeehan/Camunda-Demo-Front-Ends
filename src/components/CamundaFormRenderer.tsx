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

async function uploadToDocumentStore(file: File): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const res = await fetch('/api/documents', { method: 'POST', body: formData });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Document upload failed: ${res.status}${text ? ` — ${text}` : ''}`);
  }
  return res.json();
}

async function resolveFiles(
  data: Record<string, unknown>,
  files: Map<string, File[]>,
): Promise<Record<string, unknown>> {
  const resolved = { ...data };
  await Promise.all(
    Object.entries(data).map(async ([key, value]) => {
      if (typeof value === 'string' && value.startsWith('files::')) {
        const fileList = files.get(value);
        if (fileList?.length) {
          resolved[key] = await Promise.all(fileList.map(uploadToDocumentStore));
        }
      }
    }),
  );
  return resolved;
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
      async (event: {
        data: Record<string, unknown>;
        errors: Record<string, unknown>;
        files: Map<string, File[]>;
      }) => {
        if (Object.keys(event.errors).length > 0) {
          onError?.(event.errors);
          return;
        }
        const resolved = await resolveFiles(event.data, event.files);
        onSubmit(resolved);
      },
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
