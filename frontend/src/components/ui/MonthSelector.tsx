import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMonth } from '../../contexts/MonthContext';

export function MonthSelector() {
  const { currentMonth, nextMonth, prevMonth } = useMonth();
  
  const monthName = currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const formatted = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <div 
      className="month-selector"
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem', 
        backgroundColor: 'var(--color-main)', 
        padding: '0.5rem 1rem', 
        borderRadius: '50px', 
        border: '2px solid #141816', 
        boxShadow: 'var(--shadow-sm)',
        color: '#141816'
      }}
    >
      <button onClick={prevMonth} style={{ padding: '0.25rem', color: '#141816', display: 'flex' }}><ChevronLeft size={20} /></button>
      <span style={{ fontWeight: 700, minWidth: '140px', textAlign: 'center', color: '#141816' }}>{formatted}</span>
      <button onClick={nextMonth} style={{ padding: '0.25rem', color: '#141816', display: 'flex' }}><ChevronRight size={20} /></button>
    </div>
  );
}
