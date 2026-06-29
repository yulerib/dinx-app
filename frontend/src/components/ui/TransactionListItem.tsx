import React from 'react';
import './TransactionListItem.css';

interface Props {
  title: React.ReactNode;
  value1?: React.ReactNode;
  value2?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isEditing?: boolean;
  type?: 'fixed' | 'daily' | 'installment';
  totalValue?: React.ReactNode;
  installmentLabel?: string;
  editCategoryActions?: React.ReactNode;
}

export function TransactionListItem({ 
  title, 
  value1, 
  value2, 
  actions, 
  onClick, 
  className = '', 
  isEditing = false,
  type,
  totalValue,
  installmentLabel,
  editCategoryActions
}: Props) {
  const combinedClass = `transaction-list-item tli-${type || 'default'} ${isEditing ? 'is-editing' : ''} ${className}`;

  return (
    <div className={combinedClass} onClick={onClick}>
      {/* Top Header Row (Title and actions next to each other on mobile) */}
      <div className="tli-header-row">
        <div className="tli-title">
          {title}
          {type === 'daily' && editCategoryActions && (
            <div className="tli-category-actions-desktop">
              {editCategoryActions}
            </div>
          )}
        </div>
        
        {/* Actions at top-right for fixed and installment cards on mobile */}
        {(type === 'fixed' || type === 'installment') && actions && (
          <div className="tli-actions-top">
            {actions}
          </div>
        )}

        {type === 'daily' && editCategoryActions && (
          <div className="tli-category-actions-mobile">
            {editCategoryActions}
          </div>
        )}
      </div>

      {/* Installment Total Purchase Box (Mobile only) */}
      {type === 'installment' && totalValue && (
        <div className="tli-installment-total-box">
          <span className="tli-itb-label">Valor total da compra</span>
          <span className="tli-itb-value">{totalValue}</span>
        </div>
      )}

      {/* Values Box (Desktop, and Mobile default/fixed/daily - now containing ONLY value1 on mobile!) */}
      <div className="tli-values">
        {value1 && <div className="tli-value1">{value1}</div>}
      </div>

      {/* Value 2 (Rendered outside the box for fixed on mobile, and in grid on desktop) */}
      {value2 && type !== 'installment' && type !== 'daily' && (
        <div className="tli-value2">
          {value2}
        </div>
      )}

      {/* Desktop-only value2 for daily layout (so it participates in the grid on desktop but is hidden on mobile) */}
      {value2 && type === 'daily' && (
        <div className="tli-value2-desktop-only">
          {value2}
        </div>
      )}

      {/* Daily Bottom Row (Mobile only - real value/status on left, action icons on right) */}
      {type === 'daily' && (
        <div className="tli-daily-bottom-row">
          {value2 && <div className="tli-daily-value">{value2}</div>}
          {actions && <div className="tli-actions-bottom">{actions}</div>}
        </div>
      )}

      {/* Installment Bottom Row (Mobile only - installment value on left, installment number on right) */}
      {type === 'installment' && (
        <div className="tli-installment-bottom-row">
          {value2 && <div className="tli-installment-value">{value2}</div>}
          {installmentLabel && <div className="tli-installment-number">{installmentLabel}</div>}
        </div>
      )}

      {/* Standard Actions (Desktop, and Mobile default) */}
      {type !== 'installment' && type !== 'fixed' && type !== 'daily' && actions && (
        <div className="tli-actions">
          {actions}
        </div>
      )}
      
      {/* Desktop-only actions for daily, fixed and installment layouts */}
      {(type === 'fixed' || type === 'installment' || type === 'daily') && actions && (
        <div className="tli-actions-desktop-only">
          {actions}
        </div>
      )}
    </div>
  );
}
