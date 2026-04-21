import { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useDemoConfig } from '../hooks/useDemoConfig';
import { applyDemoTheme, clearDemoTheme } from '../utils/theme';

export default function DemoShell() {
  const { config, demoId } = useDemoConfig();

  useEffect(() => {
    if (config) applyDemoTheme(config);
    return () => clearDemoTheme();
  }, [config]);

  if (!config) {
    return (
      <div className="not-found">
        <h2>Demo "{demoId}" not found</h2>
        <Link to="/">Back to Hub</Link>
      </div>
    );
  }

  // Custom pages manage their own full-width layout
  if (config.customFormPage) {
    return <Outlet />;
  }

  return (
    <div
      className="demo-shell"
      style={{ background: config.branding.backgroundColor ?? '#f5f7fa' }}
    >
      <div className="demo-header" style={{ backgroundColor: config.branding.primaryColor }}>
        {config.branding.logo && (
          <div className="demo-header-logo-wrap">
            <img src={config.branding.logo} alt="" className="demo-header-logo" />
          </div>
        )}
        <h1 className="demo-header-title">{config.title}</h1>
        <Link to="/" className="demo-header-back">
          &larr; Hub
        </Link>
      </div>
      <div className="demo-content">
        <Outlet />
      </div>
    </div>
  );
}
