import { Card } from '../components/ui/Card';

export function About() {
  return (
    <div className="container animate-fade-in" style={{ maxWidth: '900px' }}>
      <h1 className="text-h1" style={{ marginBottom: '16px' }}>About Mtaaexpress</h1>
      <Card style={{ padding: '24px' }}>
        <p className="text-body" style={{ marginBottom: '12px' }}>
          Mtaaexpress is a hyperlocal delivery platform connecting customers with nearby stores and trusted drivers.
        </p>
        <p className="text-body" style={{ marginBottom: '12px' }}>
          Our mission is to make local commerce fast, reliable, and accessible with clear order tracking and real-time delivery updates.
        </p>
        <p className="text-body">
          Contact: help@mtaaexpress.com
        </p>
      </Card>
    </div>
  );
}
