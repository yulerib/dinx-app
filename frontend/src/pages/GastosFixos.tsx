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
  const { currentMonth } = useMonth();
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

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [gastoToPay, setGastoToPay] = useState<GastoFixoMensal | null>(null);
  const [payValor, setPayValor] = useState<number>(0);
  const [payData, setPayData] = useState<string>('');

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

  const handleOpenPay = (gasto: GastoFixoMensal) => {
    setGastoToPay(gasto);
    const previsto = gasto.registro_atual?.valor_previsto_ajustado || gasto.valor_previsto_base;
    const real = gasto.registro_atual?.valor_real || 0;
    setPayValor(real > 0 ? real : previsto);

    if (gasto.registro_atual?.data_pagamento_real) {
      setPayData(gasto.registro_atual.data_pagamento_real);
    } else {
      const pDay = gasto.dia_pagamento_previsto || 10;
      setPayData(`${mesAno}-${String(pDay).padStart(2, '0')}`);
    }
    setIsPayModalOpen(true);
  };

  const handleSavePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoToPay || payValor < 0 || !payData) return;

    try {
      setIsSubmitting(true);
      const selectedMonthIso = payData.substring(0, 7);
      if (selectedMonthIso !== mesAno) {
        const mesesAbrev = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const mIdxAberto = Number(mesAno.split('-')[1]) - 1;
        const mIdxSel = Number(selectedMonthIso.split('-')[1]) - 1;
        const nomeMesAberto = mesesAbrev[mIdxAberto];
        const nomeMesSel = mesesAbrev[mIdxSel];

        const confirmacao = window.confirm(
          `Atenção: Você está realizando o pagamento em um dia de outro mês (${nomeMesSel}).\nA contabilidade deste gasto será mantida no mês aberto (${nomeMesAberto}).\n\nDeseja prosseguir?`
        );
        if (!confirmacao) return;
      }

      const diaReal = Number(payData.split('-')[2]);
      await gastosFixosService.upsertRegistro(
        gastoToPay.id,
        mesAno,
        payValor,
        gastoToPay.registro_atual?.valor_previsto_ajustado || null,
        diaReal,
        payData
      );

      await fetchGastos();
      setIsPayModalOpen(false);
      setGastoToPay(null);
    } catch (error: any) {
      alert('Falha ao registrar pagamento: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearPay = async () => {
    if (!gastoToPay) return;
    try {
      setIsSubmitting(true);
      await gastosFixosService.upsertRegistro(
        gastoToPay.id,
        mesAno,
        0,
        gastoToPay.registro_atual?.valor_previsto_ajustado || null,
        null,
        null
      );
      await fetchGastos();
      setIsPayModalOpen(false);
      setGastoToPay(null);
    } catch (error: any) {
      alert('Falha ao remover pagamento: ' + (error.message || JSON.stringify(error)));
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
                onPay={() => handleOpenPay(gasto)}
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

      {/* Modal Registrar Pagamento */}
      <Modal isOpen={isPayModalOpen} onClose={() => setIsPayModalOpen(false)} title="Registrar Pagamento">
        {gastoToPay && (
          <form onSubmit={handleSavePay}>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Despesa:</span>
              <strong style={{ marginLeft: '0.5rem', color: 'var(--text-main)' }}>{gastoToPay.nome}</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Valor Projetado: <strong>{formatBRL(gastoToPay.registro_atual?.valor_previsto_ajustado || gastoToPay.valor_previsto_base)}</strong>
              </div>
            </div>

            <CurrencyInput 
              label="Valor Efetivamente Pago"
              value={payValor}
              onChange={setPayValor}
              required
            />

            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Data Real do Pagamento</label>
              <input 
                type="date" 
                className="input" 
                value={payData}
                onChange={e => setPayData(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', gap: '1rem' }}>
              {gastoToPay.registro_atual?.valor_real && gastoToPay.registro_atual.valor_real > 0 ? (
                <Button type="button" variant="outline" onClick={handleClearPay} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} disabled={isSubmitting}>
                  Limpar Pagamento
                </Button>
              ) : (
                <div />
              )}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Button type="button" variant="outline" onClick={() => setIsPayModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  Salvar
                </Button>
              </div>
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
// -------------------------------------------------------------
// Componente de Linha (Simplificado para apenas disparar o modal)
// -------------------------------------------------------------
function GastoRow({ 
  gasto, 
  onPay, 
  onEdit, 
  onDelete 
}: { 
  gasto: GastoFixoMensal, 
  onPay: () => void, 
  onEdit: () => void, 
  onDelete: () => void,
}) {
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

  const isPaid = realPago > 0;
  const stateClass = isPaid ? 'gasto-row-ja-paga' : 'gasto-row-aberta';

  return (
    <TransactionListItem 
      type="fixed"
      className={stateClass}
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600 }}>{gasto.nome}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Dia previsto: {gasto.dia_pagamento_previsto || '-'}
            {gasto.registro_atual?.data_pagamento_real ? (
              ` • Pago em: ${gasto.registro_atual.data_pagamento_real.split('-').reverse().join('/')}`
            ) : gasto.registro_atual?.dia_pagamento_real ? (
              ` • Pago no dia: ${gasto.registro_atual.dia_pagamento_real}`
            ) : null}
          </span>
        </div>
      }
      value1={formatBRL(previstoEfetivo)}
      value2={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {isPaid ? (
            <div 
              onClick={onPay}
              style={{ 
                cursor: 'pointer', 
                padding: '0.4rem 0.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-color)',
                color: getStatusColor(),
                fontWeight: 600
              }}
              title="Clique para alterar o pagamento"
            >
              {formatBRL(realPago)}
            </div>
          ) : (
            <button
              onClick={onPay}
              style={{
                padding: '0.35rem 0.65rem',
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
              title="Registrar pagamento"
            >
              <Check size={12} /> Pagar
            </button>
          )}
        </div>
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
