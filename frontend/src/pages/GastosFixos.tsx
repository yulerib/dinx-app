import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { ProgressBar } from '../components/ui/ProgressBar';
import { TransactionListItem } from '../components/ui/TransactionListItem';
import { Plus, Check, Loader2, Edit2, Trash2 } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { gastosFixosService } from '../services/gastosFixos';
import type { GastoFixoMensal } from '../types/database.types';

export function GastosFixos() {
  const { currentMonth, selectedDay } = useMonth();
  const year = currentMonth.getFullYear();
  const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${month}`;
  
  const [gastos, setGastos] = useState<GastoFixoMensal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Create State
  const [newNome, setNewNome] = useState('');
  const [newValor, setNewValor] = useState(0);
  const [newDiaPagamentoPrevisto, setNewDiaPagamentoPrevisto] = useState<number>(10);

  // Edit State
  const [gastoToEdit, setGastoToEdit] = useState<GastoFixoMensal | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editValor, setEditValor] = useState(0);
  const [editDiaPagamentoPrevisto, setEditDiaPagamentoPrevisto] = useState<number>(10);
  const [editMode, setEditMode] = useState<'thisMonth' | 'allMonths'>('thisMonth');

  const fetchGastos = async () => {
    try {
      setIsLoading(true);
      const data = await gastosFixosService.fetchGastosMensais(mesAno);
      setGastos(data);
    } catch (error) {
      console.error('Erro ao buscar gastos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGastos();
  }, [mesAno]);

  // Cálculos do Resumo Mensal
  const totalPrevisto = gastos.reduce((acc, g) => acc + (g.registro_atual?.valor_previsto_ajustado || g.valor_previsto_base), 0);
  const totalRealizado = gastos.reduce((acc, g) => acc + (g.registro_atual?.valor_real || 0), 0);
  const naoInformadas = gastos.filter(g => !g.registro_atual?.valor_real || g.registro_atual.valor_real === 0).length;

  const getStatusColorGlobally = () => {
    if (totalRealizado === 0) return 'var(--text-muted)';
    if (totalPrevisto === 0) return totalRealizado > 0 ? 'var(--danger)' : 'var(--text-muted)';
    const pct = totalRealizado / totalPrevisto;
    if (pct <= 1.0) return 'var(--success)';
    return 'var(--danger)';
  };

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleAddGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome || newValor <= 0) return;
    
    try {
      setIsSubmitting(true);
      const selectedMonthIso = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01T12:00:00Z`;
      await gastosFixosService.addGastoFixo(newNome, newValor, newDiaPagamentoPrevisto, selectedMonthIso);
      await fetchGastos();
      setIsModalOpen(false);
      setNewNome('');
      setNewValor(0);
      setNewDiaPagamentoPrevisto(10);
    } catch (error: any) {
      alert('Falha ao salvar: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (gasto: GastoFixoMensal) => {
    setGastoToEdit(gasto);
    setEditNome(gasto.nome);
    setEditValor(gasto.registro_atual?.valor_previsto_ajustado || gasto.valor_previsto_base);
    setEditDiaPagamentoPrevisto(gasto.dia_pagamento_previsto || 10);
    setEditMode('thisMonth');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoToEdit || !editNome || editValor <= 0) return;

    try {
      setIsSubmitting(true);
      
      if (editMode === 'allMonths') {
        await gastosFixosService.updateGastoFixo(gastoToEdit.id, editNome, editValor, editDiaPagamentoPrevisto);
        const vr = gastoToEdit.registro_atual?.valor_real || 0;
        const dr = gastoToEdit.registro_atual?.dia_pagamento_real || null;
        await gastosFixosService.upsertRegistro(gastoToEdit.id, mesAno, vr, null, dr);
      } else {
        await gastosFixosService.updateGastoFixo(gastoToEdit.id, editNome, gastoToEdit.valor_previsto_base, editDiaPagamentoPrevisto);
        const vr = gastoToEdit.registro_atual?.valor_real || 0;
        const dr = gastoToEdit.registro_atual?.dia_pagamento_real || null;
        await gastosFixosService.upsertRegistro(gastoToEdit.id, mesAno, vr, editValor, dr);
      }

      await fetchGastos();
      setGastoToEdit(null);
    } catch (error: any) {
      alert('Falha ao editar: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa fixa? Todos os registros dela nos meses também serão apagados.')) return;
    try {
      await gastosFixosService.deleteGastoFixo(id);
      await fetchGastos();
    } catch (error: any) {
      alert('Falha ao excluir: ' + (error.message || JSON.stringify(error)));
    }
  };

  return (
    <div className="theme-fixos">
      <style>{`
        .gasto-row-aberta {
          /* Estilo padrão de linha aberta */
        }
        .gasto-row-paga-hoje {
          border: 1.5px solid var(--success) !important;
          background-color: rgba(16, 185, 129, 0.08) !important;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.15) !important;
        }
        [data-theme='light'] .gasto-row-paga-hoje {
          background-color: rgba(16, 185, 129, 0.05) !important;
          border: 2px solid var(--success) !important;
        }
        .gasto-row-ja-paga {
          opacity: 0.45 !important;
          filter: grayscale(15%) !important;
          transition: opacity 0.2s;
        }
        .gasto-row-ja-paga:hover {
          opacity: 0.8 !important;
        }
        .quick-pay-label-actions {
          display: inline;
        }
        @media (max-width: 768px) {
          .quick-pay-label-actions {
            display: none;
          }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="text-h1" style={{ marginBottom: 0 }}>Gastos Fixos</h1>
        <Button onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />}>Adicionar Despesa</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Resumo do Mês */}
        <Card className={`summary-card-fixos ${totalRealizado > totalPrevisto ? 'is-overbudget' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h3 className="text-h3" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Resumo do Mês</h3>
                {naoInformadas > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    ⚠️ {naoInformadas} conta(s) não informada(s)
                  </span>
                )}
              </div>
              
              <div className="fixed-summary-container">
                <style>{`
                  .fixed-summary-container {
                    display: flex;
                    align-items: baseline;
                    gap: 0.5rem;
                    margin-top: 0.25rem;
                  }
                  .fixed-summary-row1 {
                    display: flex;
                    align-items: baseline;
                  }
                  .fixed-summary-exec-label {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                    font-weight: 500;
                  }
                  .fixed-summary-separator {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                  }
                  .fixed-summary-proj {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                  }
                  @media (max-width: 768px) {
                    .fixed-summary-container {
                      flex-direction: column;
                      align-items: flex-start;
                      gap: 0.15rem;
                    }
                    .fixed-summary-separator {
                      display: none;
                    }
                  }
                `}</style>
                
                <div className="fixed-summary-row1">
                  <span className="text-h2" style={{ margin: 0, color: getStatusColorGlobally() }}>
                    {formatBRL(totalRealizado)}
                  </span>
                  <span className="fixed-summary-exec-label" style={{ marginLeft: '0.5rem' }}>Executado</span>
                </div>
                <span className="fixed-summary-separator">/</span>
                <span className="fixed-summary-proj">Projetado: {formatBRL(totalPrevisto)}</span>
              </div>
            </div>
          </div>
          <ProgressBar previsto={totalPrevisto} realizado={totalRealizado} />
        </Card>
      </div>



      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" />
            <span style={{ marginLeft: '0.5rem' }}>Carregando...</span>
          </div>
        ) : gastos.length === 0 ? (
          <p className="text-muted">Nenhum gasto fixo cadastrado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
              <div>Descrição</div>
              <div style={{ textAlign: 'right' }}>Projetado</div>
              <div style={{ textAlign: 'right' }}>Executado</div>
              <div style={{ textAlign: 'center' }}></div>
            </div>
            
            <style>{`
              @media (max-width: 768px) {
                .table-header { display: none !important; }
              }
            `}</style>
            
            {gastos.map(gasto => (
              <GastoRow 
                key={gasto.id} 
                gasto={gasto} 
                mesAno={mesAno} 
                currentMonth={currentMonth}
                selectedDay={selectedDay}
                onUpdate={fetchGastos} 
                onEdit={() => handleOpenEdit(gasto)}
                onDelete={() => handleDelete(gasto.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Modal Adicionar */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Gasto Fixo">
        <form onSubmit={handleAddGasto}>
          <div className="input-group">
            <label>Nome da Despesa</label>
            <input 
              type="text" 
              className="input" 
              placeholder="Ex: Aluguel" 
              value={newNome}
              onChange={e => setNewNome(e.target.value)}
              required
            />
          </div>
          <CurrencyInput 
            label="Valor Projetado Mensal"
            value={newValor}
            onChange={setNewValor}
            required
          />
          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Dia Previsto de Pagamento</label>
            <select 
              className="input" 
              value={newDiaPagamentoPrevisto} 
              onChange={e => setNewDiaPagamentoPrevisto(Number(e.target.value))}
              style={{ appearance: 'auto', cursor: 'pointer' }}
              required
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar */}
      <Modal isOpen={!!gastoToEdit} onClose={() => setGastoToEdit(null)} title="Editar Gasto Fixo">
        {gastoToEdit && (
          <form onSubmit={handleSaveEdit}>
            <div className="input-group">
              <label>Nome da Despesa</label>
              <input 
                type="text" 
                className="input" 
                value={editNome}
                onChange={e => setEditNome(e.target.value)}
                required
              />
            </div>
            <CurrencyInput 
              label="Valor Projetado"
              value={editValor}
              onChange={setEditValor}
              required
            />
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Dia Previsto de Pagamento</label>
              <select 
                className="input" 
                value={editDiaPagamentoPrevisto} 
                onChange={e => setEditDiaPagamentoPrevisto(Number(e.target.value))}
                style={{ appearance: 'auto', cursor: 'pointer' }}
                required
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Aplicar novo valor para:</label>
              <select 
                className="input" 
                value={editMode} 
                onChange={(e) => setEditMode(e.target.value as any)}
                style={{ appearance: 'auto', cursor: 'pointer' }}
              >
                <option value="thisMonth">Apenas este mês ({mesAno})</option>
                <option value="allMonths">Todos os meses (Alterar Padrão)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
              <Button type="button" variant="outline" onClick={() => setGastoToEdit(null)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                Atualizar
              </Button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}

// -------------------------------------------------------------
// Componente de Linha (Lógica de Edição de Valor Real e Cores)
// -------------------------------------------------------------
function GastoRow({ 
  gasto, 
  mesAno, 
  currentMonth,
  selectedDay,
  onUpdate, 
  onEdit, 
  onDelete 
}: { 
  gasto: GastoFixoMensal, 
  mesAno: string, 
  currentMonth: Date,
  selectedDay: number,
  onUpdate: () => void,
  onEdit: () => void,
  onDelete: () => void,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [valorReal, setValorReal] = useState(gasto.registro_atual?.valor_real || 0);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = React.useRef(false);

  useEffect(() => {
    setValorReal(gasto.registro_atual?.valor_real || 0);
  }, [gasto]);

  const previstoEfetivo = gasto.registro_atual?.valor_previsto_ajustado || gasto.valor_previsto_base;
  const realPago = gasto.registro_atual?.valor_real || 0;

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getStatusColor = () => {
    if (realPago === 0) return 'var(--text-muted)';
    if (previstoEfetivo === 0) return realPago > 0 ? 'var(--danger)' : 'var(--text-muted)';
    const pct = realPago / previstoEfetivo;
    if (pct <= 1.0) return 'var(--success)';
    return 'var(--danger)';
  };

  const handleSave = async (valToSave: number) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const realDayToSave = valToSave > 0 ? selectedDay : null;
      await gastosFixosService.upsertRegistro(
        gasto.id, 
        mesAno, 
        valToSave, 
        gasto.registro_atual?.valor_previsto_ajustado || undefined,
        realDayToSave
      );
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleQuickPay = async () => {
    try {
      setIsSaving(true);
      await gastosFixosService.upsertRegistro(
        gasto.id, 
        mesAno, 
        previstoEfetivo, 
        gasto.registro_atual?.valor_previsto_ajustado || null, 
        selectedDay
      );
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Erro ao pagar rápido:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputBlur = () => {
    handleSave(valorReal);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave(valorReal);
    }
  };

  const systemDate = new Date();
  const isCurrentMonth = currentMonth.getFullYear() === systemDate.getFullYear() && currentMonth.getMonth() === systemDate.getMonth();
  const isPaidToday = isCurrentMonth && (gasto.registro_atual?.dia_pagamento_real === systemDate.getDate());
  const isPaid = realPago > 0;

  let stateClass = 'gasto-row-aberta';
  if (isPaid) {
    stateClass = isPaidToday ? 'gasto-row-paga-hoje' : 'gasto-row-ja-paga';
  }

  return (
    <TransactionListItem 
      type="fixed"
      className={stateClass}
      isEditing={isEditing}
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600 }}>{gasto.nome}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Dia previsto: {gasto.dia_pagamento_previsto || '-'}
            {gasto.registro_atual?.dia_pagamento_real && ` • Pago no dia: ${gasto.registro_atual.dia_pagamento_real}`}
          </span>
        </div>
      }
      value1={formatBRL(previstoEfetivo)}
      value2={
        isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
            <CurrencyInput 
              value={valorReal} 
              onChange={setValorReal} 
              autoFocus
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              disabled={isSaving}
              style={{ width: '85px', padding: '0.4rem 0.25rem', fontSize: '0.875rem', marginBottom: 0, height: '36px' }}
            />
            <button
              onMouseDown={(e) => {
                e.preventDefault(); // Evita blur do input antes do click!
              }}
              onClick={handleQuickPay}
              disabled={isSaving}
              style={{
                padding: '0.4rem 0.6rem',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1.5px solid var(--success)',
                color: 'var(--success)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                height: '36px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--success)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                e.currentTarget.style.color = 'var(--success)';
              }}
              title="Pagar com o valor projetado"
            >
              <Check size={12} /> Pagar Cheio
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <div 
              onClick={() => setIsEditing(true)}
              style={{ 
                cursor: 'pointer', 
                padding: '0.4rem 0.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed transparent',
                color: getStatusColor(),
                fontWeight: realPago > 0 ? 600 : 400
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
              title="Clique para informar o valor pago manualmente"
            >
              {realPago > 0 ? formatBRL(realPago) : 'Informar Pago'}
            </div>
            
            {realPago === 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickPay();
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1.5px solid var(--success)',
                  color: 'var(--success)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--success)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                  e.currentTarget.style.color = 'var(--success)';
                }}
                title="Pagar com o valor projetado"
              >
                <Check size={12} /> Pagar
              </button>
            )}
          </div>
        )
      }
      actions={
        <>
          <button 
            onClick={onEdit} 
            style={{ padding: '0.25rem', color: 'var(--text-muted)', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            title="Editar Despesa"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={onDelete} 
            style={{ padding: '0.25rem', color: 'var(--text-muted)', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            title="Excluir Despesa"
          >
            <Trash2 size={16} />
          </button>
        </>
      }
    />
  );
}
