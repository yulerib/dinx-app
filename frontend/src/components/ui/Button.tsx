

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  icon?: React.ReactNode;
}

export function Button({ variant = 'primary', icon, children, className = '', ...props }: ButtonProps) {
  const baseClass = 'btn';
  const variantClass = `btn-${variant}`;
  
  return (
    <button className={`${baseClass} ${variantClass} ${className}`} {...props}>
      {icon && <span className="btn-icon">{icon}</span>}
      {children && <span className="btn-text">{children}</span>}
    </button>
  );
}
