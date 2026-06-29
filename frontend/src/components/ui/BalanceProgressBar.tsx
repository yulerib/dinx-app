

interface BalanceProgressBarProps {
  previsto: number;
  projetado: number;
}

export function BalanceProgressBar({ previsto, projetado }: BalanceProgressBarProps) {
  // Saldo Positivo (Verde) = economizou (projetado < previsto)
  // Saldo Negativo (Vermelho) = estourou (projetado > previsto)
  
  const saldo = previsto - projetado;
  
  // Vamos definir que o máximo de desvio exibido é o próprio valor previsto.
  // Ou seja, se o limite é 1000, o gráfico vai de 0 (0%) a 2000 (100%). O meio é 1000 (50%).
  // Se gastar 0, a barra enche 50% pra esquerda (verde).
  // Se gastar 2000, a barra enche 50% pra direita (vermelho).
  
  const halfMax = previsto; // Distância do meio até a borda
  const devio = projetado - previsto; // Se negativo, foi economia. Se positivo, estourou.
  
  // Percentual do desvio (0 a 50%)
  const rawDevioPct = halfMax > 0 ? (Math.abs(devio) / halfMax) * 50 : 0;
  const devioPct = Math.min(rawDevioPct, 50); // Trava em 50% da largura máxima
  
  const isPositive = saldo >= 0; // Economia
  
  const color = isPositive ? 'var(--success)' : 'var(--danger)';

  return (
    <div style={{ width: '100%', marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
        <span>Economia</span>
        <span>Estouro</span>
      </div>
      
      <div style={{ 
        width: '100%', 
        height: '8px', 
        backgroundColor: 'var(--bg-main)', 
        borderRadius: 'var(--radius-xl)', 
        position: 'relative',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        {/* Marca central */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: '2px',
          backgroundColor: 'var(--text-muted)',
          zIndex: 2
        }} />
        
        {/* Barra preenchida */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          backgroundColor: color,
          width: `${devioPct}%`,
          left: isPositive ? `${50 - devioPct}%` : '50%',
          transition: 'all 0.5s ease-out'
        }} />
      </div>
    </div>
  );
}
