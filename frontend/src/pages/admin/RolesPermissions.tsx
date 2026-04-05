import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { apiUrl } from '../../utils/apiUrl';
import { getAuthHeaders } from '../../utils/authStorage';
import { ADMIN_PERMISSION_GROUPS } from '../../utils/adminRbac';

type Permission = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
};

type RoleRecord = {
  id: string;
  name: string;
  description?: string | null;
  isSystemRole?: boolean;
  permissions: Permission[];
};

const emptyForm = {
  name: '',
  description: '',
  permissions: [] as string[]
};

export function RolesPermissions() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingRoleId, setEditingRoleId] = useState('');
  const [message, setMessage] = useState('');

  const permissionsByKey = useMemo(() => new Map(permissions.map((permission) => [permission.key, permission])), [permissions]);

  const load = async () => {
    const [rolesRes, permissionsRes] = await Promise.all([
      fetch(apiUrl('/api/admin/roles'), { headers: getAuthHeaders(false) }),
      fetch(apiUrl('/api/admin/permissions'), { headers: getAuthHeaders(false) })
    ]);

    if (!rolesRes.ok || !permissionsRes.ok) {
      throw new Error('Failed to load RBAC configuration');
    }

    setRoles(await rolesRes.json());
    setPermissions(await permissionsRes.json());
  };

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load RBAC configuration'));
  }, []);

  const togglePermission = (key: string) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter((entry) => entry !== key)
        : [...current.permissions, key]
    }));
  };

  const saveRole = async () => {
    const url = editingRoleId ? `/api/admin/roles/${editingRoleId}` : '/api/admin/roles';
    const method = editingRoleId ? 'PUT' : 'POST';
    const response = await fetch(apiUrl(url), {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error || 'Failed to save role');
      return;
    }

    setMessage(editingRoleId ? 'Role updated successfully.' : 'Role created successfully.');
    setForm(emptyForm);
    setEditingRoleId('');
    await load();
  };

  const startEdit = (role: RoleRecord) => {
    setEditingRoleId(role.id);
    setForm({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions.map((permission) => permission.key)
    });
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '8px' }}>Roles & Permissions</h1>
      <p className="text-muted" style={{ marginBottom: '24px' }}>Super Admin control over role definitions and permission assignment.</p>
      {message ? <p className="text-sm" style={{ marginBottom: '16px', color: message.toLowerCase().includes('failed') ? 'var(--error)' : 'var(--primary)' }}>{message}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px' }}>
        <Card style={{ padding: '20px' }} hoverable={false}>
          <h2 className="text-h3" style={{ marginBottom: '14px' }}>Roles</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {roles.map((role) => (
              <div key={role.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div className="flex-between" style={{ gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <div>
                    <strong>{role.name}</strong>
                    <p className="text-sm text-muted" style={{ marginBottom: 0 }}>{role.description || 'No description'}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startEdit(role)}>Edit</Button>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {role.permissions.map((permission) => (
                    <span key={permission.key} className="text-sm" style={{ padding: '4px 8px', borderRadius: '999px', background: 'var(--surface-hover)' }}>
                      {permission.key}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ padding: '20px' }} hoverable={false}>
          <h2 className="text-h3" style={{ marginBottom: '14px' }}>{editingRoleId ? 'Update Role' : 'Create Role'}</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            <input className="input-field" placeholder="Role name" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            <textarea className="input-field" rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
            {ADMIN_PERMISSION_GROUPS.map((group) => (
              <div key={group.label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <h3 className="text-sm" style={{ fontWeight: 700, marginBottom: '10px' }}>{group.label}</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {group.permissions.map((key) => {
                    const permission = permissionsByKey.get(key);
                    if (!permission) return null;
                    return (
                      <label key={key} className="text-sm" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <input type="checkbox" checked={form.permissions.includes(key)} onChange={() => togglePermission(key)} />
                        <span>
                          <strong>{permission.name}</strong>
                          <span className="text-muted" style={{ display: 'block' }}>{permission.key}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button onClick={saveRole}>{editingRoleId ? 'Update Role' : 'Create Role'}</Button>
              <Button variant="outline" onClick={() => { setForm(emptyForm); setEditingRoleId(''); }}>Clear</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
