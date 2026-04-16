import { useDemos } from '../hooks/useDemos';
import DemoCard from '../components/DemoCard';

export default function Hub() {
  const demos = useDemos();

  return (
    <div className="hub">
      <div className="hub-header">
        <h1>Camunda Demo Hub</h1>
        <p>Pick a demo to get started</p>
      </div>
      <div className="hub-grid">
        {demos.map((demo) => (
          <DemoCard key={demo.id} demo={demo} />
        ))}
      </div>
      {demos.length === 0 && (
        <p className="hub-empty">
          No demos found. Add a folder to <code>src/demos/</code> with a{' '}
          <code>config.ts</code> file.
        </p>
      )}
    </div>
  );
}
