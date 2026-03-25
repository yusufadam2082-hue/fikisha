import type { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className = '', style, onClick, hoverable = true }: CardProps) {
  return (
    <div 
      className={`card ${className}`} 
      onClick={onClick}
      style={{
        ...style,
        cursor: onClick ? 'pointer' : 'default',
        transition: hoverable ? 'transform var(--transition-smooth), box-shadow var(--transition-smooth)' : 'none',
      }}
    >
      {children}
    </div>
  );
}
