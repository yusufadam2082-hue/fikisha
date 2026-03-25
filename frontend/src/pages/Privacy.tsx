import { Card } from '../components/ui/Card';

export function Privacy() {
  return (
    <div className="container animate-fade-in" style={{ maxWidth: '900px' }}>
      <h1 className="text-h1" style={{ marginBottom: '16px' }}>Privacy Policy</h1>
      <Card style={{ padding: '24px' }}>
        <p className="text-body" style={{ marginBottom: '12px' }}>
          Fikisha collects account, order, and delivery information needed to process and deliver your requests.
        </p>
        <p className="text-body" style={{ marginBottom: '12px' }}>
          We use this information to operate the service, improve reliability, and support customer care.
        </p>
        <p className="text-body">
          We do not sell personal data. For data access or removal requests, contact help@fikisha.com.
        </p>
      </Card>
    </div>
  );
}
