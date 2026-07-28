import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Loader2, ArrowUpRight, Wallet, CreditCard, Calendar, PiggyBank, TrendingUp } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { supabase } from '../lib/supabase';


interface Movimento {
  id: string;
  dia: number;
  descricao: string;
  tipo: 'inflow' | 'outflow';
  origem: 'entrada' | 'fixo' | 'diario' | 'fatura' | 'reserva' | 'salario';
  status: 'realizado' | 'pago' | 'provisionado' | 'atrasado';
  valor: number;
  saldoPosMovimento?: number;
  createdAt: string;
}

export function Extrato() {
  const { currentMonth } = useMonth();
  const year = currentMonth.getFullYear();
  const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${monthStr}`;
  const daysInMonth = new Date(year, currentMonth.getMonth() + 1, 0).getDate();

  const [isLoading, setIsLoading] = useState(true);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getMesAnoAnterior = (mStr: string): string => {
    const [y, m] = mStr.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    return `${newY}-${newM}`;
  };

  const getParcelaAtual = (mesAnoInicio: string, mesAnoAtual: string, numParcelas: number): number | null => {
    const [startY, startM] = mesAnoInicio.split('-').map(Number);
    const [currY, currM] = mesAnoAtual.split('-').map(Number);
    const diff = (currY - startY) * 12 + (currM - startM);
    if (diff >= 0 && diff < numParcelas) return diff + 1;
    return null;
  };

  const addMonths = (mesAno: string, count: number): string => {
    const [y, m] = mesAno.split('-').map(Number);
    const date = new Date(y, m - 1 + count, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    return `${newY}-${newM}`;
  };

  const getSalarioForMonth = (dbSalarios: any[], mesAno: string) => {
    const exact = dbSalarios.find(s => s.mes_ano === mesAno);
    if (exact) return exact;

    const inherited = [...dbSalarios]
      .filter(s => s.mes_ano <= mesAno)
      .sort((a, b) => b.mes_ano.localeCompare(a.mes_ano))[0];

    if (inherited) {
      return {
        ...inherited,
        mes_ano: mesAno,
        valor_real: null,
        data_real: null,
        id: ''
      };
    }
    return null;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // 1. Carregar todos os dados necessários do Supabase
      const [
        { data: dbEntradas },
        { data: dbRegEntradas },
        { data: dbGastosFixos },
        { data: dbRegGastosFixos },
        { data: dbCategoriasDiarias },
        { data: dbRegistrosDiarios },
        { data: dbComprasParceladas },
        { data: dbPagamentosFaturas },
        { data: dbMovsReserva },
        { data: dbRegsReserva },
        { data: dbSalarios }
      ] = await Promise.all([
        supabase.from('entradas').select('*'),
        supabase.from('registros_entradas').select('*'),
        supabase.from('gastos_fixos').select('*'),
        supabase.from('registros_gastos_fixos').select('*'),
        supabase.from('categorias_diarias').select('*'),
        supabase.from('registros_diarios').select('*'),
        supabase.from('compras_parceladas').select('*'),
        supabase.from('pagamentos_faturas').select('*'),
        supabase.from('movimentacoes_reserva').select('*'),
        supabase.from('registros_movimentacoes_reserva').select('*'),
        supabase.from('salario').select('*')
      ]);

      const entradas = dbEntradas || [];
      const regEntradas = dbRegEntradas || [];
      const gastosFixos = dbGastosFixos || [];
      const regGastosFixos = dbRegGastosFixos || [];
      const categoriasDiarias = dbCategoriasDiarias || [];
      const registrosDiarios = dbRegistrosDiarios || [];
      const comprasParceladas = dbComprasParceladas || [];
      const pagamentosFaturas = dbPagamentosFaturas || [];
      const dbMovsReservaList = dbMovsReserva || [];
      const dbRegsReservaList = dbRegsReserva || [];
      const salarios = dbSalarios || [];

      // 2. Determinar intervalo de meses passados
      let startYear = year - 1;
      let startMonth = 0;

      const allDates: string[] = [];
      entradas.forEach(e => allDates.push(e.data_entrada.substring(0, 7)));
      regEntradas.forEach(r => allDates.push(r.mes_ano));
      regGastosFixos.forEach(r => allDates.push(r.mes_ano));
      registrosDiarios.forEach(r => allDates.push(r.data.substring(0, 7)));
      comprasParceladas.forEach(p => allDates.push(p.mes_ano_inicio));
      pagamentosFaturas.forEach(f => allDates.push(f.mes_ano));
      dbMovsReservaList.forEach(m => allDates.push(m.data_movimentacao.substring(0, 7)));
      dbRegsReservaList.forEach(r => allDates.push(r.mes_ano));

      if (allDates.length > 0) {
        allDates.sort();
        const [minY, minM] = allDates[0].split('-').map(Number);
        if (minY < year || (minY === year && (minM - 1) < currentMonth.getMonth())) {
          startYear = minY;
          startMonth = minM - 1;
        }
      }

      const pastMonths: string[] = [];
      let tempDate = new Date(startYear, startMonth, 1);
      const limitDate = new Date(year, currentMonth.getMonth(), 1);

      while (tempDate < limitDate) {
        const y = tempDate.getFullYear();
        const mStr = String(tempDate.getMonth() + 1).padStart(2, '0');
        pastMonths.push(`${y}-${mStr}`);
        tempDate.setMonth(tempDate.getMonth() + 1);
      }

      // Build virtualSalarios for past, current and next months
      const minMonth = pastMonths.length > 0 ? pastMonths[0] : mesAno;
      const maxReferenceMonth = addMonths(mesAno, 2);

      const virtualSalarios: any[] = [];
      let tempM = minMonth;
      while (tempM <= maxReferenceMonth) {
        const sal = getSalarioForMonth(salarios || [], tempM);
        if (sal) {
          virtualSalarios.push(sal);
        }
        tempM = addMonths(tempM, 1);
      }

      // 3. Calcular saldo inicial acumulado retroativamente até M-1
      let saldoAcumulado = 0;

      for (const m of pastMonths) {
        // Receitas — entradas normais
        let inflowsM = 0;
        const pontuaisEmM = entradas.filter(e => !e.projetar && e.data_entrada.substring(0, 7) === m);
        pontuaisEmM.forEach(e => {
          inflowsM += Number(e.valor_previsto_base);
        });

        const recorrentesEmM = entradas.filter(e => {
          if (!e.projetar) return false;
          const startMonth = e.data_entrada.substring(0, 7);
          return startMonth <= m && (!e.mes_ano_fim || e.mes_ano_fim >= m);
        });

        recorrentesEmM.forEach(e => {
          const reg = regEntradas.find(r => r.id_entrada === e.id && r.mes_ano === m);
          if (reg && Number(reg.valor_real) > 0) {
            inflowsM += Number(reg.valor_real);
          } else if (e.ativo) {
            inflowsM += Number(e.valor_previsto_base);
          }
        });

        // Salário cujo recebimento físico ocorreu no mês m
        let salarioMTotal = 0;
        virtualSalarios.forEach(s => {
          let physicalMonth = '';
          if (s.data_real) {
            physicalMonth = s.data_real.substring(0, 7);
          } else {
            const desvio = s.desvio_mes_deposito ?? 0;
            physicalMonth = addMonths(s.mes_ano, desvio);
          }

          if (physicalMonth === m) {
            if (s.valor_real !== null && s.valor_real !== undefined) {
              salarioMTotal += Number(s.valor_real);
            } else if (s.valor_previsto > 0) {
              salarioMTotal += Number(s.valor_previsto);
            }
          }
        });
        inflowsM += salarioMTotal;

        // Despesas Fixas (caixa físico saído em m)
        let fixedM = 0;
        regGastosFixos.forEach(reg => {
          const parent = gastosFixos.find(f => f.id === reg.id_gasto_fixo);
          if (parent) {
            let pagouEmM = false;
            if (reg.data_pagamento_real) {
              pagouEmM = reg.data_pagamento_real.substring(0, 7) === m;
            } else if (reg.dia_pagamento_real) {
              pagouEmM = reg.mes_ano === m;
            }
            if (pagouEmM && Number(reg.valor_real) > 0) {
              fixedM += Number(reg.valor_real);
            }
          }
        });

        // Despesas Diárias
        const dailyM = registrosDiarios
          .filter(r => r.data.substring(0, 7) === m)
          .reduce((sum, r) => sum + Number(r.valor_gasto), 0);

        // Fatura Cartão M-1 paga em M
        const m1 = getMesAnoAnterior(m);
        const faturaM1 = comprasParceladas.filter(compra => {
          const p = getParcelaAtual(compra.mes_ano_inicio, m1, compra.num_parcelas);
          return p !== null;
        }).reduce((sum, p) => sum + Number(p.valor_parcela), 0);

        const pagoFaturaM1 = pagamentosFaturas.find(f => f.mes_ano === m1 && f.pago === true);
        const ccM = pagoFaturaM1 ? faturaM1 : 0;

        // Reserva
        let reservaInflowsM = 0;
        let reservaOutflowsM = 0;

        dbMovsReservaList
          .filter(mov => !mov.projetar && mov.data_movimentacao.substring(0, 7) === m && mov.afeta_conta_geral)
          .forEach(mov => {
            if (mov.tipo === 'saida') reservaInflowsM += Number(mov.valor_previsto_base);
            else reservaOutflowsM += Number(mov.valor_previsto_base);
          });

        dbRegsReservaList
          .filter(r => r.mes_ano === m && r.afeta_conta_geral)
          .forEach(r => {
            const parent = dbMovsReservaList.find(mov => mov.id === r.id_movimentacao);
            if (parent) {
              if (parent.tipo === 'saida') reservaInflowsM += Number(r.valor_real);
              else reservaOutflowsM += Number(r.valor_real);
            }
          });

        saldoAcumulado += (inflowsM + reservaInflowsM - fixedM - dailyM - ccM - reservaOutflowsM);
      }

      setSaldoInicial(saldoAcumulado);

      // 4. Mapear movimentos do mês selecionado (M)
      const listMovimentos: Movimento[] = [];

      // A. Entradas normais
      const pontuaisNoMes = entradas.filter(e => !e.projetar && e.data_entrada.substring(0, 7) === mesAno);
      const recorrentesNoMes = entradas.filter(e => {
        if (!e.projetar) return false;
        const startMonth = e.data_entrada.substring(0, 7);
        return startMonth <= mesAno && (!e.mes_ano_fim || e.mes_ano_fim >= mesAno);
      });

      pontuaisNoMes.forEach(e => {
        const entryDay = Number(e.data_entrada.split('-')[2]);
        listMovimentos.push({
          id: `inflow-${e.id}-unique`,
          dia: entryDay,
          descricao: e.descricao,
          tipo: 'inflow',
          origem: 'entrada',
          status: 'realizado',
          valor: Number(e.valor_previsto_base),
          createdAt: e.created_at
        });
      });

      recorrentesNoMes.forEach(e => {
        const entryDay = Number(e.data_entrada.split('-')[2]);
        const reg = regEntradas.find(r => r.id_entrada === e.id && r.mes_ano === mesAno);

        if (reg && Number(reg.valor_real) > 0) {
          listMovimentos.push({
            id: `inflow-${e.id}-real`,
            dia: entryDay,
            descricao: `${e.descricao} (Realizado)`,
            tipo: 'inflow',
            origem: 'entrada',
            status: 'realizado',
            valor: Number(reg.valor_real),
            createdAt: reg.created_at
          });
        }
      });

      // B. Salário — aparece no extrato no dia real ou previsto de recebimento
      virtualSalarios.forEach(s => {
        let physicalMonth = '';
        let physicalDay = 0;
        let isReal = false;

        if (s.data_real) {
          physicalMonth = s.data_real.substring(0, 7);
          physicalDay = Number(s.data_real.split('-')[2]);
          isReal = true;
        } else {
          const desvio = s.desvio_mes_deposito ?? 0;
          physicalMonth = addMonths(s.mes_ano, desvio);
          physicalDay = s.dia_previsto || 5;
        }

        if (physicalMonth === mesAno) {
          if (isReal) {
            listMovimentos.push({
              id: `salario-${s.mes_ano}-real`,
              dia: physicalDay,
              descricao: `Salário ${s.mes_ano.split('-').reverse().map((v: string, i: number) => i === 0 ? v : v.padStart(2, '0')).join('/')} (Recebido)`,
              tipo: 'inflow',
              origem: 'salario',
              status: 'realizado',
              valor: Number(s.valor_real),
              createdAt: s.created_at
            });
          } else {
            listMovimentos.push({
              id: `salario-${s.mes_ano}-previsto`,
              dia: physicalDay,
              descricao: `Salário ${s.mes_ano.split('-').reverse().map((v: string, i: number) => i === 0 ? v : v.padStart(2, '0')).join('/')} (Previsão)`,
              tipo: 'inflow',
              origem: 'salario',
              status: 'provisionado',
              valor: Number(s.valor_previsto),
              createdAt: s.created_at || new Date().toISOString()
            });
          }
        }
      });

      // C. Gastos Fixos — pagos fisicamente neste mês
      regGastosFixos.forEach(reg => {
        const parent = gastosFixos.find(f => f.id === reg.id_gasto_fixo);
        if (parent && reg.valor_real > 0) {
          let pagouNoMes = false;
          let diaPago = reg.dia_pagamento_real || parent.dia_pagamento_previsto;

          if (reg.data_pagamento_real) {
            pagouNoMes = reg.data_pagamento_real.substring(0, 7) === mesAno;
            diaPago = Number(reg.data_pagamento_real.split('-')[2]);
          } else if (reg.dia_pagamento_real) {
            pagouNoMes = reg.mes_ano === mesAno;
          }

          if (pagouNoMes) {
            let desc = `${parent.nome} (Pago)`;
            if (reg.mes_ano !== mesAno) {
              const [ry, rm] = reg.mes_ano.split('-').map(Number);
              const mesesPt = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              desc = `${parent.nome} (Pago — Competência ${mesesPt[rm - 1]}/${String(ry).slice(-2)})`;
            }
            listMovimentos.push({
              id: `fixed-${parent.id}-real`,
              dia: diaPago,
              descricao: desc,
              tipo: 'outflow',
              origem: 'fixo',
              status: 'pago',
              valor: Number(reg.valor_real),
              createdAt: reg.created_at
            });
          }
        }
      });

      // D. Fatura Cartão de Crédito
      const mesAnoAnterior = getMesAnoAnterior(mesAno);
      const faturaAnterior = comprasParceladas.filter(compra => {
        const p = getParcelaAtual(compra.mes_ano_inicio, mesAnoAnterior, compra.num_parcelas);
        return p !== null;
      }).reduce((sum, p) => sum + Number(p.valor_parcela), 0);

      const pagoFaturaAnterior = pagamentosFaturas.find(f => f.mes_ano === mesAnoAnterior);
      const ccPaid = pagoFaturaAnterior ? pagoFaturaAnterior.pago : false;
      const ccDiaPagamentoReal = pagoFaturaAnterior ? pagoFaturaAnterior.dia_pagamento_real : null;

      if (faturaAnterior > 0 && ccPaid && ccDiaPagamentoReal !== null) {
        listMovimentos.push({
          id: `fatura-${mesAnoAnterior}-pago`,
          dia: ccDiaPagamentoReal,
          descricao: 'Fatura Cartão Mês Anterior (Paga)',
          tipo: 'outflow',
          origem: 'fatura',
          status: 'pago',
          valor: faturaAnterior,
          createdAt: pagoFaturaAnterior!.created_at
        });
      }

      // E. Gastos Diários
      const catsComLimite = categoriasDiarias.filter(c => Number(c.limite_mensal) > 0);

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${mesAno}-${String(d).padStart(2, '0')}`;
        const recordsForDay = registrosDiarios.filter(r => r.data === dayStr);

        recordsForDay
          .filter(r => r.id_categoria === null)
          .forEach(r => {
            if (Number(r.valor_gasto) > 0) {
              listMovimentos.push({
                id: `daily-pontual-${r.id_registro}`,
                dia: d,
                descricao: r.descricao ? r.descricao : 'Gasto Pontual',
                tipo: 'outflow',
                origem: 'diario',
                status: 'realizado',
                valor: Number(r.valor_gasto),
                createdAt: r.created_at
              });
            }
          });

        catsComLimite.forEach(cat => {
          const regsReal = recordsForDay.filter(r => r.id_categoria === cat.id);
          if (regsReal.length > 0) {
            regsReal.forEach(regReal => {
              const valorReal = Number(regReal.valor_gasto);
              if (valorReal > 0) {
                listMovimentos.push({
                  id: `daily-cat-${regReal.id_registro}`,
                  dia: d,
                  descricao: regReal.descricao && regReal.descricao !== 'Zerado'
                    ? `${regReal.descricao} (${cat.nome})`
                    : cat.nome,
                  tipo: 'outflow',
                  origem: 'diario',
                  status: 'realizado',
                  valor: valorReal,
                  createdAt: regReal.created_at
                });
              }
            });
          }
        });
      }

      // F. Movimentações da Reserva Financeira que afetam a Conta Geral
      const activeMovsReserva = dbMovsReservaList.filter(mov => {
        const startMonth = mov.data_movimentacao.substring(0, 7);
        if (!mov.projetar) {
          return startMonth === mesAno && mov.afeta_conta_geral;
        }
        if (startMonth > mesAno) return false;
        if (mov.mes_ano_fim && mesAno > mov.mes_ano_fim) return false;
        return mov.afeta_conta_geral;
      });

      activeMovsReserva.forEach(mov => {
        if (!mov.projetar) {
          const entryDay = Number(mov.data_movimentacao.split('-')[2]);
          listMovimentos.push({
            id: `reserva-${mov.id}-unique`,
            dia: entryDay,
            descricao: mov.tipo === 'entrada' ? `Depósito na Reserva: ${mov.descricao}` : `Resgate da Reserva: ${mov.descricao}`,
            tipo: mov.tipo === 'entrada' ? 'outflow' : 'inflow',
            origem: 'reserva',
            status: 'realizado',
            valor: Number(mov.valor_previsto_base),
            createdAt: mov.created_at
          });
        } else {
          const reg = dbRegsReservaList.find(r => r.id_movimentacao === mov.id && r.mes_ano === mesAno);
          if (reg) {
            const paidDay = reg.dia_movimentacao_real || mov.dia_movimentacao_previsto;
            listMovimentos.push({
              id: `reserva-${mov.id}-real`,
              dia: paidDay,
              descricao: mov.tipo === 'entrada' ? `Depósito na Reserva: ${mov.descricao} (Realizado)` : `Resgate da Reserva: ${mov.descricao} (Realizado)`,
              tipo: mov.tipo === 'entrada' ? 'outflow' : 'inflow',
              origem: 'reserva',
              status: 'realizado',
              valor: Number(reg.valor_real),
              createdAt: reg.created_at
            });
          }
        }
      });

      // 5. Ordenação Cronológica e Acumulação de Saldo Líquido
      listMovimentos.sort((a, b) => {
        if (a.dia !== b.dia) return a.dia - b.dia;
        // Entradas (inflows) primeiro no mesmo dia
        if (a.tipo !== b.tipo) {
          return a.tipo === 'inflow' ? -1 : 1;
        }
        // Saídas/entradas na ordem de lançamento
        return a.createdAt.localeCompare(b.createdAt);
      });

      let runningBalance = saldoAcumulado;
      const sortedMovimentos = listMovimentos.map(mov => {
        if (mov.tipo === 'inflow') {
          runningBalance += mov.valor;
        } else {
          runningBalance -= mov.valor;
        }
        return {
          ...mov,
          saldoPosMovimento: runningBalance
        };
      });

      // 6. Ordenar para exibição: dias mais recentes primeiro, mas mantendo a ordem (entradas antes de saídas e saídas em ordem de lançamento) no mesmo dia
      const displayMovimentos = [...sortedMovimentos].sort((a, b) => {
        if (a.dia !== b.dia) return b.dia - a.dia;
        if (a.tipo !== b.tipo) {
          return a.tipo === 'inflow' ? -1 : 1;
        }
        return a.createdAt.localeCompare(b.createdAt);
      });

      setMovimentos(displayMovimentos);

    } catch (error) {
      console.error('Erro ao montar extrato consolidado:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mesAno]);

  const totalEntradas = movimentos.filter(m => m.tipo === 'inflow').reduce((acc, m) => acc + m.valor, 0);
  const totalSaidas = movimentos.filter(m => m.tipo === 'outflow').reduce((acc, m) => acc + m.valor, 0);
  const saldoProjetadoFinal = saldoInicial + totalEntradas - totalSaidas;

  return (
    <div className="theme-extrato" style={{ padding: '0.25rem 0' }}>
      <style>{`
        .theme-extrato {
          --primary: #6366f1; /* Indigo */
        }
        .extrato-grid {
          display: grid;
          grid-template-columns: 80px 1.2fr 1fr 1.2fr 1fr 1fr;
          gap: 1.25rem;
          align-items: center;
          padding: 0.85rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
        }
        .extrato-header-row {
          font-weight: 700;
          color: var(--text-muted);
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--border-color);
          background-color: rgba(255, 255, 255, 0.01);
        }
        .extrato-movement-row {
          transition: background-color var(--transition-fast);
        }
        .extrato-movement-row:hover {
          background-color: rgba(99, 102, 241, 0.03);
        }
        .origem-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.25rem 0.6rem;
          border-radius: 50px;
          font-size: 0.75rem;
          fontWeight: 600;
          border: 1.5px solid var(--border-color);
        }
        .origem-entrada { background-color: rgba(107, 163, 90, 0.08); border-color: rgba(107, 163, 90, 0.3); color: #6BA35A; }
        .origem-salario { background-color: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.3); color: #3b82f6; }
        .origem-fixo { background-color: rgba(232, 102, 89, 0.08); border-color: rgba(232, 102, 89, 0.3); color: #e86659; }
        .origem-diario { background-color: rgba(255, 154, 63, 0.08); border-color: rgba(255, 154, 63, 0.3); color: #ff9a3f; }
        .origem-fatura { background-color: rgba(113, 65, 139, 0.08); border-color: rgba(113, 65, 139, 0.3); color: #71418b; }
        .origem-reserva { background-color: rgba(0, 162, 226, 0.08); border-color: rgba(0, 162, 226, 0.3); color: #00a2e2; }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-realizado, .status-pago { background-color: rgba(107, 163, 90, 0.12); color: #6BA35A; }
        .status-provisionado { background-color: rgba(107, 114, 128, 0.12); color: var(--text-muted); }
        .status-atrasado { background-color: rgba(232, 102, 89, 0.12); color: #e86659; }

        @media (max-width: 992px) {
          .extrato-header-row { display: none !important; }
          .extrato-grid {
            grid-template-columns: 1fr !important;
            gap: 0.5rem;
            padding: 1.25rem;
            border: 2px solid var(--border-color);
            border-radius: var(--radius-md);
            margin-bottom: 0.75rem;
          }
          .extrato-grid > div {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
          }
          .extrato-grid > div::before {
            content: attr(data-label);
            font-weight: 700;
            color: var(--text-muted);
            font-size: 0.8rem;
            text-transform: uppercase;
          }
          .extrato-grid > div:first-child::before { content: "Data" !important; }
          .extrato-grid > div:last-child {
            border-top: 1px dashed var(--border-color);
            padding-top: 0.5rem;
            margin-top: 0.25rem;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="text-h1" style={{ marginBottom: 0, color: 'var(--primary)' }}>Extrato Financeiro</h1>
      </div>

      {/* Resumo de Saldos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <Card style={{ padding: '1.25rem', borderLeft: '4px solid var(--text-muted)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Saldo Inicial do Mês</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>{formatBRL(saldoInicial)}</div>
        </Card>
        <Card style={{ padding: '1.25rem', borderLeft: '4px solid #6BA35A' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Recebido (Mês)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#6BA35A' }}>{formatBRL(totalEntradas)}</div>
        </Card>
        <Card style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Saídas (Mês)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#ef4444' }}>{formatBRL(totalSaidas)}</div>
        </Card>
        <Card style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Saldo Projetado Final</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--primary)' }}>{formatBRL(saldoProjetadoFinal)}</div>
        </Card>
      </div>

      {/* Lista de Movimentos */}
      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" />
            <span style={{ marginLeft: '0.5rem', fontWeight: 500 }}>Processando extrato...</span>
          </div>
        ) : movimentos.length === 0 ? (
          <p className="text-muted" style={{ padding: '1.5rem', margin: 0 }}>Nenhuma movimentação registrada para este mês.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header Columns */}
            <div className="extrato-grid extrato-header-row">
              <div>Dia</div>
              <div>Descrição</div>
              <div>Origem</div>
              <div>Status</div>
              <div style={{ textAlign: 'right' }}>Valor</div>
              <div style={{ textAlign: 'right' }}>Saldo Acumulado</div>
            </div>

            {/* Rows list */}
            {movimentos.map(mov => {
              const isInflow = mov.tipo === 'inflow';
              return (
                <div key={mov.id} className="extrato-grid extrato-movement-row">
                  {/* Dia */}
                  <div data-label="Dia" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                    {String(mov.dia).padStart(2, '0')}/{monthStr}
                  </div>

                  {/* Descrição */}
                  <div data-label="Descrição" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {mov.descricao}
                  </div>

                  {/* Origem */}
                  <div data-label="Origem">
                    <span className={`origem-badge origem-${mov.origem}`}>
                      {mov.origem === 'entrada' && <ArrowUpRight size={12} />}
                      {mov.origem === 'salario' && <TrendingUp size={12} />}
                      {mov.origem === 'fixo' && <Wallet size={12} />}
                      {mov.origem === 'diario' && <Calendar size={12} />}
                      {mov.origem === 'fatura' && <CreditCard size={12} />}
                      {mov.origem === 'reserva' && <PiggyBank size={12} />}
                      {mov.origem === 'salario' ? 'SALÁRIO' : mov.origem.toUpperCase()}
                    </span>
                  </div>

                  {/* Status */}
                  <div data-label="Status">
                    <span className={`status-badge status-${mov.status}`}>
                      {mov.status}
                    </span>
                  </div>

                  {/* Valor */}
                  <div data-label="Valor" style={{ textAlign: 'right', fontWeight: 700, color: isInflow ? '#6BA35A' : 'var(--text-main)' }}>
                    {isInflow ? '+' : '-'} {formatBRL(mov.valor)}
                  </div>

                  {/* Saldo Acumulado */}
                  <div data-label="Saldo" style={{ textAlign: 'right', fontWeight: 800, color: mov.saldoPosMovimento! >= 0 ? 'var(--primary)' : '#ef4444' }}>
                    {formatBRL(mov.saldoPosMovimento!)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
