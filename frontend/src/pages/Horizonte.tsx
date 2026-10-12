import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, PiggyBank, Undo2 } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import {
  HZ_COLUMNS,
  cellKey,
  computeHorizonte,
  fetchHorizonteRaw,
  loadOverrides,
  saveOverrides
} from '../services/horizonte';
import type { HzCell, HzColumn, HzMonthView, HzOverrides, HzRaw, HzCellOverride } from '../services/horizonte';
import './Horizonte.css';

const COL_LABEL: Record<HzColumn, string> = {
  entrada: 'Entradas',
  fixo: 'Gastos fixos',
  diario: 'Gastos diários',
  cartao: 'Cartão de crédito'
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234" */
function parseValor(input: string): number | null {
  let s = input.replace(/R\$|\s/g, '');
  if (s === '') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

interface TooltipState {
  dia: number;
  col: HzColumn | 'saldo';
  rect: DOMRect;
}

export function Horizonte() {
  const { currentMonth } = useMonth();
  const mesAno = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  const [raw, setRaw] = useState<HzRaw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<HzOverrides>(() => loadOverrides());
  const [editing, setEditing] = useState<{ dia: number; col: HzColumn } | null>(null);
  const [draft, setDraft] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dados reais: carrega ao abrir e sempre que a janela volta ao foco,
  // para refletir lançamentos feitos nas outras sessões.
  const load = useCallback(async () => {
    try {
      setRaw(await fetchHorizonteRaw());
      setError(null);
    } catch (e) {
      console.error(e);
      setError('Não foi possível carregar os dados.');
    }
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  useEffect(() => saveOverrides(overrides), [overrides]);

  const view: HzMonthView | null = useMemo(
    () => (raw ? computeHorizonte(raw, mesAno, overrides) : null),
    [raw, mesAno, overrides]
  );

  useEffect(() => {
    setEditing(null);
    setTooltip(null);
  }, [mesAno]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const mesesComSimulacao = Object.keys(overrides).filter(k => Object.keys(overrides[k] || {}).length > 0);
  const outrosMesesSimulados = mesesComSimulacao.filter(m => m !== mesAno).length;

  const [detailModal, setDetailModal] = useState<{ dia: number; col: HzColumn } | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});

  // --------------------------------------------------------------------
  // Edição de células e itens
  // --------------------------------------------------------------------
  const setCell = (dia: number, col: HzColumn, override: HzCellOverride | undefined) => {
    setOverrides(prev => {
      const mes = { ...(prev[mesAno] || {}) };
      const k = cellKey(dia, col);
      if (override === undefined) delete mes[k];
      else mes[k] = override;
      const next = { ...prev };
      if (Object.keys(mes).length === 0) delete next[mesAno];
      else next[mesAno] = mes;
      return next;
    });
  };

  const startEdit = (dia: number, col: HzColumn) => {
    if (!view) return;
    const cell = view.rows[dia - 1].cells[col];

    // Se tiver mais de 1 item, abre o modal de discriminação detalhada para editar item por item
    if (cell.items.length > 1) {
      const drafts: Record<string, string> = {};
      cell.items.forEach(it => {
        drafts[it.id] = fmt(it.valor);
      });
      setItemDrafts(drafts);
      setDetailModal({ dia, col });
      setTooltip(null);
      return;
    }

    // Célula vazia ou com 1 item só: edição inline direta
    setDraft(cell.valor || cell.simulado ? fmt(cell.valor) : '');
    setEditing({ dia, col });
  };

  const commit = () => {
    if (!editing || !view) return;
    const cell = view.rows[editing.dia - 1].cells[editing.col];
    const parsed = parseValor(draft);
    if (Number.isNaN(parsed)) return setEditing(null);
    const valor = parsed ?? 0;

    // Se tiver 1 item base
    if (cell.items.length === 1) {
      const it = cell.items[0];
      if (valor === it.valorOriginal) {
        setCell(editing.dia, editing.col, undefined);
      } else {
        setCell(editing.dia, editing.col, { [it.id]: valor });
      }
    } else {
      // Célula vazia / nova simulação
      if (valor === cell.baseValor) setCell(editing.dia, editing.col, undefined);
      else setCell(editing.dia, editing.col, valor);
    }
    setEditing(null);
  };

  const commitDetailModal = () => {
    if (!detailModal || !view) return;
    const cell = view.rows[detailModal.dia - 1].cells[detailModal.col];
    const itemMap: Record<string, number> = {};
    let hasDiff = false;

    cell.items.forEach(it => {
      const strVal = itemDrafts[it.id];
      const parsed = strVal !== undefined ? parseValor(strVal) : it.valorOriginal;
      const val = parsed !== null && !Number.isNaN(parsed) ? parsed : 0;
      if (val !== it.valorOriginal) {
        hasDiff = true;
      }
      itemMap[it.id] = val;
    });

    if (hasDiff) {
      setCell(detailModal.dia, detailModal.col, itemMap);
    } else {
      setCell(detailModal.dia, detailModal.col, undefined);
    }
    setDetailModal(null);
  };

  const move = (dDia: number, dCol: number) => {
    if (!editing || !view) return;
    const colIdx = HZ_COLUMNS.indexOf(editing.col) + dCol;
    let dia = editing.dia + dDia;
    let ci = colIdx;
    if (ci >= HZ_COLUMNS.length) { ci = 0; dia++; }
    if (ci < 0) { ci = HZ_COLUMNS.length - 1; dia--; }
    commit();
    if (dia >= 1 && dia <= view.rows.length) setTimeout(() => startEdit(dia, HZ_COLUMNS[ci]), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
  };

  const resetMes = () => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[mesAno];
      return next;
    });
    setResetOpen(false);
  };
  const resetTudo = () => {
    setOverrides({});
    setResetOpen(false);
  };
  const handleReset = () => (outrosMesesSimulados > 0 ? setResetOpen(true) : resetMes());

  const showTip = (e: React.MouseEvent<HTMLElement>, dia: number, col: HzColumn | 'saldo') => {
    if (detailModal) return;
    setTooltip({ dia, col, rect: e.currentTarget.getBoundingClientRect() });
  };

  // --------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------
  const tituloMes = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const renderCell = (dia: number, col: HzColumn, cell: HzCell) => {
    const isEditing = editing?.dia === dia && editing.col === col;
    return (
      <td
        key={col}
        className={`hz-cell hz-col-${col} hz-state-${cell.state} ${isEditing ? 'is-editing' : ''}`}
        onClick={() => !isEditing && startEdit(dia, col)}
        onMouseEnter={e => showTip(e, dia, col)}
        onMouseLeave={() => setTooltip(null)}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            className="hz-input"
            value={draft}
            inputMode="decimal"
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
          />
        ) : (
          <div className="hz-cell-inner">
            {cell.simulado && (
              <button
                className="hz-cell-reset"
                title="Desfazer simulação desta célula"
                onClick={e => { e.stopPropagation(); setCell(dia, col, undefined); }}
              >
                <Undo2 size={12} />
              </button>
            )}
            {cell.temReserva && <PiggyBank size={12} className="hz-reserva-icon" />}
            <span className="hz-val">{cell.valor || cell.simulado ? fmt(cell.valor) : ''}</span>
          </div>
        )}
      </td>
    );
  };

  const renderTooltip = () => {
    if (!tooltip || !view || detailModal) return null;
    const row = view.rows[tooltip.dia - 1];
    if (!row) return null;
    const { rect } = tooltip;
    const top = rect.bottom + 6;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - 140), window.innerWidth - 288);
    const style = { top: top + 220 > window.innerHeight ? undefined : top, bottom: top + 220 > window.innerHeight ? window.innerHeight - rect.top + 6 : undefined, left };
    const dataLabel = `${String(row.dia).padStart(2, '0')}/${mesAno.slice(5)} · ${row.diaSemana}`;

    if (tooltip.col === 'saldo') {
      const diff = row.saldo - row.saldoBase;
      return (
        <div className="hz-tooltip" style={style}>
          <div className="hz-tip-head"><span>Total em conta</span><span>{dataLabel}</span></div>
          <div className="hz-tip-row"><span>Com simulações</span><strong>{fmtBRL(row.saldo)}</strong></div>
          <div className="hz-tip-row"><span>Sem simulações</span><span>{fmtBRL(row.saldoBase)}</span></div>
          {Math.abs(diff) >= 0.01 && (
            <div className="hz-tip-row hz-tip-sim"><span>Impacto das simulações</span><span>{diff > 0 ? '+' : ''}{fmtBRL(diff)}</span></div>
          )}
        </div>
      );
    }

    const cell = row.cells[tooltip.col];
    return (
      <div className="hz-tooltip" style={style}>
        <div className="hz-tip-head"><span>{COL_LABEL[tooltip.col]}</span><span>{dataLabel}</span></div>
        {cell.items.length === 0 && !cell.simulado && <div className="hz-tip-empty">Sem movimentações. Clique para simular.</div>}
        {cell.items.map((it, i) => (
          <div key={i} className={`hz-tip-row ${it.simulado ? 'hz-tip-row-sim' : ''}`}>
            <span className="hz-tip-desc">
              {it.reserva && <PiggyBank size={11} />}
              {it.descricao}
              <em className={`hz-tip-tag tag-${it.status}`}>{it.status === 'executado' ? 'efetuado' : 'previsto'}</em>
              {it.simulado && <em className="hz-tip-tag tag-sim">simulado</em>}
            </span>
            <div style={{ textAlign: 'right' }}>
              <span>{fmt(it.valor)}</span>
              {it.simulado && <div className="hz-tip-orig">original: {fmt(it.valorOriginal)}</div>}
            </div>
          </div>
        ))}
        {cell.items.length > 1 && (
          <div className="hz-tip-row hz-tip-total">
            <span>Total da célula</span>
            <strong>{fmt(cell.valor)}</strong>
          </div>
        )}
        {cell.items.length > 1 && (
          <div className="hz-tip-hint">Clique na célula para simular valores individualmente</div>
        )}
        {cell.simulado && cell.items.length <= 1 && (
          <div className="hz-tip-row hz-tip-sim">
            <span>{cell.novaSimulacao ? 'Nova movimentação simulada' : 'Valor simulado'}</span>
            <strong>{fmt(cell.valor)}</strong>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="hz-page">
      <div className="hz-header">
        <div>
          <h1 className="text-h1 hz-title">Horizonte</h1>
          <p className="hz-subtitle">Movimentações e saldo da conta corrente, dia a dia · <span className="hz-month">{tituloMes}</span></p>
        </div>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={mesesComSimulacao.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RotateCcw size={15} />
          Restaurar padrão
        </Button>
      </div>

      <div className="hz-legend">
        <span className="hz-legend-item"><i className="sw sw-previsto" />Previsto</span>
        <span className="hz-legend-item"><i className="sw sw-executado" />Efetuado</span>
        <span className="hz-legend-item"><i className="sw sw-simulado" />Simulação</span>
        <span className="hz-legend-item"><PiggyBank size={13} />Reserva</span>
        {view && view.numSimulacoes > 0 && (
          <span className="hz-legend-count">{view.numSimulacoes} {view.numSimulacoes === 1 ? 'célula simulada' : 'células simuladas'} neste mês</span>
        )}
      </div>

      {error && <div className="hz-msg">{error}</div>}
      {!view && !error && <div className="hz-msg">Carregando…</div>}

      {view && (
        <div className="hz-sheet-wrap">
          <table className="hz-sheet">
            <thead>
              <tr>
                <th className="hz-th-dia">Dia</th>
                {HZ_COLUMNS.map(c => (
                  <th key={c} className={`hz-th hz-th-${c}`}><span className="hz-dot" />{COL_LABEL[c]}</th>
                ))}
                <th className="hz-th hz-th-saldo">Total em conta</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hz-row-opening">
                <td className="hz-dia" colSpan={5}>Saldo inicial do mês</td>
                <td className={`hz-saldo ${view.saldoInicial < 0 ? 'neg' : ''} ${Math.abs(view.saldoInicial - view.saldoInicialBase) >= 0.01 ? 'is-sim' : ''}`}
                  title={Math.abs(view.saldoInicial - view.saldoInicialBase) >= 0.01 ? `Inclui simulações de meses anteriores · sem simulações: ${fmtBRL(view.saldoInicialBase)}` : undefined}>
                  {fmt(view.saldoInicial)}
                </td>
              </tr>
              {view.rows.map(row => {
                const simImpact = Math.abs(row.saldo - row.saldoBase) >= 0.01;
                return (
                  <tr key={row.dia} className={`${row.isToday ? 'is-today' : ''} ${row.isWeekend ? 'is-weekend' : ''}`}>
                    <td className="hz-dia">
                      <span className="hz-dia-num">{String(row.dia).padStart(2, '0')}</span>
                      <span className="hz-dia-wk">{row.diaSemana}</span>
                    </td>
                    {HZ_COLUMNS.map(c => renderCell(row.dia, c, row.cells[c]))}
                    <td
                      className={`hz-saldo ${row.saldo < 0 ? 'neg' : ''} ${simImpact ? 'is-sim' : ''}`}
                      onMouseEnter={e => showTip(e, row.dia, 'saldo')}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {fmt(row.saldo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="hz-dia">Total</td>
                {HZ_COLUMNS.map(c => <td key={c} className="hz-foot">{fmt(view.totais[c])}</td>)}
                <td className={`hz-saldo ${view.saldoFinal < 0 ? 'neg' : ''}`}>{fmt(view.saldoFinal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="hz-hint">
        Clique em qualquer célula para simular um valor · <kbd>Enter</kbd> desce · <kbd>Tab</kbd> avança · <kbd>Esc</kbd> cancela.
        Simulações ficam apenas nesta planilha e seguem para os meses seguintes.
      </p>

      {renderTooltip()}

      {/* Modal para simular valores de movimentações individuais quando há mais de 1 item */}
      {detailModal && view && (() => {
        const row = view.rows[detailModal.dia - 1];
        const cell = row?.cells[detailModal.col];
        if (!row || !cell) return null;

        const totalSimulado = round2(
          cell.items.reduce((s, it) => {
            const raw = itemDrafts[it.id];
            const p = raw !== undefined ? parseValor(raw) : it.valor;
            return s + (p !== null && !Number.isNaN(p) ? p : 0);
          }, 0)
        );
        const diffTotal = round2(totalSimulado - cell.baseValor);

        return (
          <Modal
            isOpen={true}
            onClose={() => setDetailModal(null)}
            title={`Simular ${COL_LABEL[detailModal.col]} — Dia ${String(detailModal.dia).padStart(2, '0')}/${mesAno.slice(5)}`}
          >
            <div className="hz-modal-detail">
              <p className="hz-modal-subtitle">
                Altere o valor de cada movimentação individualmente para simular o impacto no saldo:
              </p>

              <div className="hz-modal-items">
                {cell.items.map(it => {
                  const draftVal = itemDrafts[it.id] ?? fmt(it.valor);
                  const parsed = parseValor(draftVal);
                  const valNum = parsed !== null && !Number.isNaN(parsed) ? parsed : 0;
                  const itemIsSim = round2(valNum) !== round2(it.valorOriginal);

                  return (
                    <div key={it.id} className={`hz-modal-item-row ${itemIsSim ? 'is-sim' : ''}`}>
                      <div className="hz-modal-item-info">
                        <div className="hz-modal-item-title">
                          {it.reserva && <PiggyBank size={14} className="hz-reserva-icon" />}
                          <span>{it.descricao}</span>
                          <span className={`hz-tip-tag tag-${it.status}`}>
                            {it.status === 'executado' ? 'efetuado' : 'previsto'}
                          </span>
                        </div>
                        <div className="hz-modal-item-orig">
                          Original: {fmtBRL(it.valorOriginal)}
                        </div>
                      </div>

                      <div className="hz-modal-item-input-wrap">
                        <span className="hz-modal-currency-symbol">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="hz-modal-input"
                          value={draftVal}
                          onChange={e =>
                            setItemDrafts(prev => ({ ...prev, [it.id]: e.target.value }))
                          }
                          placeholder={fmt(it.valorOriginal)}
                        />
                        {itemIsSim && (
                          <button
                            type="button"
                            className="hz-modal-item-reset"
                            title="Restaurar valor original deste item"
                            onClick={() =>
                              setItemDrafts(prev => ({ ...prev, [it.id]: fmt(it.valorOriginal) }))
                            }
                          >
                            <Undo2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resumo do total */}
              <div className="hz-modal-total-bar">
                <div>
                  <span className="hz-modal-total-label">Total simulado: </span>
                  <strong className="hz-modal-total-val">{fmtBRL(totalSimulado)}</strong>
                  {Math.abs(diffTotal) >= 0.01 && (
                    <span className={`hz-modal-diff ${diffTotal > 0 ? 'pos' : 'neg'}`}>
                      {' '}({diffTotal > 0 ? '+' : ''}{fmtBRL(diffTotal)})
                    </span>
                  )}
                </div>
                {cell.simulado && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCell(detailModal.dia, detailModal.col, undefined);
                      setDetailModal(null);
                    }}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                  >
                    Restaurar todos
                  </Button>
                )}
              </div>

              <div className="hz-modal-actions">
                <Button variant="outline" onClick={() => setDetailModal(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={commitDetailModal}>
                  Aplicar Simulação
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      <Modal isOpen={resetOpen} onClose={() => setResetOpen(false)} title="Restaurar padrão">
        <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Há simulações em {outrosMesesSimulados} {outrosMesesSimulados === 1 ? 'outro mês' : 'outros meses'}. O que deseja restaurar?
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '1.25rem' }}>
          <Button variant="outline" onClick={resetMes} disabled={!overrides[mesAno]}>Somente este mês</Button>
          <Button variant="primary" onClick={resetTudo}>Todos os meses</Button>
        </div>
      </Modal>
    </div>
  );
}
