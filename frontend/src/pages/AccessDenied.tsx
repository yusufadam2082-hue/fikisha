import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function AccessDenied() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-color)' }}>
      <Card style={{ maxWidth: '520px', width: '100%', padding: '32px', textAlign: 'center' }} hoverable={false}>
        <div style={{ display: 'inline-flex', padding: '18px', borderRadius: '999px', background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', marginBottom: '18px' }}>
          <ShieldAlert size={36} />
        </div>
        <h1 className="text-h2" style={{ marginBottom: '10px' }}>Access Denied</h1>
        <p className="text-muted" style={{ marginBottom: '20px' }}>
          You do not have permission to access this area{from ? `: ${from}` : '.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/admin" style={{ textDecoration: 'none' }}>
            <Button>Back to dashboard</Button>
          </Link>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button variant="outline">Exit admin</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
