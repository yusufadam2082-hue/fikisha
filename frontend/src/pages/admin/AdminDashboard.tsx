import { useStoreContext } from '../../context/StoreContext';
import { Card } from '../../components/ui/Card';
import { Store, ShoppingBag, Users, TrendingUp } from 'lucide-react';

export function AdminDashboard() {
  const { stores } = useStoreContext();

  const stats = [
    { name: 'Active Stores', value: stores.length.toString(), icon: Store, color: 'var(--primary)' },
    { name: 'Total Orders', value: '1,284', icon: ShoppingBag, color: '#3b82f6' },
    { name: 'Active Users', value: '3,492', icon: Users, color: '#8b5cf6' },
    { name: 'Revenue', value: 'KES 42.5k', icon: TrendingUp, color: '#22c55e' },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '8px' }}>Admin Overview</h1>
      <p className="text-muted" style={{ marginBottom: '32px' }}>Welcome back. Here's what's happening today.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '48px' }}>
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name} style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '24px' }} hoverable={false}>
              <div style={{ padding: '16px', background: `${stat.color}15`, color: stat.color, borderRadius: 'var(--radius-lg)' }}>
                <Icon size={32} />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted" style={{ marginBottom: '4px' }}>{stat.name}</p>
                <h2 className="text-h1" style={{ fontSize: '2rem' }}>{stat.value}</h2>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
