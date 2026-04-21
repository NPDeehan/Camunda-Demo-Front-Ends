import { useDemos } from '../hooks/useDemos';
import DemoCard from '../components/DemoCard';

export default function Hub() {
  const demos = useDemos();

  return (
    <div className="hub">
      <div className="hub-hero">
        <h1 className="hub-hero-title">Camunda Demo Hub</h1>
        <p className="hub-hero-sub">Explore live process automation demos</p>
      </div>
      <div className="hub-grid-section">
        {demos.length > 0 && (
          <p className="hub-grid-label">Available demos</p>
        )}
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
    </div>
  );
}
