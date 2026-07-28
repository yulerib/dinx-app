import React from 'react';

interface M3IconProps {
  name: string; // Mantido por compatibilidade de assinatura
  lucideIcon: React.ReactElement; // Elemento Lucide (ex: <LayoutDashboard size={20} />)
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function M3Icon({ lucideIcon, size = 20, className = '', style }: M3IconProps) {
  // Sempre renderiza o ícone Lucide conforme padrão estabelecido para o projeto
  const lucideProps = (lucideIcon as any).props || {};
  return React.cloneElement(lucideIcon, {
    size: size,
    className: `${lucideProps.className || ''} ${className}`,
    style: { ...lucideProps.style, ...style }
  } as any);
}
