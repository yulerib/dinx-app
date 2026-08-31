import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Plus, Check, Loader2, Edit2, Trash2, Settings, Repeat, Ban, RotateCcw, CreditCard } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { parcelasService, getParcelaCartaoInfo, getMesAnoAnteriorHelper } from '../services/parcelas';
import { chartsService } from '../services/charts';
import type { ChartDataPoint } from '../services/charts';
import type { CompraParcelada, PagamentoFatura, CategoriaCartao } from '../types/database.types';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import './CartaoCredito.css';

interface CompraAtiva extends CompraParcelada {
  numero_parcela_atual: number | null;
  is_recorrente: boolean;
}

export function CartaoCredito() {
  const { currentMonth } = useMonth();
  const mesAno = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  
  const [isLoading, setIsLoading] = useState(true);
  const [limiteMensal, setLimiteMensal] = useState(0);
  const [parcelasAtivas, setParcelasAtivas] = useState<CompraAtiva[]>([]);
  const [todasParcelas, setTodasParcelas] = useState<CompraParcelada[]>([]); // Cache local
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [categorias, setCategorias] = useState<CategoriaCartao[]>([]);

  // Fatura do Mês Anterior
  const [pagamentoFaturaAnterior, setPagamentoFaturaAnterior] = useState<PagamentoFatura | null>(null);
  const getInitialPaymentDate = () => {
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = String(today.getMonth() + 1).padStart(2, '0');
    const todayD = String(today.getDate()).padStart(2, '0');
    return `${todayY}-${todayM}-${todayD}`;
  };
  const [dataPagamentoRealInput, setDataPagamentoRealInput] = useState<string>(getInitialPaymentDate());
  const [isPayingFatura, setIsPayingFatura] = useState(false);
  const [isCCPaymentModalOpen, setIsCCPaymentModalOpen] = useState(false);

  // Modals
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCompraModalOpen, setIsCompraModalOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Configs
  const [tempLimite, setTempLimite] = useState(0);

  // Form Compra
  const [compraToEdit, setCompraToEdit] = useState<CompraParcelada | null>(null);
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [nomeCompra, setNomeCompra] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorTotal, setValorTotal] = useState(0);
  const [numParcelas, setNumParcelas] = useState(1);
  const [valorParcela, setValorParcela] = useState(0);
  const [mesAnoInicio, setMesAnoInicio] = useState(mesAno);
  const [dataCompra, setDataCompra] = useState('');
  const [idCategoria, setIdCategoria] = useState<string | null>(null);
  const [mesAnoFim, setMesAnoFim] = useState<string | null>(null);

  // Form Categoria
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const mesAnoAnterior = getMesAnoAnteriorHelper(mesAno);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // 1. Configurações
      const config = await parcelasService.fetchConfiguracao();
      if (config) setLimiteMensal(config.limite_mensal_parcelas);

      // 2. Compras / Parcelas
      const compras = await parcelasService.fetchTodasParcelas();
      setTodasParcelas(compras);

      // 3. Pagamento Fatura Mês Anterior
      const pag = await parcelasService.fetchPagamentoFatura(mesAnoAnterior);
      setPagamentoFaturaAnterior(pag);

      // 4. Carregar gráficos
      const cData = await chartsService.getDashboardChartsData(currentMonth);
      setChartData(cData);

      // 5. Carregar Categorias
      const cats = await parcelasService.fetchCategoriasCartao();
      setCategorias(cats);

    } catch (error) {
      console.error('Erro ao buscar dados do Cartão de Crédito:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mesAno]); // Recarrega quando muda o mês selecionado

  // Reseta dataCompra quando muda o mês selecionado no topo
  useEffect(() => {
    const today = new Date();
    const todayMesAno = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (mesAno === todayMesAno) {
      const d = String(today.getDate()).padStart(2, '0');
      setDataCompra(`${mesAno}-${d}`);
    } else {
      setDataCompra(`${mesAno}-01`);
    }
  }, [mesAno]);

  // Sempre que a lista global de parcelas mudar, recalcula as ativas
  useEffect(() => {
    const ativas = todasParcelas.map(compra => {
      const info = getParcelaCartaoInfo(compra, mesAno);
      return info.ativa ? { ...compra, numero_parcela_atual: info.numeroParcelaAtual, is_recorrente: info.isRecorrente } : null;
    }).filter(c => c !== null) as CompraAtiva[];
    
    // Ordena as compras por ordem de dia do primeiro para o último
    const sortedAtivas = ativas.sort((a, b) => {
      const dayA = Number(a.data_compra.split('-')[2]);
      const dayB = Number(b.data_compra.split('-')[2]);
      return dayA - dayB;
    });

    setParcelasAtivas(sortedAtivas);
  }, [mesAno, todasParcelas]);

  // Resumo do Mês
  const totalProjetado = limiteMensal;
  const totalExecutado = parcelasAtivas.reduce((acc, p) => acc + p.valor_parcela, 0);

  // Fatura Mês Anterior
  const parcelasAnterior = todasParcelas.filter(compra => {
    return getParcelaCartaoInfo(compra, mesAnoAnterior).ativa;
  });
  const valorFaturaAnterior = parcelasAnterior.reduce((acc, p) => acc + p.valor_parcela, 0);

  // Assinaturas Canceladas em/antes deste mês
  const assinaturasCanceladas = todasParcelas.filter(compra => {
    if (!compra.recorrente) return false;
    return compra.mes_ano_inicio <= mesAno && compra.mes_ano_fim && compra.mes_ano_fim < mesAno;
  });

  const isAtrasada = () => {
    if (pagamentoFaturaAnterior?.pago) return false;
    if (valorFaturaAnterior === 0) return false;
    
    const today = new Date();
    const selectedYear = currentMonth.getFullYear();
    const selectedMonthNum = currentMonth.getMonth();
    const dueDate = new Date(selectedYear, selectedMonthNum, 10, 23, 59, 59);
    return today > dueDate;
  };

  const getStatusColorGlobally = () => {
    if (totalExecutado === 0) return 'var(--text-muted)';
    if (totalProjetado === 0) return totalExecutado > 0 ? 'var(--danger)' : 'var(--text-muted)';
    const pct = totalExecutado / totalProjetado;
    if (pct <= 1.0) return 'var(--success)';
    return 'var(--danger)';
  };

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatMesAnoAbreviado = (mesAnoStr: string) => {
    const [year, month] = mesAnoStr.split('-').map(Number);
    const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${mesesAbrev[month - 1]}/${String(year).slice(-2)}`;
  };

  // Manipuladores de Configuração
  const handleOpenConfig = () => {
    setTempLimite(limiteMensal);
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await parcelasService.updateLimiteParcelas(tempLimite);
      setLimiteMensal(tempLimite);
      setIsConfigModalOpen(false);
    } catch (error: any) {
      alert('Erro ao salvar limite: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manipuladores de Compra
  const handleOpenNewCompra = () => {
    setCompraToEdit(null);
    setIsRecorrente(false);
    setNomeCompra('');
    setDescricao('');
    setValorTotal(0);
    setNumParcelas(1);
    setValorParcela(0);
    setMesAnoInicio(mesAno);
    setIdCategoria(null);
    setMesAnoFim(null);

    const today = new Date();
    const todayMesAno = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (mesAno === todayMesAno) {
      const d = String(today.getDate()).padStart(2, '0');
      setDataCompra(`${mesAno}-${d}`);
    } else {
      setDataCompra(`${mesAno}-01`);
    }
    setIsCompraModalOpen(true);
  };

  const handleOpenEditCompra = (compra: CompraParcelada) => {
    setCompraToEdit(compra);
    setIsRecorrente(!!compra.recorrente);
    setNomeCompra(compra.nome_compra);
    setDescricao(compra.descricao || '');
    setValorTotal(compra.valor_total);
    setNumParcelas(compra.num_parcelas);
    setValorParcela(compra.valor_parcela);
    setMesAnoInicio(compra.mes_ano_inicio);
    setDataCompra(compra.data_compra);
    setIdCategoria(compra.id_categoria || null);
    setMesAnoFim(compra.mes_ano_fim || null);
    setIsCompraModalOpen(true);
  };

  const handleSaveCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCompra || !mesAnoInicio || !dataCompra) return;

    if (isRecorrente) {
      if (valorParcela <= 0) return;
    } else {
      if (valorTotal <= 0 || numParcelas < 1 || valorParcela <= 0) return;
    }
    
    try {
      setIsSubmitting(true);
      const descVal = descricao.trim() ? descricao.trim() : null;
      const catVal = idCategoria || null;
      const finalValorTotal = isRecorrente ? valorParcela : valorTotal;
      const finalNumParcelas = isRecorrente ? 1 : numParcelas;
      const finalValorParcela = valorParcela;
      const finalMesAnoFim = isRecorrente ? mesAnoFim : null;

      if (compraToEdit) {
        await parcelasService.updateParcela(
          compraToEdit.id, 
          nomeCompra, 
          finalValorTotal, 
          finalNumParcelas, 
          finalValorParcela, 
          mesAnoInicio,
          descVal,
          dataCompra,
          catVal,
          isRecorrente,
          finalMesAnoFim
        );
      } else {
        await parcelasService.addParcela(
          nomeCompra, 
          finalValorTotal, 
          finalNumParcelas, 
          finalValorParcela, 
          mesAnoInicio,
          descVal,
          dataCompra,
          catVal,
          isRecorrente,
          finalMesAnoFim
        );
      }
      await fetchData();
      setIsCompraModalOpen(false);
    } catch (error: any) {
      alert('Erro ao salvar compra: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelarAssinatura = async (compra: CompraParcelada) => {
    const confirmMsg = `Deseja cancelar a assinatura "${compra.nome_compra}" a partir de ${formatMesAnoAbreviado(mesAno)}?\n\nEla deixará de ser cobrada na fatura deste mês em diante. Nos meses anteriores ela permanecerá intacta no histórico.`;
    if (!confirm(confirmMsg)) return;

    try {
      await parcelasService.cancelarAssinatura(compra.id, mesAno);
      await fetchData();
    } catch (error: any) {
      alert('Erro ao cancelar assinatura: ' + (error.message || JSON.stringify(error)));
    }
  };

  const handleReativarAssinatura = async (compra: CompraParcelada) => {
    if (!confirm(`Deseja reativar a assinatura "${compra.nome_compra}"? Ela voltará a ser cobrada mensalmente nas faturas.`)) return;

    try {
      await parcelasService.reativarAssinatura(compra.id);
      await fetchData();
    } catch (error: any) {
      alert('Erro ao reativar assinatura: ' + (error.message || JSON.stringify(error)));
    }
  };

  const handleDeleteCompra = async (id: string) => {
    if (!confirm('Excluir este item? Todo o histórico dele desaparecerá de todos os meses.')) return;
    try {
      await parcelasService.deleteParcela(id);
      await fetchData();
    } catch (error: any) {
      alert('Erro ao excluir: ' + (error.message || JSON.stringify(error)));
    }
  };

  // Manipuladores de Categorias
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaCategoriaNome.trim()) return;
    try {
      setIsCreatingCategory(true);
      await parcelasService.addCategoriaCartao(novaCategoriaNome.trim());
      setNovaCategoriaNome('');
      const cats = await parcelasService.fetchCategoriasCartao();
      setCategorias(cats);
    } catch (error: any) {
      alert('Erro ao criar categoria: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Excluir esta categoria? As compras enquadradas nela ficarão sem categoria.')) return;
    try {
      await parcelasService.deleteCategoriaCartao(id);
      const cats = await parcelasService.fetchCategoriasCartao();
      setCategorias(cats);
      await fetchData();
    } catch (error: any) {
      alert('Erro ao excluir categoria: ' + (error.message || JSON.stringify(error)));
    }
  };

  // Fatura Mês Anterior Actions
  const handleReabrirFatura = async () => {
    if (!confirm('Deseja marcar esta fatura como aberta/não paga?')) return;
    try {
      setIsPayingFatura(true);
      await parcelasService.upsertPagamentoFatura(
        mesAnoAnterior,
        false,
        null,
        0
      );
      const pag = await parcelasService.fetchPagamentoFatura(mesAnoAnterior);
      setPagamentoFaturaAnterior(pag);
      const cData = await chartsService.getDashboardChartsData(currentMonth);
      setChartData(cData);
    } catch (error: any) {
      alert('Erro ao reabrir fatura: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsPayingFatura(false);
    }
  };

  // Lógica Cruzada do Formulário
  const onChangeValorTotal = (val: number) => {
    setValorTotal(val);
    if (numParcelas > 0) setValorParcela(val / numParcelas);
  };

  const onChangeNumParcelas = (val: number) => {
    setNumParcelas(val);
    if (val > 0 && valorTotal > 0) setValorParcela(valorTotal / val);
  };

  const onChangeValorParcela = (val: number) => {
    setValorParcela(val);
    if (numParcelas > 0) setValorTotal(val * numParcelas);
  };

  return (
    <div className="theme-parcelas">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="text-h1" style={{ marginBottom: 0 }}>Cartão de Crédito</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" onClick={handleOpenConfig} icon={<Settings size={16} />}>Limite Mensal</Button>
          <Button onClick={handleOpenNewCompra} icon={<Plus size={16} />}>Nova Compra</Button>
        </div>
      </div>

      {/* Alerta de Fatura Atrasada */}
      {isAtrasada() && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          color: '#b91c1c',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontWeight: 'bold',
          fontSize: '0.95rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          ⚠️ Fatura do Mês Anterior Atrasada!
        </div>
      )}

      {/* Card Fatura do Mês Anterior */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div>
            <h3 className="text-h3" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Fatura Fechada do Mês Anterior ({formatMesAnoAbreviado(mesAnoAnterior)})
            </h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.25rem' }}>
              <span className="text-h2" style={{ margin: 0, fontWeight: 600 }}>
                {formatBRL(valorFaturaAnterior)}
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: pagamentoFaturaAnterior?.pago ? '#d1fae5' : '#fef3c7',
                color: pagamentoFaturaAnterior?.pago ? '#065f46' : '#92400e'
              }}>
                {pagamentoFaturaAnterior?.pago ? 'Paga' : 'Aberta'}
              </span>
            </div>
          </div>

          {valorFaturaAnterior > 0 && (
            <div>
              {pagamentoFaturaAnterior?.pago ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {pagamentoFaturaAnterior.data_pagamento_real ? (
                      <>Paga em: <strong>{pagamentoFaturaAnterior.data_pagamento_real.split('-').reverse().join('/')}</strong></>
                    ) : (
                      <>Paga no dia <strong>{pagamentoFaturaAnterior.dia_pagamento_real}</strong></>
                    )}
                  </span>
                  <Button variant="outline" onClick={handleReabrirFatura} disabled={isPayingFatura}>
                    Reabrir Fatura
                  </Button>
                </div>
              ) : (
                <Button onClick={() => {
                  setDataPagamentoRealInput(getInitialPaymentDate());
                  setIsCCPaymentModalOpen(true);
                }} disabled={isPayingFatura}>
                  Pagar Fatura
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Resumo do Mês */}
      <Card className={`summary-card-parcelas mb-4 ${totalExecutado > totalProjetado ? 'is-overbudget' : ''}`} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
          <div>
            <h3 className="text-h3" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Resumo do Mês</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span className="text-h2" style={{ margin: 0, color: getStatusColorGlobally() }}>
                {formatBRL(totalExecutado)}
              </span>
              <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                / Projetado: {formatBRL(totalProjetado)}
              </span>
            </div>
          </div>
        </div>
        <ProgressBar previsto={totalProjetado} realizado={totalExecutado} />

        {/* Divisão por Categoria */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', letterSpacing: '0.05em', fontWeight: 700 }}>
            Divisão por Categoria nesta Fatura
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {categorias.map(cat => {
              const totalCategoria = parcelasAtivas
                .filter(p => p.id_categoria === cat.id)
                .reduce((sum, p) => sum + p.valor_parcela, 0);
              
              return (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.25)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.15)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{cat.nome}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>{formatBRL(totalCategoria)}</span>
                </div>
              );
            })}
            
            {/* Sem Categoria se > 0 */}
            {(() => {
              const totalSemCat = parcelasAtivas
                .filter(p => !p.id_categoria)
                .reduce((sum, p) => sum + p.valor_parcela, 0);
              
              if (totalSemCat <= 0) return null;
              
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.25)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px dashed rgba(255, 255, 255, 0.2)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic' }}>Sem Categoria</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)' }}>{formatBRL(totalSemCat)}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </Card>

      {/* Gráfico de Parcelas */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div>
          <h3 className="text-h3" style={{ margin: 0, fontSize: '1.1rem' }}>Fatura vs Limite</h3>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-verde-entradas)' }}></div>
            <span>Fatura (no limite)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-vermelho-fixos)' }}></div>
            <span>Fatura (acima do limite)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--md-sys-color-primary)' }}></div>
            <span>Limite Teto</span>
          </div>
        </div>
        <div className="scrollable-chart-outer" style={{ width: '100%', height: 220, marginTop: '0.5rem', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`.scrollable-chart-outer::-webkit-scrollbar { display: none; }`}</style>
          <div style={{ minWidth: `max(100%, ${chartData.length * 70}px)`, height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="mesAnoFormatado" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={val => `R$ ${val}`} />
              <Tooltip content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  return (
                    <div style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-lg)'
                    }}>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-color)', marginBottom: '0.25rem' }}>
                        {payload[0].payload.mesAnoFormatado}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <p style={{ margin: 0, color: payload[0].value > payload[1]?.value ? 'var(--color-vermelho-fixos)' : 'var(--color-verde-entradas)', fontSize: '0.875rem' }}>
                          Fatura: <strong>{formatBRL(payload[0].value)}</strong>
                        </p>
                        {payload[1] && (
                          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                            Limite Teto: <strong>{formatBRL(payload[1].value)}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }} />
              <Bar name="Fatura" dataKey="parcelasExecutado" radius={[4, 4, 0, 0]} maxBarSize={30}>
                {
                  chartData.map((entry, index) => {
                    const fill = entry.parcelasExecutado > entry.parcelasProjetado ? 'var(--color-vermelho-fixos)' : 'var(--color-verde-entradas)';
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })
                }
              </Bar>
              <Bar name="Limite Teto" dataKey="parcelasProjetado" fill="var(--md-sys-color-primary)" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" />
            <span style={{ marginLeft: '0.5rem' }}>Carregando...</span>
          </div>
        ) : parcelasAtivas.length === 0 ? (
          <p className="text-muted" style={{ margin: 0, padding: '1rem' }}>Nenhuma compra ou assinatura ativa para este mês.</p>
        ) : (
          <div className="cc-table">
            <div className="cc-row-header">
              <div>Dia</div>
              <div>Descrição da Compra</div>
              <div>Categoria</div>
              <div style={{ textAlign: 'right' }}>Parcela / Tipo</div>
              <div style={{ textAlign: 'right' }}>Valor</div>
              <div style={{ textAlign: 'center' }}></div>
            </div>
            
            {parcelasAtivas.map(compra => {
              const cat = categorias.find(c => c.id === compra.id_categoria);
              return (
                <div key={compra.id} className="cc-row">
                  {/* Dia */}
                  <div className="cc-col-dia">
                    Dia {Number(compra.data_compra.split('-')[2])}
                  </div>
                  
                  {/* Descrição da Compra (Nome e descrição) */}
                  <div className="cc-col-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="cc-compra-nome">{compra.nome_compra}</span>
                      {compra.is_recorrente && (
                        <span className="badge-recorrente" title="Assinatura recorrente mensal">
                          <Repeat size={10} /> Recorrente
                        </span>
                      )}
                    </div>
                    <span className="cc-compra-desc">{compra.descricao || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Sem descrição</span>}</span>
                  </div>

                  {/* Categoria */}
                  <div className="cc-col-categoria">
                    {cat ? (
                      <span className="badge-categoria">
                        {cat.nome}
                      </span>
                    ) : (
                      <span className="badge-categoria" style={{ opacity: 0.5, borderStyle: 'dashed', backgroundColor: 'transparent', color: 'var(--text-muted)' }}>
                        Sem Categoria
                      </span>
                    )}
                  </div>

                  {/* Parcela Atual ou Indicador de Assinatura */}
                  <div className="cc-col-parcela-atual">
                    {compra.is_recorrente ? (
                      <span className="badge-recorrente" style={{ marginLeft: 'auto' }}>
                        <Repeat size={11} /> Mensal
                      </span>
                    ) : (
                      <span>{compra.numero_parcela_atual} / {compra.num_parcelas}</span>
                    )}
                  </div>

                  {/* Valor da Parcela / Total */}
                  <div className="cc-col-valor">
                    <div className="cc-col-valor-row">
                      <span className="cc-label-mobile">{compra.is_recorrente ? 'Mensalidade' : 'Valor da Parcela'}</span>
                      <span className="cc-valor-parcela">
                        {formatBRL(compra.num_parcelas === 1 ? compra.valor_total : compra.valor_parcela)}
                      </span>
                    </div>
                    <div className="cc-col-valor-row total-row">
                      <span className="cc-label-mobile">Total</span>
                      <span className="cc-valor-total">
                        {compra.is_recorrente ? (
                          <span style={{ color: '#6366f1', fontWeight: 600 }}>Assinatura</span>
                        ) : (
                          <>
                            <span className="cc-total-desktop-prefix">Total: </span>
                            {formatBRL(compra.valor_total)}
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="cc-col-actions">
                    {compra.is_recorrente && (
                      <button 
                        onClick={() => handleCancelarAssinatura(compra)} 
                        style={{ padding: '0.25rem', color: 'var(--text-muted)', transition: 'color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title={`Cancelar assinatura a partir de ${formatMesAnoAbreviado(mesAno)}`}
                      >
                        <Ban size={16} />
                      </button>
                    )}
                    <button 
                      onClick={() => handleOpenEditCompra(compra)} 
                      style={{ padding: '0.25rem', color: 'var(--text-muted)', transition: 'color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCompra(compra.id)} 
                      style={{ padding: '0.25rem', color: 'var(--text-muted)', transition: 'color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Excluir Definitivamente"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Seção de Assinaturas Canceladas / Inativas para o mês selecionado */}
        {assinaturasCanceladas.length > 0 && (
          <div className="cancelled-subs-section">
            <h4 style={{ fontSize: '0.825rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Ban size={14} style={{ color: 'var(--text-muted)' }} /> Assinaturas Canceladas ({assinaturasCanceladas.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {assinaturasCanceladas.map(sub => {
                const mesCancelamento = (() => {
                  const [y, m] = (sub.mes_ano_fim || '').split('-').map(Number);
                  const d = new Date(y, m, 1);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                })();

                return (
                  <div key={sub.id} className="cancelled-sub-item">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        {sub.nome_compra}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatBRL(sub.valor_parcela)}/mês • Cancelada a partir de {formatMesAnoAbreviado(mesCancelamento)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Button variant="outline" onClick={() => handleReativarAssinatura(sub)} icon={<RotateCcw size={14} />}>
                        Reativar
                      </Button>
                      <button 
                        onClick={() => handleDeleteCompra(sub.id)} 
                        style={{ padding: '0.25rem', color: 'var(--text-muted)', transition: 'color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Excluir Definitivamente"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Modal: Configuração Limite */}
      <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title="Configurar Limite">
        <form onSubmit={handleSaveConfig}>
          <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Defina qual é o teto máximo que você aceita comprometer por mês com faturas parceladas.
          </div>
          <CurrencyInput 
            label="Limite Mensal (Projetado)"
            value={tempLimite}
            onChange={setTempLimite}
            required
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsConfigModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Nova/Editar Compra */}
      <Modal isOpen={isCompraModalOpen} onClose={() => setIsCompraModalOpen(false)} title={compraToEdit ? (isRecorrente ? "Editar Assinatura" : "Editar Compra") : (isRecorrente ? "Nova Assinatura Recorrente" : "Nova Compra no Cartão")}>
        <form onSubmit={handleSaveCompra}>
          {/* Seletor de Tipo */}
          <div className="type-toggle-group">
            <button 
              type="button" 
              className={`type-toggle-btn ${!isRecorrente ? 'active' : ''}`}
              onClick={() => {
                setIsRecorrente(false);
                if (valorParcela > 0 && valorTotal === 0) {
                  setValorTotal(valorParcela * numParcelas);
                }
              }}
            >
              <CreditCard size={16} />
              Parcelada / À Vista
            </button>
            <button 
              type="button" 
              className={`type-toggle-btn ${isRecorrente ? 'active' : ''}`}
              onClick={() => {
                setIsRecorrente(true);
                if (valorTotal > 0 && valorParcela === 0) {
                  setValorParcela(valorTotal);
                } else if (valorParcela > 0) {
                  setValorTotal(valorParcela);
                }
                setNumParcelas(1);
              }}
            >
              <Repeat size={16} />
              Assinatura Recorrente
            </button>
          </div>

          <div className="input-group">
            <label>{isRecorrente ? 'Nome da Assinatura' : 'Nome da Compra'}</label>
            <input 
              type="text" 
              className="input" 
              placeholder={isRecorrente ? "Ex: Netflix, Spotify, Academia, ChatGPT" : "Ex: Celular Novo"} 
              value={nomeCompra}
              onChange={e => setNomeCompra(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Descrição</label>
            <input 
              type="text" 
              className="input" 
              placeholder="Ex: Plano Familiar, Assinatura Anual dividida, etc." 
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>
          
          {isRecorrente ? (
            /* Campos específicos para Assinatura Recorrente */
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <CurrencyInput 
                  label="Valor Mensal da Assinatura"
                  value={valorParcela}
                  onChange={(val) => {
                    setValorParcela(val);
                    setValorTotal(val);
                  }}
                  required
                />

                <div className="input-group">
                  <label>Mês de Início</label>
                  <input 
                    type="month" 
                    className="input" 
                    value={mesAnoInicio}
                    onChange={e => setMesAnoInicio(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="recorrente-info-box">
                🔄 <strong>Débito Recorrente Contínuo:</strong> Esta assinatura será incluída mensalmente em todas as faturas a partir do mês de início com prazo indeterminado, até que você cancele.
              </div>

              {mesAnoFim && (
                <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⚠️ Cancelada a partir do mês seguinte a <strong>{formatMesAnoAbreviado(mesAnoFim)}</strong></span>
                  <button 
                    type="button" 
                    onClick={() => setMesAnoFim(null)} 
                    style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                  >
                    Reativar Agora
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Campos específicos para Compra Parcelada / À Vista */
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <CurrencyInput 
                  label="Valor Total da Compra"
                  value={valorTotal}
                  onChange={onChangeValorTotal}
                  required
                />
                
                <div className="input-group">
                  <label>Número de Parcelas</label>
                  <input 
                    type="number" 
                    className="input" 
                    min="1"
                    step="1"
                    value={numParcelas}
                    onChange={e => onChangeNumParcelas(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <CurrencyInput 
                  label="Valor de cada Parcela"
                  value={valorParcela}
                  onChange={onChangeValorParcela}
                  required
                />

                <div className="input-group">
                  <label>Mês de Início</label>
                  <input 
                    type="month" 
                    className="input" 
                    value={mesAnoInicio}
                    onChange={e => setMesAnoInicio(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="input-group">
              <label>{isRecorrente ? 'Data / Dia da Cobrança' : 'Data da Compra'}</label>
              <input 
                type="date" 
                className="input" 
                value={dataCompra}
                onChange={e => setDataCompra(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Categoria</span>
                <button 
                  type="button" 
                  onClick={() => setIsManageCategoriesOpen(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                >
                  Gerenciar
                </button>
              </label>
              <select 
                className="input"
                value={idCategoria || ''}
                onChange={e => setIdCategoria(e.target.value || null)}
                style={{ appearance: 'auto', cursor: 'pointer' }}
              >
                <option value="">Sem Categoria</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {!isRecorrente && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Dica: Altere qualquer um dos valores (Total, Qtd Parcelas ou Valor Parcela) e os outros se ajustarão automaticamente.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsCompraModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              {compraToEdit ? 'Salvar Alterações' : (isRecorrente ? 'Cadastrar Assinatura' : 'Salvar Compra')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Pagamento de Fatura do Cartão */}
      <Modal isOpen={isCCPaymentModalOpen} onClose={() => setIsCCPaymentModalOpen(false)} title="Confirmar Pagamento de Fatura">
        <div>
          <p style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
            Informe a data em que o pagamento da fatura de <strong>{formatBRL(valorFaturaAnterior)}</strong> ({formatMesAnoAbreviado(mesAnoAnterior)}) foi ou será efetuado:
          </p>
          
          <div className="input-group">
            <label>Data do Pagamento</label>
            <input 
              type="date" 
              className="input" 
              value={dataPagamentoRealInput} 
              onChange={e => setDataPagamentoRealInput(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsCCPaymentModalOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!dataPagamentoRealInput) return;
              try {
                setIsPayingFatura(true);
                const diaReal = Number(dataPagamentoRealInput.split('-')[2]);
                await parcelasService.upsertPagamentoFatura(
                  mesAnoAnterior,
                  true,
                  diaReal,
                  valorFaturaAnterior,
                  dataPagamentoRealInput
                );
                const pag = await parcelasService.fetchPagamentoFatura(mesAnoAnterior);
                setPagamentoFaturaAnterior(pag);
                const cData = await chartsService.getDashboardChartsData(currentMonth);
                setChartData(cData);
                setIsCCPaymentModalOpen(false);
                alert('Pagamento registrado com sucesso!');
              } catch (error: any) {
                alert('Erro ao pagar fatura: ' + (error.message || JSON.stringify(error)));
              } finally {
                setIsPayingFatura(false);
              }
            }} disabled={isPayingFatura || !dataPagamentoRealInput}>
              {isPayingFatura ? <Loader2 className="animate-spin" size={14} style={{ marginRight: '0.25rem' }} /> : null}
              Confirmar Pagamento
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Gerenciar Categorias */}
      <Modal isOpen={isManageCategoriesOpen} onClose={() => setIsManageCategoriesOpen(false)} title="Categorias do Cartão">
        <div>
          <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem' }}>
            {categorias.length === 0 ? (
              <p className="text-muted" style={{ margin: 0, padding: '1rem', textAlign: 'center' }}>Nenhuma categoria cadastrada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {categorias.map(cat => (
                  <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{cat.nome}</span>
                    <button 
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                      title="Excluir Categoria"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Nova Categoria" 
              value={novaCategoriaNome}
              onChange={e => setNovaCategoriaNome(e.target.value)}
              required
              disabled={isCreatingCategory}
            />
            <Button type="submit" disabled={isCreatingCategory || !novaCategoriaNome.trim()}>
              Adicionar
            </Button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="outline" onClick={() => setIsManageCategoriesOpen(false)}>Fechar</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
