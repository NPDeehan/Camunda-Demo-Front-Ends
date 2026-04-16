import { Link } from 'react-router-dom';
import type { DemoConfig } from '../types/demo';

export default function DemoCard({ demo }: { demo: DemoConfig }) {
  return (
    <Link
      to={`/${demo.id}`}
      className="demo-card"
      style={{ borderTopColor: demo.branding.primaryColor }}
    >
      {demo.branding.logo && (
        <img src={demo.branding.logo} alt="" className="demo-card-logo" />
      )}
      <h3 className="demo-card-title">{demo.title}</h3>
      <p className="demo-card-desc">{demo.description}</p>
      <span
        className="demo-card-launch"
        style={{ color: demo.branding.primaryColor }}
      >
        Launch &rarr;
      </span>
    </Link>
  );
}
