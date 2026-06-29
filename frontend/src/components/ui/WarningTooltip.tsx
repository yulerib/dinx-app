import { useState, useEffect, useRef } from 'react';

interface WarningTooltipProps {
  text: string;
}

export function WarningTooltip({ text }: WarningTooltipProps) {
  const [show, setShow] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Fecha o tooltip se clicar fora (útil para o mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      ref={tooltipRef}
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        alignItems: 'center', 
        cursor: 'pointer',
        zIndex: 10
      }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShow(!show);
      }}
    >
      <span style={{ 
        fontSize: '0.875rem',
        verticalAlign: 'middle',
        display: 'inline-flex',
        alignItems: 'center',
        filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.2))'
      }}>
        ⚠️
      </span>

      {show && (
        <div 
          className="warning-tooltip-popup"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '6px',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 500,
            whiteSpace: 'normal',
            width: 'max-content',
            maxWidth: '200px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            lineHeight: '1.25'
          }}
        >
          {text}
          {/* Seta do Balão */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '5px',
            borderStyle: 'solid',
            borderColor: 'var(--border-color) transparent transparent transparent'
          }} />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '4px',
            borderStyle: 'solid',
            borderColor: 'var(--bg-card) transparent transparent transparent',
            marginTop: '-1px'
          }} />
        </div>
      )}
    </div>
  );
}
