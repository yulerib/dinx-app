import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface WarningTooltipProps {
  text: string;
}

export function WarningTooltip({ text }: WarningTooltipProps) {
  const [show, setShow] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const updateRect = useCallback(() => {
    if (tooltipRef.current) {
      setRect(tooltipRef.current.getBoundingClientRect());
    }
  }, []);

  const openTooltip = useCallback(() => {
    updateRect();
    setShow(true);
  }, [updateRect]);

  // Fecha o tooltip se clicar fora ou rolar a página (útil para o mobile)
  useEffect(() => {
    if (!show) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        tooltipRef.current && !tooltipRef.current.contains(target) &&
        (!popupRef.current || !popupRef.current.contains(target))
      ) {
        setShow(false);
      }
    };
    const handleScrollOrResize = () => {
      updateRect();
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [show, updateRect]);

  const flipBelow = rect ? rect.top < 160 : false;
  const clampedLeft = rect
    ? Math.min(Math.max(12, rect.left + rect.width / 2 - 100), Math.max(12, window.innerWidth - 212))
    : 12;
  const arrowLeft = rect
    ? Math.min(Math.max(14, rect.left + rect.width / 2 - clampedLeft), 186)
    : 100;

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
      onMouseEnter={openTooltip}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (show) {
          setShow(false);
        } else {
          openTooltip();
        }
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

      {show && rect && createPortal(
        <div 
          ref={popupRef}
          className="warning-tooltip-popup"
          style={{
            position: 'fixed',
            ...(flipBelow
              ? { top: `${rect.bottom + 8}px` }
              : { bottom: `${window.innerHeight - rect.top + 8}px` }),
            left: `${clampedLeft}px`,
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 500,
            whiteSpace: 'normal',
            width: '200px',
            maxWidth: '200px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1200,
            lineHeight: '1.25',
            pointerEvents: 'none'
          }}
        >
          {text}
          {/* Seta do Balão */}
          <div style={{
            position: 'absolute',
            ...(flipBelow ? { bottom: '100%' } : { top: '100%' }),
            left: `${arrowLeft}px`,
            transform: 'translateX(-50%)',
            borderWidth: '5px',
            borderStyle: 'solid',
            borderColor: flipBelow
              ? 'transparent transparent var(--border-color) transparent'
              : 'var(--border-color) transparent transparent transparent'
          }} />
          <div style={{
            position: 'absolute',
            ...(flipBelow ? { bottom: '100%', marginBottom: '-1px' } : { top: '100%', marginTop: '-1px' }),
            left: `${arrowLeft}px`,
            transform: 'translateX(-50%)',
            borderWidth: '4px',
            borderStyle: 'solid',
            borderColor: flipBelow
              ? 'transparent transparent var(--bg-card) transparent'
              : 'var(--bg-card) transparent transparent transparent',
          }} />
        </div>,
        document.body
      )}
    </div>
  );
}
