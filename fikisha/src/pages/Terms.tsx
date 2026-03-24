import { Card } from '../components/ui/Card';

export function Terms() {
  return (
    <div className="container animate-fade-in" style={{ maxWidth: '900px' }}>
      <h1 className="text-h1" style={{ marginBottom: '16px' }}>Terms of Service</h1>
      <Card style={{ padding: '24px' }}>
        <p className="text-body" style={{ marginBottom: '12px' }}>
          By using Fikisha, you agree to provide accurate account and delivery information and to use the platform lawfully.
        </p>
        <p className="text-body" style={{ marginBottom: '12px' }}>
          Stores and drivers are responsible for the quality, preparation, and fulfillment of orders on the platform.
        </p>
        <p className="text-body">
          Platform policies may be updated over time. Continued use means you accept the latest published terms.
        </p>
      </Card>
    </div>
  );
}
