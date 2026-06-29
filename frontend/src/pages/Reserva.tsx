import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Plus, Check, Loader2, Edit2, Trash2, PiggyBank, ArrowLeftRight } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { reservaService } from '../services/reserva';
import type { MovimentacaoReservaMensal } from '../types/database.types';
import './Reserva.css';

export function Reserva() {
  const { currentMonth } = useMonth();
  const year = currentMonth.getFullYear();
  const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${month}`;

  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoReservaMensal[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState(0);
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [projetar, setProjetar] = useState(false);
  const [dataMovimentacao, setDataMovimentacao] = useState(`${mesAno}-01`);
  const [diaMovimentacaoPrevisto, setDiaMovimentacaoPrevisto] = useState(10);
  const [mesAnoFim, setMesAnoFim] = useState('');
  const [afetaContaGeral, setAfetaContaGeral] = useState(true);
  const [gerarSaldoDevedor, setGerarSaldoDevedor] = useState(false);
  const [quitarSaldoDevedor, setQuitarSaldoDevedor] = useState(false);

  // Inline Realization State (para movimentações recorrentes)
  const [realizandoId, setRealizandoId] = useState<string | null>(null);
  const [valorRealInput, setValorRealInput] = useState<number>(0);
  const [diaRealInput, setDiaRealInput] = useState<number>(10);

  // Extrato filter state
  const [filtroSaldoDevedor, setFiltroSaldoDevedor] = useState(false);

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [movs, hist] = await Promise.all([
        reservaService.fetchMovimentacoesMensais(mesAno),
        reservaService.fetchHistoricoReserva()
      ]);
      setMovimentacoes(movs);
      setHistorico(hist);
    } catch (error) {
      console.error('Erro ao carregar dados da Reserva:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mesAno]);

  // Lógica de cálculo de saldos baseada no histórico histórico real de transações efetuadas
  let saldoReserva = 0;
  let saldoDevedorAcumulado = 0;
  const transacoesZeradoras = new Set<string>();

  // Processa o histórico cronológico de transações de fato ocorridas
  historico.forEach(mov => {
    // 1. Calcular Saldo da Reserva
    if (mov.tipo === 'entrada') {
      saldoReserva += mov.valor;
    } else {
      saldoReserva -= mov.valor;
    }

    // 2. Calcular Saldo Devedor e identificar transação que zerou
    if (mov.tipo === 'saida' && mov.gerar_saldo_devedor) {
      saldoDevedorAcumulado += mov.valor;
    } else if (mov.tipo === 'entrada' && mov.quitar_saldo_devedor) {
      if (saldoDevedorAcumulado > 0) {
        const novoSaldo = Math.max(0, saldoDevedorAcumulado - mov.valor);
        if (novoSaldo === 0) {
          transacoesZeradoras.add(mov.id); // Esta transação quitou / zerou o saldo devedor
        }
        saldoDevedorAcumulado = novoSaldo;
      }
    }
  });

  const handleOpenAddModal = () => {
    setIdEdicao(null);
    setDescricao('');
    setValor(0);
    setTipo('entrada');
    setProjetar(false);
    setDataMovimentacao(`${mesAno}-01`);
    setDiaMovimentacaoPrevisto(10);
    setMesAnoFim('');
    setAfetaContaGeral(true);
    setGerarSaldoDevedor(false);
    setQuitarSaldoDevedor(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mov: MovimentacaoReservaMensal) => {
    setIdEdicao(mov.id);
    setDescricao(mov.descricao);
    setValor(mov.valor_previsto_base);
    setTipo(mov.tipo);
    setProjetar(mov.projetar);
    setDataMovimentacao(mov.data_movimentacao);
    setDiaMovimentacaoPrevisto(mov.dia_movimentacao_previsto);
    setMesAnoFim(mov.mes_ano_fim || '');
    setAfetaContaGeral(mov.afeta_conta_geral);
    setGerarSaldoDevedor(mov.gerar_saldo_devedor);
    setQuitarSaldoDevedor(mov.quitar_saldo_devedor);
    setIsModalOpen(true);
  };

  const handleSaveMovimentacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || valor <= 0 || !dataMovimentacao) return;

    try {
      setIsSubmitting(true);
      const payload = {
        descricao,
        valor_previsto_base: valor,
        tipo,
        projetar,
        data_movimentacao: dataMovimentacao,
        dia_movimentacao_previsto: diaMovimentacaoPrevisto,
        mes_ano_fim: projetar && mesAnoFim ? mesAnoFim : null,
        afeta_conta_geral: afetaContaGeral,
        gerar_saldo_devedor: tipo === 'saida' ? gerarSaldoDevedor : false,
        quitar_saldo_devedor: tipo === 'entrada' ? quitarSaldoDevedor : false,
        ativo: true
      };

      if (idEdicao) {
        await reservaService.updateMovimentacao(idEdicao, payload);
      } else {
        await reservaService.addMovimentacao(payload);
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (error: any) {
      alert('Erro ao salvar: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMovimentacao = async (id: string) => {
    if (!confirm('Deseja excluir esta movimentação? Todos os registros dela nos meses também serão apagados.')) return;
    try {
      await reservaService.deleteMovimentacao(id);
      await fetchData();
    } catch (error: any) {
      alert('Erro ao excluir: ' + (error.message || JSON.stringify(error)));
    }
  };

  // Abre interface inline para realizar/confirmar movimentação recorrente
  const handleStartRealize = (mov: MovimentacaoReservaMensal) => {
    setRealizandoId(mov.id);
    setValorRealInput(mov.registro_atual?.valor_real || mov.valor_previsto_base);
    setDiaRealInput(mov.registro_atual?.dia_movimentacao_real || mov.dia_movimentacao_previsto || new Date().getDate());
  };

  const handleSaveRealize = async (mov: MovimentacaoReservaMensal) => {
    if (valorRealInput <= 0) return;
    try {
      setIsLoading(true);
      await reservaService.upsertRegistroMovimentacao(
        mov.id,
        mesAno,
        valorRealInput,
        diaRealInput,
        {
          afeta_conta_geral: mov.afeta_conta_geral,
          gerar_saldo_devedor: mov.gerar_saldo_devedor,
          quitar_saldo_devedor: mov.quitar_saldo_devedor
        }
      );
      setRealizandoId(null);
      await fetchData();
    } catch (error: any) {
      alert('Erro ao confirmar movimentação: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsLoading(false);
    }
  };

  // Montar itens a exibir no extrato do mês atual
  const movimentosExibir = React.useMemo(() => {
    const list: any[] = [];

    movimentacoes.forEach(m => {
      if (!m.projetar) {
        // Pontual: é sempre real/efetivada na data correspondente
        const day = Number(m.data_movimentacao.split('-')[2]);
        const transId = `pontual-${m.id}`;
        list.push({
          id: transId,
          dia: day,
          data: m.data_movimentacao,
          descricao: m.descricao,
          tipo: m.tipo,
          valor: m.valor_previsto_base,
          status: 'realizado',
          afeta_conta_geral: m.afeta_conta_geral,
          gerar_saldo_devedor: m.gerar_saldo_devedor,
          quitar_saldo_devedor: m.quitar_saldo_devedor,
          isRecorrente: false,
          originalMov: m,
          zerouSaldoDevedor: transacoesZeradoras.has(transId)
        });
      } else {
        // Recorrente: confere se possui registro realizado
        const reg = m.registro_atual;
        const transId = reg ? `registro-${reg.id_registro}` : `projeto-${m.id}`;
        
        if (reg) {
          const day = reg.dia_movimentacao_real || m.dia_movimentacao_previsto;
          list.push({
            id: transId,
            dia: day,
            data: `${mesAno}-${String(day).padStart(2, '0')}`,
            descricao: `${m.descricao} (Confirmada)`,
            tipo: m.tipo,
            valor: reg.valor_real,
            status: 'realizado',
            afeta_conta_geral: reg.afeta_conta_geral,
            gerar_saldo_devedor: reg.gerar_saldo_devedor,
            quitar_saldo_devedor: reg.quitar_saldo_devedor,
            isRecorrente: true,
            originalMov: m,
            zerouSaldoDevedor: transacoesZeradoras.has(transId)
          });
        } else {
          list.push({
            id: transId,
            dia: m.dia_movimentacao_previsto,
            data: `${mesAno}-${String(m.dia_movimentacao_previsto).padStart(2, '0')}`,
            descricao: `${m.descricao} (Programada)`,
            tipo: m.tipo,
            valor: m.valor_previsto_base,
            status: 'programado',
            afeta_conta_geral: m.afeta_conta_geral,
            gerar_saldo_devedor: m.gerar_saldo_devedor,
            quitar_saldo_devedor: m.quitar_saldo_devedor,
            isRecorrente: true,
            originalMov: m,
            zerouSaldoDevedor: false
          });
        }
      }
    });

    // Ordenar cronologicamente por dia
    list.sort((a, b) => a.dia - b.dia);

    // Filtrar se filtro ativo
    if (filtroSaldoDevedor) {
      return list.filter(m => m.gerar_saldo_devedor || m.quitar_saldo_devedor);
    }

    return list;
  }, [movimentacoes, filtroSaldoDevedor, transacoesZeradoras, mesAno]);

  return (
    <div className="reserva-container theme-reserva" style={{ padding: '0.25rem 0' }}>
      {/* Resumo de saldos no topo */}
      <div className="reserva-header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="text-h1" style={{ marginBottom: 0 }}>Reserva Financeira</h1>
        <Button onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Nova Movimentação
        </Button>
      </div>

      <div className="reserva-summary-grid">
        <Card className="summary-card total-reserva">
          <div className="card-icon"><PiggyBank size={24} color="#10b981" /></div>
          <div className="card-info">
            <span className="card-title">Saldo na Reserva</span>
            <span className="card-value value-positive">{formatBRL(saldoReserva)}</span>
          </div>
        </Card>

        <Card className="summary-card saldo-devedor">
          <div className="card-icon"><ArrowLeftRight size={24} color={saldoDevedorAcumulado > 0 ? '#ef4444' : 'var(--text-color-muted)'} /></div>
          <div className="card-info">
            <span className="card-title">Valores a Repor</span>
            <span className={`card-value ${saldoDevedorAcumulado > 0 ? 'value-negative' : 'value-zero'}`}>
              {formatBRL(saldoDevedorAcumulado)}
            </span>
          </div>
        </Card>
      </div>

      <div>
        {/* Extrato / Movimentações */}
        <Card style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 className="text-h2" style={{ margin: 0 }}>Movimentações do Mês</h2>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={filtroSaldoDevedor}
                onChange={(e) => setFiltroSaldoDevedor(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Ver apenas Valores a Repor
            </label>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" />
              <span style={{ marginLeft: '0.5rem', fontWeight: 500 }}>Carregando dados...</span>
            </div>
          ) : movimentosExibir.length === 0 ? (
            <p className="text-muted" style={{ margin: 0, padding: '1rem 0' }}>Nenhuma movimentação para o filtro selecionado neste mês.</p>
          ) : (
            <div className="reserva-extrato-list">
              {movimentosExibir.map((item) => {
                const isReal = item.status === 'realizado';
                const isEntrada = item.tipo === 'entrada';
                const isEditingInline = realizandoId === item.originalMov.id;

                return (
                  <div key={item.id} className={`reserva-item ${item.tipo} ${item.status}`}>
                    <div className="reserva-item-header">
                      <div className="reserva-item-meta">
                        <span className="reserva-item-day">Dia {String(item.dia).padStart(2, '0')}</span>
                        <span className={`badge-tipo ${item.tipo}`}>
                          {isEntrada ? 'DEPÓSITO' : 'RETIRADA'}
                        </span>
                        {item.afeta_conta_geral && (
                          <span className="badge-geral">CONTA GERAL</span>
                        )}
                        {item.gerar_saldo_devedor && (
                          <span className="badge-devedor-gerar">A REPOR</span>
                        )}
                        {item.quitar_saldo_devedor && (
                          <span className="badge-devedor-quitar">QUITAÇÃO</span>
                        )}
                      </div>
                      <div className="reserva-item-actions">
                        <button onClick={() => handleOpenEditModal(item.originalMov)} className="btn-icon" title="Editar"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteMovimentacao(item.originalMov.id)} className="btn-icon text-danger" title="Excluir"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    <div className="reserva-item-body">
                      <div className="reserva-item-main">
                        <span className="reserva-item-desc">{item.descricao}</span>
                        {item.zerouSaldoDevedor && (
                          <span className="badge-success-zero animate-pulse" style={{ marginLeft: '0.5rem' }}>
                            🎉 Valores a Repor Zerados!
                          </span>
                        )}
                      </div>

                      <div className="reserva-item-value-section">
                        {isEditingInline ? (
                          <div className="realize-inline-form">
                            <div style={{ maxWidth: '120px' }}>
                              <CurrencyInput
                                value={valorRealInput}
                                onChange={(v) => setValorRealInput(v)}
                              />
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={diaRealInput}
                              onChange={(e) => setDiaRealInput(Number(e.target.value))}
                              style={{ width: '50px', padding: '0.25rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                              title="Dia Realizado"
                            />
                            <button onClick={() => handleSaveRealize(item.originalMov)} className="btn-confirm" title="Salvar Realizado"><Check size={14} /></button>
                            <button onClick={() => setRealizandoId(null)} className="btn-cancel-inline">Cancelar</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span className={`reserva-value ${isEntrada ? 'text-positive' : 'text-negative'}`}>
                              {isEntrada ? '+' : '-'} {formatBRL(item.valor)}
                            </span>
                            {!isReal && item.isRecorrente && (
                              <button
                                onClick={() => handleStartRealize(item.originalMov)}
                                className="btn-realize-trigger"
                              >
                                Confirmar
                              </button>
                            )}
                            {isReal && item.isRecorrente && (
                              <span className="realized-badge">REALIZADA</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Modal de Cadastro/Edição */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={idEdicao ? 'Editar Movimentação' : 'Nova Movimentação na Reserva'}
      >
        <form onSubmit={handleSaveMovimentacao} className="reserva-form">
          <div className="form-group">
            <label>Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Depósito Mensal, Saída para Emergência"
              required
            />
          </div>

          <div className="form-group">
            <label>Valor</label>
            <CurrencyInput
              value={valor}
              onChange={(v) => setValor(v)}
            />
          </div>

          <div className="form-row-grid">
            <div className="form-group">
              <label>Tipo</label>
              <select value={tipo} onChange={(e) => {
                const val = e.target.value as 'entrada' | 'saida';
                setTipo(val);
                if (val === 'entrada') {
                  setGerarSaldoDevedor(false);
                } else {
                  setQuitarSaldoDevedor(false);
                }
              }}>
                <option value="entrada">Depósito</option>
                <option value="saida">Retirada</option>
              </select>
            </div>

            <div className="form-group">
              <label>Recorrente?</label>
              <select value={projetar ? 'true' : 'false'} onChange={(e) => setProjetar(e.target.value === 'true')}>
                <option value="false">Pontual</option>
                <option value="true">Recorrente</option>
              </select>
            </div>
          </div>

          {!projetar ? (
            <div className="form-group">
              <label>Data do Lançamento</label>
              <input
                type="date"
                value={dataMovimentacao}
                onChange={(e) => setDataMovimentacao(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="form-row-grid">
              <div className="form-group">
                <label>Data de Início</label>
                <input
                  type="date"
                  value={dataMovimentacao}
                  onChange={(e) => setDataMovimentacao(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Dia Previsto (1-31)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={diaMovimentacaoPrevisto}
                  onChange={(e) => setDiaMovimentacaoPrevisto(Number(e.target.value))}
                  required
                />
              </div>
            </div>
          )}

          {projetar && (
            <div className="form-group">
              <label>Mês Final (Opcional - YYYY-MM)</label>
              <input
                type="month"
                value={mesAnoFim}
                onChange={(e) => setMesAnoFim(e.target.value)}
                placeholder="Ex: 2026-12"
              />
            </div>
          )}

          <div className="form-checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={afetaContaGeral}
                onChange={(e) => setAfetaContaGeral(e.target.checked)}
              />
              <span>Movimentar com a Conta Geral</span>
            </label>

            {tipo === 'saida' && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={gerarSaldoDevedor}
                  onChange={(e) => setGerarSaldoDevedor(e.target.checked)}
                />
                <span>Adicionar a Valores a Repor</span>
              </label>
            )}

            {tipo === 'entrada' && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={quitarSaldoDevedor}
                  onChange={(e) => setQuitarSaldoDevedor(e.target.checked)}
                />
                <span>Destinar para Quitar Valores a Repor</span>
              </label>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || valor <= 0 || !descricao}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
