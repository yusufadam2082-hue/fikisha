import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { apiUrl } from '../../utils/apiUrl';
import { getAuthHeaders } from '../../utils/authStorage';

type RoleOption = {
  id: string;
  name: string;
};

type AdminUser = {
  adminId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  adminRoleId?: string;
  adminRoleName?: string;
  isActive?: boolean;
  notes?: string | null;
};

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  roleId: '',
  isActive: true,
  notes: ''
};

export function AdminUsers() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingAdminId, setEditingAdminId] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const [adminsRes, rolesRes] = await Promise.all([
      fetch(apiUrl('/api/admin/admin-users'), { headers: getAuthHeaders(false) }),
      fetch(apiUrl('/api/admin/roles'), { headers: getAuthHeaders(false) })
    ]);

    if (!adminsRes.ok || !rolesRes.ok) {
      throw new Error('Failed to load admin management data');
    }

    const adminsPayload = await adminsRes.json();
    const rolesPayload = await rolesRes.json();
    setAdmins(Array.isArray(adminsPayload) ? adminsPayload : []);
    setRoles(Array.isArray(rolesPayload) ? rolesPayload.map((role) => ({ id: role.id, name: role.name })) : []);
  };

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load admins'));
  }, []);

  const title = useMemo(() => editingAdminId ? 'Update Admin' : 'Create Admin', [editingAdminId]);

  const startEdit = (admin: AdminUser) => {
    setEditingAdminId(admin.adminId);
    setForm({
      fullName: admin.name || '',
      email: admin.email || '',
      phone: admin.phone || '',
      password: '',
      confirmPassword: '',
      roleId: admin.adminRoleId || '',
      isActive: admin.isActive !== false,
      notes: admin.notes || ''
    });
  };

  const reset = () => {
    setEditingAdminId('');
    setForm(emptyForm);
  };

  const save = async () => {
    const url = editingAdminId ? `/api/admin/admin-users/${editingAdminId}` : '/api/admin/admin-users';
    const method = editingAdminId ? 'PUT' : 'POST';
    const response = await fetch(apiUrl(url), {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error || 'Failed to save admin');
      return;
    }

    setMessage(editingAdminId ? 'Admin updated successfully.' : 'Admin created successfully.');
    reset();
    await load();
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '8px' }}>Admin Users</h1>
      <p className="text-muted" style={{ marginBottom: '24px' }}>Super Admin-only management for platform administrator accounts.</p>
      {message ? <p className="text-sm" style={{ marginBottom: '16px', color: message.toLowerCase().includes('failed') ? 'var(--error)' : 'var(--primary)' }}>{message}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        <Card style={{ padding: '20px' }} hoverable={false}>
          <h2 className="text-h3" style={{ marginBottom: '14px' }}>Existing Admins</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {admins.map((admin) => (
              <div key={admin.adminId} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div className="flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{admin.name}</strong>
                    <p className="text-sm text-muted" style={{ marginBottom: '4px' }}>{admin.email || admin.phone}</p>
                    <p className="text-sm text-muted" style={{ marginBottom: 0 }}>{admin.adminRoleName} • {admin.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startEdit(admin)}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ padding: '20px' }} hoverable={false}>
          <h2 className="text-h3" style={{ marginBottom: '14px' }}>{title}</h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            <input className="input-field" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))} />
            <input className="input-field" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
            <input className="input-field" placeholder="Phone number" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
            <input className="input-field" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} />
            <input className="input-field" placeholder="Confirm password" type="password" value={form.confirmPassword} onChange={(e) => setForm((current) => ({ ...current, confirmPassword: e.target.value }))} />
            <select className="input-field" value={form.roleId} onChange={(e) => setForm((current) => ({ ...current, roleId: e.target.value }))}>
              <option value="">Select role</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <label className="text-sm" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))} />
              Active
            </label>
            <textarea className="input-field" rows={3} placeholder="Optional notes" value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button onClick={save}>{editingAdminId ? 'Update Admin' : 'Create Admin'}</Button>
              <Button variant="outline" onClick={reset}>Clear</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
