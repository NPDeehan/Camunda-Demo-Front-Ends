import { Link } from 'react-router-dom';
import { useDemoConfig } from '../hooks/useDemoConfig';

export default function DemoSuccessPage() {
  const { config } = useDemoConfig();

  return (
    <div className="demo-success">
      <div className="success-icon">&#10003;</div>
      <h2>Process Started</h2>
      <p>
        A new instance of <strong>{config?.title}</strong> has been started
        successfully.
      </p>
      <div className="success-actions">
        <Link to={`/${config?.id}`} className="btn btn-primary">
          Submit Another
        </Link>
        <Link to="/" className="btn btn-secondary">
          Back to Hub
        </Link>
      </div>
    </div>
  );
}
