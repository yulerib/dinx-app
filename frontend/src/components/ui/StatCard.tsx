import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from './Card';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  valueDisplay: React.ReactNode;
  linkTo: string;
  linkText: string;
  className?: string;
}

export function StatCard({ icon, title, description, valueDisplay, linkTo, linkText, className = '' }: StatCardProps) {
  return (
    <Card className={className} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {icon}
          <h3 className="text-h3" style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
        </div>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>{description}</p>
        
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
          {valueDisplay}
        </div>
      </div>
      <Link 
        to={linkTo} 
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.875rem', transition: 'color 0.2s', marginTop: 'auto' }} 
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'} 
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        {linkText} <ArrowRight size={14} />
      </Link>
    </Card>
  );
}
