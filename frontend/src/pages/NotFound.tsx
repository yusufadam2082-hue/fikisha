import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '16px',
      textAlign: 'center',
      padding: '24px',
    }}>
      <h1 style={{ fontSize: '6rem', fontWeight: 800, color: 'var(--primary)', margin: 0, lineHeight: 1 }}>404</h1>
      <h2 className="text-h2">Page not found</h2>
      <p className="text-muted">The page you're looking for doesn't exist.</p>
      <Link
        to="/customer"
        className="btn-primary"
        style={{ marginTop: '8px', padding: '12px 28px', textDecoration: 'none' }}
      >
        Go home
      </Link>
    </div>
  );
}
