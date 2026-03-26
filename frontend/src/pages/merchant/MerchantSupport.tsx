import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { merchantFetch } from './merchantApi';

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
}

export function MerchantSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [error, setError] = useState('');

  async function loadTickets() {
    try {
      const payload = await merchantFetch<SupportTicket[]>('/api/merchant/support-tickets');
      setTickets(payload);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load support tickets');
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  const createTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    try {
      await merchantFetch<SupportTicket>('/api/merchant/support-tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          description,
          priority,
          category: 'GENERAL',
        }),
      });
      setSubject('');
      setDescription('');
      setPriority('NORMAL');
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create support ticket');
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '16px' }}>Support Center</h1>
      {error && <p style={{ color: 'var(--error)', marginBottom: '10px' }}>{error}</p>}

      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '10px' }}>Create Ticket</h3>
        <form onSubmit={createTicket} style={{ display: 'grid', gap: '8px' }}>
          <input className="input-field" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="input-field" rows={3} placeholder="Describe the issue" value={description} onChange={(e) => setDescription(e.target.value)} />
          <select className="input-field" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <div><Button type="submit">Submit Ticket</Button></div>
        </form>
      </Card>

      <Card style={{ padding: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '10px' }}>Your Tickets</h3>
        {tickets.length === 0 ? <p className="text-sm text-muted">No tickets yet.</p> : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {tickets.map((ticket) => (
              <div key={ticket.id} style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <div className="flex-between" style={{ marginBottom: '4px', gap: '8px', flexWrap: 'wrap' }}>
                  <strong>{ticket.subject}</strong>
                  <span className="text-sm text-muted">{ticket.status} | {ticket.priority}</span>
                </div>
                <p className="text-sm text-muted">{ticket.description}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
