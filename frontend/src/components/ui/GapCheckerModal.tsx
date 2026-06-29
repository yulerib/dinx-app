import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';
import { useMonth } from '../../contexts/MonthContext';
import { gastosDiariosService } from '../../services/gastosDiarios';

export function GapCheckerModal() {
  const { currentMonth } = useMonth();
  const navigate = useNavigate();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lacunas, setLacunas] = useState<{id_categoria: string, data: string}[]>([]);
  const [diasPendentes, setDiasPendentes] = useState(0);

  useEffect(() => {
    const checkGaps = async () => {
      const year = currentMonth.getFullYear();
      const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
      const mesAno = `${year}-${monthStr}`;
      
      if (sessionStorage.getItem(`gap_checker_ignored_${mesAno}`)) {
        setIsOpen(false);
        return;
      }

      const now = new Date();
      const isCurrentMonth = now.getFullYear() === year && now.getMonth() === currentMonth.getMonth();
      const isFutureMonth = currentMonth > now;
      
      if (isFutureMonth) {
        setIsOpen(false);
        return;
      }

      let lastDayToCheck = 0;
      if (isCurrentMonth) {
        lastDayToCheck = now.getDate() - 1; // até ontem
      } else {
        lastDayToCheck = new Date(year, currentMonth.getMonth() + 1, 0).getDate(); // último dia do mês
      }

      if (lastDayToCheck < 1) {
        setIsOpen(false);
        return;
      }

      try {
        const [categorias, registros] = await Promise.all([
          gastosDiariosService.fetchCategorias(),
          gastosDiariosService.fetchRegistrosDoMes(mesAno)
        ]);

        if (categorias.length === 0) {
          setIsOpen(false);
          return;
        }

        const newLacunas: {id_categoria: string, data: string}[] = [];
        const diasComLacuna = new Set<string>();

        for (let dia = 1; dia <= lastDayToCheck; dia++) {
          const dataIso = `${mesAno}-${String(dia).padStart(2, '0')}`;
          
          categorias.forEach(cat => {
            const hasRecord = registros.some(r => r.id_categoria === cat.id && r.data === dataIso);
            if (!hasRecord) {
              newLacunas.push({ id_categoria: cat.id, data: dataIso });
              diasComLacuna.add(dataIso);
            }
          });
        }

        if (newLacunas.length > 0) {
          setLacunas(newLacunas);
          setDiasPendentes(diasComLacuna.size);
          setIsOpen(true);
        } else {
          setIsOpen(false);
        }
      } catch (err) {
        console.error('Erro ao buscar lacunas', err);
      }
    };

    checkGaps();
  }, [currentMonth]);

  const handleIgnorar = () => {
    const year = currentMonth.getFullYear();
    const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
    sessionStorage.setItem(`gap_checker_ignored_${year}-${monthStr}`, 'true');
    setIsOpen(false);
  };

  const handleManual = () => {
    handleIgnorar();
    navigate('/diarios');
  };

  const handleZerar = async () => {
    try {
      setIsLoading(true);
      const inserts = lacunas.map(l => ({
        id_categoria: l.id_categoria,
        data: l.data,
        valor_gasto: 0,
        descricao: 'Zerado Automaticamente'
      }));
      await gastosDiariosService.zerarLacunasBatch(inserts);
      
      const year = currentMonth.getFullYear();
      const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
      sessionStorage.setItem(`gap_checker_ignored_${year}-${monthStr}`, 'true');
      setIsOpen(false);
      
      // Reload the page to reflect new zeroed expenses on the current view
      window.location.reload(); 
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleIgnorar} title="Lançamentos Pendentes">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--danger)' }}>
          <AlertCircle color="var(--danger)" size={24} style={{ flexShrink: 0 }} />
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}>Atenção</h3>
            <p style={{ margin: 0, marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Você tem <strong>{diasPendentes} dia(s)</strong> de gastos diários não preenchidos no período analisado deste mês. Para o painel projetar corretamente, todo dia concluído deve ter um lançamento (mesmo que seja R$ 0).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Button 
            variant="primary" 
            onClick={handleZerar} 
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isLoading ? 'Zerando...' : 'Zerar Automaticamente (R$ 0)'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleManual} 
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Preencher Manualmente
          </Button>

          <Button 
            variant="ghost" 
            onClick={handleIgnorar} 
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            Ignorar por enquanto
          </Button>
        </div>
      </div>
    </Modal>
  );
}
