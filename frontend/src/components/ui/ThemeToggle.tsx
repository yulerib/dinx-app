import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        borderRadius: '50px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-main)',
        fontSize: '0.8rem',
        fontFamily: "'Space Mono', monospace",
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all var(--transition-normal)',
        willChange: 'transform'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.transform = 'none';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.96)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'none';
      }}
      title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={14} color="var(--primary)" />
          <span>LIGHT</span>
        </>
      ) : (
        <>
          <Moon size={14} color="var(--primary)" />
          <span>DARK</span>
        </>
      )}
    </button>
  );
}
