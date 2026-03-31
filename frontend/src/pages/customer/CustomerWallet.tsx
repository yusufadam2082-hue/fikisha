import { Wallet } from 'lucide-react';
import { Card } from '../../components/ui/Card';

export function CustomerWallet() {
  return (
    <div className="container" style={{ padding: '64px 24px', minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ padding: '48px', maxWidth: '400px', width: '100%', textAlign: 'center', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(16px)' }}>
        <div style={{ padding: '24px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', borderRadius: '50%', display: 'inline-flex', marginBottom: '24px' }}>
          <Wallet size={48} />
        </div>
        <h1 className="text-h2" style={{ marginBottom: '16px' }}>Your Wallet</h1>
        <p className="text-muted" style={{ marginBottom: '32px' }}>
          We are building something amazing! Soon you will be able to top up your balance, pay seamlessly, and earn cashback with Fikisha Pay.
        </p>
        <div style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--primary)', color: 'white', fontWeight: 600, letterSpacing: '1px', fontSize: '0.85rem', textTransform: 'uppercase' }}>
          Coming Soon
        </div>
      </Card>
    </div>
  );
}
