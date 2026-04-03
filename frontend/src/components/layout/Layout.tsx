import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { CartModal } from '../ui/CartModal';
import { AiAssistant } from '../ui/AiAssistant';
import { LocationSelector } from '../ui/LocationSelector';
import { Link } from 'react-router-dom';
import { MobileNav } from './MobileNav';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="layout-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <MobileNav />
      <CartModal />
      <LocationSelector />
      <AiAssistant />
      <main style={{ flex: 1, paddingTop: '96px', paddingBottom: '32px' }} className="layout-main animate-fade-in">
        {children}
      </main>

      <footer style={{ background: 'var(--surface-container-low)', padding: '48px 0', marginTop: 'auto', borderTop: '1px solid var(--outline-variant)' }} className="layout-footer">
        <div className="container flex-between">
          <div>
            <h3 className="text-h3" style={{ color: '#a63400', marginBottom: '16px' }}>Mtaaexpress</h3>
            <p className="text-muted">Hyperlocal delivery at your fingertips.</p>
          </div>
          <div className="flex-center" style={{ gap: '24px' }}>
            <Link to="/customer/about"   className="text-sm customer-link" style={{ transition: 'color 0.2s' }}>About</Link>
            <Link to="/customer/terms"   className="text-sm customer-link" style={{ transition: 'color 0.2s' }}>Terms</Link>
            <Link to="/customer/privacy" className="text-sm customer-link" style={{ transition: 'color 0.2s' }}>Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
