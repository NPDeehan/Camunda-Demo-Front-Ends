import { Link } from 'react-router-dom';
import type { DemoConfig } from '../types/demo';

export default function DemoCard({ demo }: { demo: DemoConfig }) {
  return (
    <Link
      to={`/${demo.id}`}
      className="demo-card"
      style={{ '--card-primary': demo.branding.primaryColor } as React.CSSProperties}
    >
      <div
        className="demo-card-logo-wrap"
        style={{ background: `${demo.branding.primaryColor}12` }}
      >
        {demo.branding.logo && (
          <img src={demo.branding.logo} alt="" className="demo-card-logo" />
        )}
      </div>
      <div className="demo-card-body">
        <h3 className="demo-card-title">{demo.title}</h3>
        <p className="demo-card-desc">{demo.description}</p>
      </div>
      <div className="demo-card-footer">
        <span className="demo-card-launch">Launch &rarr;</span>
      </div>
    </Link>
  );
}
