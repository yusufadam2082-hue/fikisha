import { type ReactNode, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  className = '',
  ...props 
}: ButtonProps) {
  
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: 'var(--radius-pill)',
    fontWeight: 600,
    transition: 'all var(--transition-smooth)',
    cursor: 'pointer',
    width: fullWidth ? '100%' : 'auto',
  };

  const variants = {
    primary: {
      background: 'var(--primary)',
      color: 'white',
      border: 'none',
      boxShadow: 'var(--shadow-primary)',
    },
    secondary: {
      background: 'var(--surface-hover)',
      color: 'var(--text-main)',
      border: 'none',
    },
    outline: {
      background: 'transparent',
      color: 'var(--text-main)',
      border: '2px solid var(--border)',
    },
    icon: {
      background: 'var(--surface)',
      color: 'var(--text-main)',
      border: 'none',
      boxShadow: 'var(--shadow-sm)',
      padding: '10px',
      borderRadius: '50%',
    }
  };

  const sizes = {
    sm: { padding: '8px 16px', fontSize: '0.875rem' },
    md: { padding: '12px 24px', fontSize: '1rem' },
    lg: { padding: '16px 32px', fontSize: '1.125rem' }
  };

  const variantStyle = variants[variant];
  const sizeStyle = variant === 'icon' ? {} : sizes[size];

  // Hover states handled in pure CSS classes typically, 
  // but for raw inline simplicity without massive CSS we mix classes and inline
  const btnClass = variant === 'primary' ? 'btn-primary' : variant === 'icon' ? 'btn-icon' : '';

  return (
    <button 
      className={`${btnClass} ${className}`}
      style={{
        ...baseStyles,
        ...variantStyle,
        ...sizeStyle,
        ...(props.style || {})
      }}
      {...props}
    >
      {children}
    </button>
  );
}
