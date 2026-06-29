import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Plus, Check, Loader2, Edit2, Trash2 } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { entradasService } from '../services/entradas';
import type { EntradaMensal } from '../types/database.types';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export function Entradas() {
  const { currentMonth } = useMonth();
  const year = currentMonth.getFullYear();
  const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${month}`;

  const [entradas, setEntradas] = useState<EntradaMensal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<{ mesAno: string; mesAnoFormatado: string; total: number }[]>([]);

  // Modals States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Form State
  const [newDescricao, setNewDescricao] = useState('');
  const [newValor, setNewValor] = useState(0);
  const [newDataEntrada, setNewDataEntrada] = useState(`${mesAno}-01`);
  const [newProjetar, setNewProjetar] = useState(true);
  const [newMesAnoFim, setNewMesAnoFim] = useState('');
  const [newDesvioCompetencia, setNewDesvioCompetencia] = useState(0);

  // Edit Modal State
  const [entradaToEdit, setEntradaToEdit] = useState<EntradaMensal | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState(0);
  const [editDataEntrada, setEditDataEntrada] = useState('');
  const [editProjetar, setEditProjetar] = useState(true);
  const [editMesAnoFim, setEditMesAnoFim] = useState('');
  const [editAtivo, setEditAtivo] = useState(true);
  const [editDesvioCompetencia, setEditDesvioCompetencia] = useState(0);

  // Fetch all monthly inflows
  const fetchEntradas = async () => {
    try {
      setIsLoading(true);
      const data = await entradasService.fetchEntradasMensais(mesAno);
      setEntradas(data);
    } catch (error) {
      console.error('Erro ao buscar entradas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch 6-month historical totals for Recharts
  const fetchChartData = async () => {
    try {
      const data = await entradasService.fetchEvolucaoEntradas(currentMonth);
      setChartData(data);
    } catch (error) {
      console.error('Erro ao buscar evolução de entradas:', error);
    }
  };

  const handleRefreshAll = () => {
    fetchEntradas();
    fetchChartData();
  };

  useEffect(() => {
    handleRefreshAll();
  }, [mesAno]);

  // Calculations for Inflows Summary
  const totalRealizado = entradas.reduce((acc, e) => acc + (e.projetar ? (e.registro_atual?.valor_real || 0) : e.valor_previsto_base), 0);

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleAddEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescricao || newValor <= 0 || !newDataEntrada) return;

    try {
      setIsSubmitting(true);
      await entradasService.addEntrada({
        descricao: newDescricao,
        valor_previsto_base: newValor,
        data_entrada: newDataEntrada,
        projetar: newProjetar,
        mes_ano_fim: newProjetar && newMesAnoFim ? newMesAnoFim : null,
        desvio_competencia: newProjetar ? newDesvioCompetencia : 0
      });
      handleRefreshAll();
      setIsModalOpen(false);
      
      // Reset Form
      setNewDescricao('');
      setNewValor(0);
      setNewDataEntrada(`${mesAno}-01`);
      setNewProjetar(true);
      setNewMesAnoFim('');
      setNewDesvioCompetencia(0);
    } catch (error: any) {
      alert('Falha ao salvar: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (entrada: EntradaMensal) => {
    setEntradaToEdit(entrada);
    setEditDescricao(entrada.descricao);
    setEditValor(entrada.valor_previsto_base);
    setEditDataEntrada(entrada.data_entrada);
    setEditProjetar(entrada.projetar);
    setEditMesAnoFim(entrada.mes_ano_fim || '');
    setEditAtivo(entrada.ativo);
    setEditDesvioCompetencia(entrada.desvio_competencia || 0);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entradaToEdit || !editDescricao || editValor <= 0 || !editDataEntrada) return;

    try {
      setIsSubmitting(true);
      await entradasService.updateEntrada(entradaToEdit.id, {
        descricao: editDescricao,
        valor_previsto_base: editValor,
        data_entrada: editDataEntrada,
        projetar: editProjetar,
        mes_ano_fim: editProjetar && editMesAnoFim ? editMesAnoFim : null,
        ativo: editAtivo,
        desvio_competencia: editProjetar ? editDesvioCompetencia : 0
      });
      handleRefreshAll();
      setEntradaToEdit(null);
    } catch (error: any) {
      alert('Falha ao editar: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta entrada? Todos os registros dela nos meses também serão apagados.')) return;
    try {
      await entradasService.deleteEntrada(id);
      handleRefreshAll();
    } catch (error: any) {
      alert('Falha ao excluir: ' + (error.message || JSON.stringify(error)));
    }
  };

  // Recharts Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          padding: '0.75rem',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            {payload[0].payload.mesAnoFormatado}
          </p>
          <p style={{ margin: 0, color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 700 }}>
            Recebido: <span>{formatBRL(payload[0].value)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="theme-entradas">
      <style>{`
        .theme-entradas {
          --primary: #10b981; /* Emerald Green */
        }
        .entradas-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1.2fr 100px;
          gap: 1.5rem;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border-color);
        }
        .entradas-header {
          font-weight: 700;
          color: var(--text-muted);
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--border-color);
        }
        .entradas-row {
          transition: background-color var(--transition-fast);
        }
        .entradas-row:hover {
          background-color: rgba(16, 185, 129, 0.04);
        }
        .inline-currency-container {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
        }
        @media (max-width: 768px) {
          .entradas-header {
            display: none !important;
          }
          .entradas-grid {
            grid-template-columns: 1fr !important;
            gap: 0.5rem;
            padding: 1rem;
            border: 2px solid var(--border-color);
            border-radius: var(--radius-md);
            margin-bottom: 0.75rem;
          }
          .inline-currency-container {
            justify-content: space-between;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="text-h1" style={{ marginBottom: 0, color: 'var(--primary)' }}>Entradas / Receitas</h1>
        <Button onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />} style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
          Nova Entrada
        </Button>
      </div>

      {/* Primary Summary Box */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <Card className="summary-card-entradas" style={{ border: '2px solid var(--border-color)', padding: '1.75rem', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--bg-card)' }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            Total Recebido no Mês
          </h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
              {formatBRL(totalRealizado)}
            </span>
          </div>
        </Card>
      </div>

      {/* Interactive List Table */}
      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" />
            <span style={{ marginLeft: '0.5rem' }}>Carregando...</span>
          </div>
        ) : entradas.length === 0 ? (
          <p className="text-muted">Nenhuma entrada cadastrada para este mês.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header Columns */}
            <div className="entradas-grid entradas-header">
              <div>Descrição</div>
              <div style={{ textAlign: 'right' }}>Valor Projetado</div>
              <div style={{ textAlign: 'right' }}>Valor da Entrada</div>
              <div style={{ textAlign: 'center' }}>Ações</div>
            </div>

            {/* List Rows */}
            {entradas.map(entrada => (
              <EntradaRow
                key={entrada.id}
                entrada={entrada}
                mesAno={mesAno}
                onUpdate={handleRefreshAll}
                onEdit={() => handleOpenEdit(entrada)}
                onDelete={() => handleDelete(entrada.id)}
                formatBRL={formatBRL}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Sleek Recharts Bar Chart */}
      <Card style={{ padding: '1.5rem', minHeight: '350px', marginTop: '2rem' }}>
        <h3 className="text-h3" style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1.5rem' }}>
          Evolução Mensal de Recebimentos (Últimos 6 meses)
        </h3>
        <div className="scrollable-chart-outer" style={{ width: '100%', height: 300, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`.scrollable-chart-outer::-webkit-scrollbar { display: none; }`}</style>
          <div style={{ minWidth: `max(100%, ${chartData.length * 70}px)`, height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="mesAnoFormatado" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar name="Recebimentos" dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={30}>
                  {chartData.map((entry, index) => {
                    const isCurrent = entry.mesAno === mesAno;
                    return <Cell key={`cell-${index}`} fill={isCurrent ? 'var(--primary)' : 'rgba(16, 185, 129, 0.45)'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Modal Adicionar */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Entrada / Receita">
        <form onSubmit={handleAddEntrada}>
          <div className="input-group">
            <label>Descrição</label>
            <input
              type="text"
              className="input"
              placeholder="Ex: Salário, Freelance"
              value={newDescricao}
              onChange={e => setNewDescricao(e.target.value)}
              required
            />
          </div>
          <CurrencyInput
            label="Valor"
            value={newValor}
            onChange={setNewValor}
            required
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="input-group">
              <label>Data de Início/Ocorrência</label>
              <input
                type="date"
                className="input"
                value={newDataEntrada}
                onChange={e => setNewDataEntrada(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="input-group" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="newProjetar"
              checked={newProjetar}
              onChange={e => setNewProjetar(e.target.checked)}
              style={{ width: 'auto', cursor: 'pointer' }}
            />
            <label htmlFor="newProjetar" style={{ margin: 0, cursor: 'pointer', fontWeight: 700 }}>Projetar recorrentemente todos os meses</label>
          </div>

          {newProjetar && (
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Mês de Contabilidade (Competência)</label>
              <select
                className="input"
                value={newDesvioCompetencia}
                onChange={e => setNewDesvioCompetencia(Number(e.target.value))}
                style={{ cursor: 'pointer' }}
              >
                <option value={0}>No mesmo mês do recebimento (Padrão)</option>
                <option value={1}>No mês seguinte ao recebimento (Ex: Salário no fim do mês)</option>
                <option value={-1}>No mês anterior ao recebimento</option>
              </select>
            </div>
          )}

          {newProjetar && (
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Mês Fim da Projeção (Opcional)</label>
              <input
                type="month"
                className="input"
                value={newMesAnoFim}
                onChange={e => setNewMesAnoFim(e.target.value)}
                placeholder="Sem fim definido"
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar */}
      <Modal isOpen={!!entradaToEdit} onClose={() => setEntradaToEdit(null)} title="Editar Entrada / Receita">
        {entradaToEdit && (
          <form onSubmit={handleSaveEdit}>
            <div className="input-group">
              <label>Descrição</label>
              <input
                type="text"
                className="input"
                value={editDescricao}
                onChange={e => setEditDescricao(e.target.value)}
                required
              />
            </div>
            <CurrencyInput
              label="Valor"
              value={editValor}
              onChange={setEditValor}
              required
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="input-group">
                <label>Data de Início/Ocorrência</label>
                <input
                  type="date"
                  className="input"
                  value={editDataEntrada}
                  onChange={e => setEditDataEntrada(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="input-group" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="editProjetar"
                checked={editProjetar}
                onChange={e => setEditProjetar(e.target.checked)}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <label htmlFor="editProjetar" style={{ margin: 0, cursor: 'pointer', fontWeight: 700 }}>Projetar recorrentemente todos os meses</label>
            </div>

            {editProjetar && (
              <>
                <div className="input-group" style={{ marginTop: '1rem' }}>
                  <label>Mês de Contabilidade (Competência)</label>
                  <select
                    className="input"
                    value={editDesvioCompetencia}
                    onChange={e => setEditDesvioCompetencia(Number(e.target.value))}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value={0}>No mesmo mês do recebimento (Padrão)</option>
                    <option value={1}>No mês seguinte ao recebimento (Ex: Salário no fim do mês)</option>
                    <option value={-1}>No mês anterior ao recebimento</option>
                  </select>
                </div>
              </>
            )}

            {editProjetar && (
              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label>Mês Fim da Projeção (Opcional)</label>
                <input
                  type="month"
                  className="input"
                  value={editMesAnoFim}
                  onChange={e => setEditMesAnoFim(e.target.value)}
                />
              </div>
            )}

            <div className="input-group" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="editAtivo"
                checked={editAtivo}
                onChange={e => setEditAtivo(e.target.checked)}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <label htmlFor="editAtivo" style={{ margin: 0, cursor: 'pointer', fontWeight: 700 }}>Ativo (vigente)</label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
              <Button type="button" variant="outline" onClick={() => setEntradaToEdit(null)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
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

// Separate component for rows to manage state, debouncing, and inline CurrencyInput elegantly
function EntradaRow({
  entrada,
  mesAno,
  onUpdate,
  onEdit,
  onDelete,
  formatBRL
}: {
  entrada: EntradaMensal;
  mesAno: string;
  onUpdate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatBRL: (val: number) => string;
}) {
  const dbValorReal = entrada.registro_atual?.valor_real ?? 0;
  const [localValorReal, setLocalValorReal] = useState(dbValorReal);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if month changes or db updates
  useEffect(() => {
    setLocalValorReal(dbValorReal);
  }, [dbValorReal]);

  // Debounced save for the manual CurrencyInput
  useEffect(() => {
    if (localValorReal === dbValorReal) return;

    const timer = setTimeout(async () => {
      try {
        setIsSaving(true);
        await entradasService.upsertRegistroEntrada(entrada.id, mesAno, localValorReal);
        onUpdate();
      } catch (error) {
        console.error('Erro ao atualizar valor real:', error);
      } finally {
        setIsSaving(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [localValorReal, dbValorReal, entrada.id, mesAno, onUpdate]);

  return (
    <div className="entradas-grid entradas-row">
      {/* Col 1: Descrição */}
      <div>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{entrada.descricao}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
          {entrada.projetar ? (
            <>
              Projetada • Dia {entrada.data_entrada.split('-')[2]}
              {entrada.desvio_competencia === 1 && ' (Comp. Mês Seguinte)'}
              {entrada.desvio_competencia === -1 && ' (Comp. Mês Anterior)'}
            </>
          ) : (
            <>Única • {entrada.data_entrada.split('-').reverse().join('/')}</>
          )}
          {entrada.projetar && entrada.mes_ano_fim && ` (Até ${entrada.mes_ano_fim.split('-').reverse().join('/')})`}
        </div>
      </div>

      {/* Col 2: Valor Projetado */}
      <div style={{ textAlign: 'right', fontWeight: 500 }}>
        {entrada.projetar ? (
          formatBRL(entrada.valor_previsto_base)
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>-</span>
        )}
      </div>

      {/* Col 3: Valor da Entrada (Plain text for one-offs, editable CurrencyInput for projected entries) */}
      <div className="inline-currency-container" style={{ textAlign: 'right' }}>
        {entrada.projetar ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'flex-end' }}>
            {isSaving && <Loader2 className="animate-spin text-muted" size={14} />}
            <CurrencyInput
              value={localValorReal}
              onChange={setLocalValorReal}
              placeholder="R$ 0,00"
              style={{
                width: '130px',
                padding: '0.4rem 0.75rem',
                fontSize: '0.875rem',
                marginBottom: 0,
                textAlign: 'right'
              }}
            />
          </div>
        ) : (
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            {formatBRL(entrada.valor_previsto_base)}
          </span>
        )}
      </div>

      {/* Col 4: Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
        <button
          onClick={onEdit}
          style={{ padding: '0.25rem', color: 'var(--text-muted)', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          title="Editar Despesa" // Matches global selector
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={onDelete}
          style={{ padding: '0.25rem', color: 'var(--text-muted)', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          title="Excluir Despesa" // Matches global selector
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
