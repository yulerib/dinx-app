import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Plus, Check, Loader2, Edit2, Trash2, TrendingUp, Calendar, RefreshCw } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { entradasService } from '../services/entradas';
import { salarioService } from '../services/salario';
import type { EntradaMensal, Salario } from '../types/database.types';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TransactionListItem } from '../components/ui/TransactionListItem';

export function Entradas() {
  const { currentMonth } = useMonth();
  const year = currentMonth.getFullYear();
  const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${month}`;

  const [entradas, setEntradas] = useState<EntradaMensal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<{ mesAno: string; mesAnoFormatado: string; total: number }[]>([]);

  // Salário state
  const [salario, setSalario] = useState<Salario | null>(null);
  const [isSalarioModalOpen, setIsSalarioModalOpen] = useState(false);
  const [isReceberSalarioModalOpen, setIsReceberSalarioModalOpen] = useState(false);
  const [isSubmittingSalario, setIsSubmittingSalario] = useState(false);

  // Salário — form previsão
  const [salarioValorPrevisto, setSalarioValorPrevisto] = useState(0);
  const [salarioDiaPrevisto, setSalarioDiaPrevisto] = useState<number | ''>(5);
  const [salarioDesvioMes, setSalarioDesvioMes] = useState(0); // 0=mesmo mês, 1=próximo, -1=anterior

  // Salário — form recebimento
  const [salarioValorReal, setSalarioValorReal] = useState(0);
  const [salarioDataReal, setSalarioDataReal] = useState(`${mesAno}-01`);

  // Summary totals
  const [totalRealizado, setTotalRealizado] = useState(0);
  const [totalPrevisto, setTotalPrevisto] = useState(0);

  // Create Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDescricao, setNewDescricao] = useState('');
  const [newValor, setNewValor] = useState(0);
  const [newDataEntrada, setNewDataEntrada] = useState(`${mesAno}-01`);
  const [newProjetar, setNewProjetar] = useState(false);
  const [newMesAnoFim, setNewMesAnoFim] = useState('');
  const [newTemFimDefinido, setNewTemFimDefinido] = useState(false);

  // Edit Modal State
  const [entradaToEdit, setEntradaToEdit] = useState<EntradaMensal | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState(0);
  const [editDataEntrada, setEditDataEntrada] = useState('');
  const [editProjetar, setEditProjetar] = useState(false);
  const [editMesAnoFim, setEditMesAnoFim] = useState('');
  const [editTemFimDefinido, setEditTemFimDefinido] = useState(false);
  const [editAtivo, setEditAtivo] = useState(true);

  const fetchEntradas = async () => {
    try {
      setIsLoading(true);
      const data = await entradasService.fetchEntradasMensais(mesAno);
      setEntradas(data);

      const { previsto, realizado } = await entradasService.fetchTotalsPorMes(mesAno);
      setTotalPrevisto(previsto);
      setTotalRealizado(realizado);
    } catch (error) {
      console.error('Erro ao buscar entradas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSalario = async () => {
    try {
      const data = await salarioService.fetchSalario(mesAno);
      setSalario(data);
    } catch (error) {
      console.error('Erro ao buscar salário:', error);
    }
  };

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
    fetchSalario();
    fetchChartData();
  };

  useEffect(() => {
    handleRefreshAll();
    setSalarioDataReal(`${mesAno}-01`);
    setNewDataEntrada(`${mesAno}-01`);
  }, [mesAno]);

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // --- Handlers Entradas ---

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
        mes_ano_fim: newProjetar && newTemFimDefinido && newMesAnoFim ? newMesAnoFim : null,
      });
      handleRefreshAll();
      setIsModalOpen(false);
      setNewDescricao('');
      setNewValor(0);
      setNewDataEntrada(`${mesAno}-01`);
      setNewProjetar(false);
      setNewMesAnoFim('');
      setNewTemFimDefinido(false);
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
    setEditTemFimDefinido(!!entrada.mes_ano_fim);
    setEditAtivo(entrada.ativo);
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
        mes_ano_fim: editProjetar && editTemFimDefinido && editMesAnoFim ? editMesAnoFim : null,
        ativo: editAtivo,
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

  // --- Handlers Salário ---

  const handleOpenSalarioModal = () => {
    setSalarioValorPrevisto(salario?.valor_previsto || 0);
    setSalarioDiaPrevisto(salario?.dia_previsto || 5);
    setSalarioDesvioMes(salario?.desvio_mes_deposito ?? 0);
    setIsSalarioModalOpen(true);
  };

  const handleSaveSalarioPrevisto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salarioValorPrevisto || salarioValorPrevisto <= 0) return;
    try {
      setIsSubmittingSalario(true);
      await salarioService.configureSalario(
        mesAno,
        salarioValorPrevisto,
        salarioDiaPrevisto ? Number(salarioDiaPrevisto) : null,
        salarioDesvioMes
      );
      await fetchSalario();
      setIsSalarioModalOpen(false);
    } catch (error: any) {
      alert('Falha ao salvar salário: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmittingSalario(false);
    }
  };

  const handleOpenReceberSalario = () => {
    setSalarioValorReal(salario?.valor_real || salario?.valor_previsto || 0);
    setSalarioDataReal(salario?.data_real || `${mesAno}-01`);
    setIsReceberSalarioModalOpen(true);
  };

  const handleRegistrarRecebimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salarioValorReal || salarioValorReal <= 0 || !salarioDataReal) return;
    try {
      setIsSubmittingSalario(true);
      await salarioService.registrarRecebimento(mesAno, salarioValorReal, salarioDataReal);
      await fetchSalario();
      setIsReceberSalarioModalOpen(false);
    } catch (error: any) {
      alert('Falha ao registrar recebimento: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmittingSalario(false);
    }
  };

  const handleEstornarSalario = async () => {
    if (!confirm('Deseja estornar o recebimento do salário?')) return;
    try {
      await salarioService.estornarRecebimento(mesAno);
      await fetchSalario();
    } catch (error: any) {
      alert('Falha ao estornar: ' + (error.message || JSON.stringify(error)));
    }
  };

  // Helpers para exibição do salário
  const salarioRecebido = salario && salario.valor_real !== null && salario.valor_real !== undefined;
  const salarioCadastrado = !!salario;

  const getSalarioDiaFormatado = () => {
    if (!salario) return '';
    if (salario.data_real) {
      const [, , d] = salario.data_real.split('-');
      return `Recebido dia ${Number(d)}`;
    }
    if (salario.dia_previsto) {
      const desvio = salario.desvio_mes_deposito ?? 0;
      if (desvio === 0) {
        return `Previsto dia ${salario.dia_previsto}`;
      }
      const mesesPt = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const [mpY, mpM] = salarioService.getMesDeposito(mesAno, desvio).split('-').map(Number);
      const label = desvio > 0 ? `mês seguinte (${mesesPt[mpM - 1]}/${String(mpY).slice(-2)})` : `mês anterior (${mesesPt[mpM - 1]}/${String(mpY).slice(-2)})`;
      return `Previsto dia ${salario.dia_previsto} — ${label}`;
    }
    return 'Sem previsão de data';
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
          --primary: #6BA35A; /* Green */
        }
        @media (max-width: 768px) {
          .table-header { display: none !important; }
        }
        .salario-box {
          border: 2px solid rgba(59, 130, 246, 0.25);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
        }
        .salario-status-recebido {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.3rem 0.75rem;
          background: rgba(107, 163, 90, 0.12);
          color: #6BA35A;
          border-radius: 50px;
          font-size: 0.78rem;
          font-weight: 700;
        }
        .salario-status-previsto {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.3rem 0.75rem;
          background: rgba(59, 130, 246, 0.10);
          color: #3b82f6;
          border-radius: 50px;
          font-size: 0.78rem;
          font-weight: 700;
        }
        .salario-status-vazio {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.3rem 0.75rem;
          background: rgba(107, 114, 128, 0.10);
          color: var(--text-muted);
          border-radius: 50px;
          font-size: 0.78rem;
          font-weight: 700;
        }
        .recorrencia-toggle {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }
        .recorrencia-btn {
          flex: 1;
          padding: 0.6rem;
          border-radius: var(--radius-md);
          border: 2px solid var(--border-color);
          background: transparent;
          color: var(--text-muted);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .recorrencia-btn.active {
          border-color: var(--primary);
          background: rgba(107, 163, 90, 0.10);
          color: var(--primary);
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
        <Card className="summary-card-entradas">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <div>
              <h3 className="text-h3" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Resumo do Mês</h3>
              <div className="entradas-summary-container">
                <style>{`
                  .entradas-summary-container {
                    display: flex;
                    align-items: baseline;
                    gap: 0.5rem;
                    margin-top: 0.25rem;
                  }
                  .entradas-summary-row1 {
                    display: flex;
                    align-items: baseline;
                  }
                  .entradas-summary-exec-label {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                    font-weight: 500;
                  }
                  .entradas-summary-separator {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                  }
                  .entradas-summary-proj {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                  }
                  @media (max-width: 768px) {
                    .entradas-summary-container {
                      flex-direction: column;
                      align-items: flex-start;
                      gap: 0.15rem;
                    }
                    .entradas-summary-separator {
                      display: none;
                    }
                  }
                `}</style>
                <div className="entradas-summary-row1">
                  <span className="text-h2" style={{ margin: 0, color: 'var(--primary)' }}>
                    {formatBRL(totalRealizado)}
                  </span>
                  <span className="entradas-summary-exec-label" style={{ marginLeft: '0.5rem' }}>Recebido</span>
                </div>
                <span className="entradas-summary-separator">/</span>
                <span className="entradas-summary-proj">Projetado: {formatBRL(totalPrevisto)}</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: '6px',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            marginTop: '0.5rem'
          }}>
            <div
              style={{
                height: '100%',
                width: `${totalPrevisto > 0 ? Math.min((totalRealizado / totalPrevisto) * 100, 100) : (totalRealizado > 0 ? 100 : 0)}%`,
                transition: 'width 0.5s ease-out'
              }}
            />
          </div>
        </Card>
      </div>

      {/* BOX DE SALÁRIO */}
      <div className="salario-box" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Título + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={20} color="#3b82f6" />
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>Salário</span>
            </div>

            {salarioRecebido ? (
              <span className="salario-status-recebido">
                <Check size={12} /> Recebido
              </span>
            ) : salarioCadastrado ? (
              <span className="salario-status-previsto">
                <Calendar size={12} /> Aguardando recebimento
              </span>
            ) : (
              <span className="salario-status-vazio">
                Não configurado
              </span>
            )}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleOpenSalarioModal}
              style={{
                padding: '0.4rem 0.85rem',
                backgroundColor: 'rgba(59, 130, 246, 0.10)',
                border: '1.5px solid rgba(59, 130, 246, 0.35)',
                color: '#3b82f6',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              title="Configurar previsão de salário"
            >
              <RefreshCw size={13} />
              {salarioCadastrado ? 'Editar Previsão' : 'Configurar'}
            </button>

            {salarioCadastrado && !salarioRecebido && (
              <button
                onClick={handleOpenReceberSalario}
                style={{
                  padding: '0.4rem 0.85rem',
                  backgroundColor: 'rgba(107, 163, 90, 0.15)',
                  border: '1.5px solid var(--success, #6BA35A)',
                  color: 'var(--success, #6BA35A)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--success, #6BA35A)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(107, 163, 90, 0.15)'; e.currentTarget.style.color = 'var(--success, #6BA35A)'; }}
                title="Registrar recebimento do salário"
              >
                <Check size={13} /> Receber
              </button>
            )}

            {salarioRecebido && (
              <button
                onClick={handleOpenReceberSalario}
                style={{
                  padding: '0.4rem 0.85rem',
                  backgroundColor: 'transparent',
                  border: '1.5px dashed var(--border-color)',
                  color: 'var(--text-muted)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title="Corrigir recebimento"
              >
                Corrigir
              </button>
            )}
          </div>
        </div>

        {/* Valores */}
        {salarioCadastrado && (
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                Valor Previsto
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6' }}>
                {formatBRL(salario!.valor_previsto)}
              </div>
            </div>

            {salarioRecebido && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Valor Recebido
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6BA35A' }}>
                  {formatBRL(salario!.valor_real!)}
                </div>
              </div>
            )}

            <div style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {getSalarioDiaFormatado()}
              </div>
              {salarioRecebido && salario!.data_real && (
                <button
                  onClick={handleEstornarSalario}
                  style={{
                    marginTop: '0.35rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Estornar recebimento
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive List Table */}
      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" />
            <span style={{ marginLeft: '0.5rem' }}>Carregando...</span>
          </div>
        ) : entradas.filter(e => e.id !== 'salario-virtual').length === 0 ? (
          <p className="text-muted" style={{ padding: '1rem', margin: 0 }}>Nenhuma entrada cadastrada para este mês.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header Columns */}
            <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
              <div>Descrição</div>
              <div style={{ textAlign: 'right' }}>Projetado</div>
              <div style={{ textAlign: 'right' }}>Recebido</div>
              <div style={{ textAlign: 'center' }}></div>
            </div>

            {/* List Rows */}
            {entradas.filter(e => e.id !== 'salario-virtual').map(entrada => (
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

      {/* Modal Adicionar Entrada */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Entrada / Receita">
        <form onSubmit={handleAddEntrada}>
          <div className="input-group">
            <label>Descrição</label>
            <input
              type="text"
              className="input"
              placeholder="Ex: Freelance, Aluguel recebido"
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
          <div style={{ marginTop: '1rem' }} className="input-group">
            <label>Data da entrada</label>
            <input
              type="date"
              className="input"
              value={newDataEntrada}
              onChange={e => setNewDataEntrada(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginTop: '1.25rem' }}>
            <label>Esta entrada é recorrente?</label>
            <div className="recorrencia-toggle">
              <button
                type="button"
                className={`recorrencia-btn ${!newProjetar ? 'active' : ''}`}
                onClick={() => { setNewProjetar(false); setNewTemFimDefinido(false); }}
              >
                Pontual (única)
              </button>
              <button
                type="button"
                className={`recorrencia-btn ${newProjetar ? 'active' : ''}`}
                onClick={() => setNewProjetar(true)}
              >
                Recorrente (mensal)
              </button>
            </div>
          </div>

          {newProjetar && (
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Duração da recorrência</label>
              <div className="recorrencia-toggle">
                <button
                  type="button"
                  className={`recorrencia-btn ${!newTemFimDefinido ? 'active' : ''}`}
                  onClick={() => { setNewTemFimDefinido(false); setNewMesAnoFim(''); }}
                >
                  Sem previsão de fim
                </button>
                <button
                  type="button"
                  className={`recorrencia-btn ${newTemFimDefinido ? 'active' : ''}`}
                  onClick={() => setNewTemFimDefinido(true)}
                >
                  Até um mês específico
                </button>
              </div>
              {newTemFimDefinido && (
                <div style={{ marginTop: '0.75rem' }}>
                  <input
                    type="month"
                    className="input"
                    value={newMesAnoFim}
                    onChange={e => setNewMesAnoFim(e.target.value)}
                    placeholder="Mês de encerramento"
                  />
                </div>
              )}
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

      {/* Modal Editar Entrada */}
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
            <div style={{ marginTop: '1rem' }} className="input-group">
              <label>Data da entrada</label>
              <input
                type="date"
                className="input"
                value={editDataEntrada}
                onChange={e => setEditDataEntrada(e.target.value)}
                required
              />
            </div>

            <div className="input-group" style={{ marginTop: '1.25rem' }}>
              <label>Esta entrada é recorrente?</label>
              <div className="recorrencia-toggle">
                <button
                  type="button"
                  className={`recorrencia-btn ${!editProjetar ? 'active' : ''}`}
                  onClick={() => { setEditProjetar(false); setEditTemFimDefinido(false); }}
                >
                  Pontual (única)
                </button>
                <button
                  type="button"
                  className={`recorrencia-btn ${editProjetar ? 'active' : ''}`}
                  onClick={() => setEditProjetar(true)}
                >
                  Recorrente (mensal)
                </button>
              </div>
            </div>

            {editProjetar && (
              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label>Duração da recorrência</label>
                <div className="recorrencia-toggle">
                  <button
                    type="button"
                    className={`recorrencia-btn ${!editTemFimDefinido ? 'active' : ''}`}
                    onClick={() => { setEditTemFimDefinido(false); setEditMesAnoFim(''); }}
                  >
                    Sem previsão de fim
                  </button>
                  <button
                    type="button"
                    className={`recorrencia-btn ${editTemFimDefinido ? 'active' : ''}`}
                    onClick={() => setEditTemFimDefinido(true)}
                  >
                    Até um mês específico
                  </button>
                </div>
                {editTemFimDefinido && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <input
                      type="month"
                      className="input"
                      value={editMesAnoFim}
                      onChange={e => setEditMesAnoFim(e.target.value)}
                    />
                  </div>
                )}
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

      {/* Modal Configurar Salário */}
      <Modal isOpen={isSalarioModalOpen} onClose={() => setIsSalarioModalOpen(false)} title={`Salário — ${mesAno.split('-').reverse().join('/')}`}>
        <form onSubmit={handleSaveSalarioPrevisto}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 0 }}>
            A configuração será aplicada a este mês e a todos os meses futuros sem recebimento registrado.
            O salário é sempre contabilizado nas receitas de <strong>{mesAno.split('-').reverse().join('/')}</strong>, independente do dia do depósito.
          </p>
          <CurrencyInput
            label="Valor Previsto"
            value={salarioValorPrevisto}
            onChange={setSalarioValorPrevisto}
            required
          />
          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Dia previsto do depósito</label>
            <input
              type="number"
              className="input"
              min={1}
              max={31}
              value={salarioDiaPrevisto}
              onChange={e => setSalarioDiaPrevisto(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 5"
            />
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Quando ocorre o depósito?</label>
            <select
              className="input"
              value={salarioDesvioMes}
              onChange={e => setSalarioDesvioMes(Number(e.target.value))}
              style={{ cursor: 'pointer' }}
            >
              <option value={-2}>2 meses antes do mês de referência</option>
              <option value={-1}>No mês anterior ao mês de referência</option>
              <option value={0}>No mesmo mês de referência (Padrão)</option>
              <option value={1}>No mês seguinte ao mês de referência</option>
              <option value={2}>2 meses após o mês de referência</option>
            </select>
            {salarioDesvioMes !== 0 && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: 0 }}>
                {salarioDesvioMes > 0
                  ? `Ex: salário de ${mesAno.split('-').reverse().join('/')} será depositado em ${salarioService.getMesDeposito(mesAno, salarioDesvioMes).split('-').reverse().join('/')}.`
                  : `Ex: salário de ${mesAno.split('-').reverse().join('/')} foi depositado em ${salarioService.getMesDeposito(mesAno, salarioDesvioMes).split('-').reverse().join('/')}.`
                }
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsSalarioModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmittingSalario} style={{ backgroundColor: '#3b82f6', color: 'white' }}>
              {isSubmittingSalario ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Salvar e Propagar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Registrar Recebimento do Salário */}
      <Modal isOpen={isReceberSalarioModalOpen} onClose={() => setIsReceberSalarioModalOpen(false)} title="Registrar Recebimento do Salário">
        <form onSubmit={handleRegistrarRecebimento}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 0 }}>
            Este recebimento será contabilizado nas receitas de <strong>{mesAno.split('-').reverse().join('/')}</strong> e aparecerá no extrato na data informada abaixo.
          </p>
          <CurrencyInput
            label="Valor Recebido"
            value={salarioValorReal}
            onChange={setSalarioValorReal}
            required
          />
          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Data do recebimento</label>
            <input
              type="date"
              className="input"
              value={salarioDataReal}
              onChange={e => setSalarioDataReal(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsReceberSalarioModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmittingSalario} style={{ backgroundColor: '#6BA35A', color: 'white' }}>
              {isSubmittingSalario ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Confirmar Recebimento
            </Button>
          </div>
        </form>
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
  const [isEditingValue, setIsEditingValue] = useState(false);

  useEffect(() => {
    setLocalValorReal(dbValorReal);
  }, [dbValorReal]);

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
    }, 600);

    return () => clearTimeout(timer);
  }, [localValorReal, dbValorReal, entrada.id, mesAno, onUpdate]);

  const toSentenceCase = (str: string) => {
    if (!str) return '';
    const trimmed = str.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  };

  const isReceived = localValorReal > 0;

  const dataParte = entrada.data_entrada.split('-');
  const diaEntrada = dataParte[2];

  const legenda = entrada.projetar
    ? `Recorrente • Dia ${diaEntrada}`
    : `Pontual • ${diaEntrada}/${dataParte[1]}/${dataParte[0]}`;

  const legendaCompleta = entrada.projetar && entrada.mes_ano_fim
    ? `${legenda} (Até ${entrada.mes_ano_fim.split('-').reverse().join('/')})`
    : legenda;

  return (
    <TransactionListItem
      type="fixed"
      className={isReceived ? 'gasto-row-ja-paga' : 'gasto-row-aberta'}
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600 }}>{toSentenceCase(entrada.descricao)}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {legendaCompleta}
          </span>
        </div>
      }
      value1={
        entrada.projetar ? (
          formatBRL(entrada.valor_previsto_base)
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>-</span>
        )
      }
      value2={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {isSaving && <Loader2 className="animate-spin text-muted" size={14} />}

          {entrada.projetar ? (
            isEditingValue ? (
              <CurrencyInput
                value={localValorReal}
                onChange={setLocalValorReal}
                placeholder="R$ 0,00"
                autoFocus
                onBlur={() => setIsEditingValue(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingValue(false);
                }}
                style={{
                  width: '120px',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.875rem',
                  marginBottom: 0,
                  textAlign: 'right'
                }}
              />
            ) : isReceived ? (
              <div
                onClick={() => setIsEditingValue(true)}
                style={{
                  cursor: 'pointer',
                  padding: '0.4rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--success)',
                  fontWeight: 600,
                  backgroundColor: 'rgba(107, 163, 90, 0.05)'
                }}
                title="Clique para alterar o recebimento"
              >
                {formatBRL(localValorReal)}
              </div>
            ) : (
              <button
                onClick={() => {
                  setLocalValorReal(entrada.valor_previsto_base);
                  setIsEditingValue(true);
                }}
                style={{
                  padding: '0.35rem 0.65rem',
                  backgroundColor: 'rgba(107, 163, 90, 0.15)',
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
                  e.currentTarget.style.backgroundColor = 'rgba(107, 163, 90, 0.15)';
                  e.currentTarget.style.color = 'var(--success)';
                }}
                title="Registrar recebimento"
              >
                <Check size={12} /> Receber
              </button>
            )
          ) : (
            // Entrada pontual (única)
            <div
              style={{
                padding: '0.4rem 0.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-color)',
                color: 'var(--success)',
                fontWeight: 600,
                backgroundColor: 'rgba(107, 163, 90, 0.05)'
              }}
            >
              {formatBRL(entrada.valor_previsto_base)}
            </div>
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
            title="Editar Entrada"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={onDelete}
            style={{ padding: '0.25rem', color: 'var(--text-muted)', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            title="Apagar Entrada"
          >
            <Trash2 size={16} />
          </button>
        </>
      }
    />
  );
}
