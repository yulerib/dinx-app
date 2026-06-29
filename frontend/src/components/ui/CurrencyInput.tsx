import React, { useState, useEffect } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

export function CurrencyInput({ value, onChange, label, className = '', ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value === 0 && displayValue === '') return;
    // Format numeric value to BRL string
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    setDisplayValue(formatter.format(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/\D/g, ''); // Remove non-digits
    
    if (rawValue === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    const numericValue = parseInt(rawValue, 10) / 100;
    
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    
    setDisplayValue(formatter.format(numericValue));
    onChange(numericValue);
  };

  return (
    <div className={`input-group ${className}`}>
      {label && <label>{label}</label>}
      <input
        type="text"
        className="input"
        value={displayValue}
        onChange={handleChange}
        placeholder="R$ 0,00"
        {...props}
      />
    </div>
  );
}
