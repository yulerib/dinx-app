

interface ProgressBarProps {
  previsto: number;
  realizado: number;
}

export function ProgressBar({ previsto, realizado }: ProgressBarProps) {
  const getStatusColor = () => {
    if (realizado === 0) return 'var(--text-muted)'; // Pendente
    if (previsto === 0) return realizado > 0 ? 'var(--danger)' : 'var(--text-muted)';
    
    const pct = realizado / previsto;
    if (pct <= 0.8) return 'var(--success)';
    if (pct <= 1.0) return 'var(--warning)';
    return 'var(--danger)';
  };

  const color = getStatusColor();
  
  // Calcula a porcentagem para preencher a barra (limita a 100% para não vazar do container)
  const percentage = previsto > 0 ? Math.min((realizado / previsto) * 100, 100) : (realizado > 0 ? 100 : 0);

  return (
    <div style={{ 
      width: '100%', 
      height: '6px', 
      backgroundColor: 'var(--bg-main)', 
      borderRadius: 'var(--radius-xl)', 
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
      marginTop: '0.5rem'
    }}>
      <div 
        style={{ 
          height: '100%', 
          width: `${percentage}%`, 
          backgroundColor: color,
          transition: 'width 0.5s ease-out, background-color 0.3s ease'
        }} 
      />
    </div>
  );
}
