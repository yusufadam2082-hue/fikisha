import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { apiUrl } from '../../utils/apiUrl';
import { getAuthHeaders } from '../../utils/authStorage';
import { formatKES } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_PERMISSION_KEYS } from '../../utils/adminRbac';

type CustomerRow = {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  banned: boolean;
  orderCount: number;
  totalSpend: number;
  lastOrderAt?: string | null;
};

export function CustomersAdmin() {
  const { hasPermission } = useAuth();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [message, setMessage] = useState('');

  const fetchCustomers = async () => {
    const response = await fetch(apiUrl('/api/customers'), { headers: getAuthHeaders(false) });
    if (!response.ok) {
      throw new Error('Failed to load customers');
    }
    setCustomers(await response.json());
  };

  useEffect(() => {
    fetchCustomers().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load customers'));
  }, []);

  const toggleBan = async (customerId: string) => {
    const response = await fetch(apiUrl(`/api/customers/${customerId}/ban`), {
      method: 'PATCH',
      headers: getAuthHeaders(false)
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error || 'Failed to update customer');
      return;
    }
    await fetchCustomers();
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '8px' }}>Customers</h1>
      <p className="text-muted" style={{ marginBottom: '24px' }}>Customer directory and support controls.</p>
      {message ? <p className="text-sm" style={{ marginBottom: '16px', color: 'var(--error)' }}>{message}</p> : null}
      <Card style={{ padding: '20px' }} hoverable={false}>
        {customers.length === 0 ? (
          <p className="text-sm text-muted">No customers found.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {customers.map((customer) => (
              <div key={customer.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div className="flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{customer.name}</strong>
                    <p className="text-sm text-muted" style={{ marginBottom: '4px' }}>{customer.email || customer.phone || customer.username}</p>
                    <p className="text-sm text-muted" style={{ marginBottom: 0 }}>
                      Orders: {customer.orderCount} • Spend: {formatKES(Number(customer.totalSpend || 0))}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="text-sm" style={{ marginBottom: '8px', color: customer.banned ? 'var(--error)' : 'var(--primary)' }}>
                      {customer.banned ? 'Suspended' : 'Active'}
                    </p>
                    {hasPermission(ADMIN_PERMISSION_KEYS.manageCustomers) ? (
                      <Button size="sm" variant="outline" onClick={() => toggleBan(customer.id)}>
                        {customer.banned ? 'Unsuspend' : 'Suspend'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
