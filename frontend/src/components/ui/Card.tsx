

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Card({ children, className = '', style, title, subtitle, action }: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            {title && <h3 className="text-h3" style={{ margin: 0 }}>{title}</h3>}
            {subtitle && <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
