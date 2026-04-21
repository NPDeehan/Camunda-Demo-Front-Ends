import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="app-logo">
          <span className="app-logo-icon" aria-hidden="true" />
          Camunda Demo Hub
        </Link>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">Powered by Camunda 8</footer>
    </div>
  );
}
