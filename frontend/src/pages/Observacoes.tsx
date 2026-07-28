import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, Loader2, Calendar, FileText } from 'lucide-react';
import { observacoesService } from '../services/observacoes';
import type { Observacao } from '../types/database.types';
import './Observacoes.css';

export function Observacoes() {
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States do Modal de Cadastro/Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Nova Observação');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');

  const fetchObservacoes = async () => {
    try {
      setIsLoading(true);
      const data = await observacoesService.fetchAll();
      setObservacoes(data);
    } catch (error) {
      console.error('Erro ao buscar observações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchObservacoes();
  }, []);

  const handleOpenNewModal = () => {
    setCurrentId(null);
    setTitulo('');
    setConteudo('');
    setModalTitle('Nova Observação');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (obs: Observacao) => {
    setCurrentId(obs.id);
    setTitulo(obs.titulo);
    setConteudo(obs.conteudo);
    setModalTitle('Editar Observação');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !conteudo.trim()) return;

    try {
      setIsSubmitting(true);
      if (currentId) {
        // Atualização
        await observacoesService.update(currentId, titulo.trim(), conteudo.trim());
      } else {
        // Criação
        await observacoesService.add(titulo.trim(), conteudo.trim());
      }
      await fetchObservacoes();
      setIsModalOpen(false);
      setTitulo('');
      setConteudo('');
      setCurrentId(null);
    } catch (error: any) {
      alert('Erro ao salvar observação: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta observação?')) return;

    try {
      setIsLoading(true);
      await observacoesService.delete(id);
      await fetchObservacoes();
    } catch (error: any) {
      alert('Erro ao excluir observação: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const formatarData = (dataIso: string) => {
    const data = new Date(dataIso);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="observacoes-page">
      <div className="page-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-h1" style={{ margin: 0 }}>Observações e Anotações</h1>
          <p className="text-muted" style={{ margin: '0.25rem 0 0 0' }}>Guarde lembretes, ideias ou anotações financeiras gerais</p>
        </div>
        <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenNewModal}>
          Nova Observação
        </Button>
      </div>

      {isLoading && observacoes.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : observacoes.length === 0 ? (
        <Card style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <FileText size={48} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
            <h3 className="text-h3" style={{ margin: 0 }}>Nenhuma observação encontrada</h3>
            <p className="text-muted" style={{ margin: 0, maxWidth: '400px' }}>
              Crie notas e observações de texto simples para consultar sempre que precisar de lembretes ou informações rápidas.
            </p>
            <Button variant="outline" icon={<Plus size={18} />} onClick={handleOpenNewModal} style={{ marginTop: '0.5rem' }}>
              Criar primeira nota
            </Button>
          </div>
        </Card>
      ) : (
        <div className="observacoes-grid">
          {observacoes.map((obs) => (
            <Card
              key={obs.id}
              title={obs.titulo}
              action={
                <div className="card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleOpenEditModal(obs)}
                    className="icon-action-btn edit"
                    title="Editar anotação"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(obs.id)}
                    className="icon-action-btn delete"
                    title="Excluir anotação"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              }
            >
              <div className="obs-card-content">
                <p className="obs-text">{obs.conteudo}</p>
                <div className="obs-meta">
                  <Calendar size={12} />
                  <span>
                    {obs.updated_at !== obs.created_at
                      ? `Atualizado em ${formatarData(obs.updated_at)}`
                      : `Criado em ${formatarData(obs.created_at)}`}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Cadastro / Edição */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        <form onSubmit={handleSave} className="obs-form">
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="obs-titulo" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Título
            </label>
            <input
              type="text"
              id="obs-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Digite o título da anotação..."
              required
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="obs-conteudo" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Conteúdo
            </label>
            <textarea
              id="obs-conteudo"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Escreva a anotação aqui..."
              required
              rows={6}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.95rem',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !titulo.trim() || !conteudo.trim()}
              icon={isSubmitting ? <Loader2 className="animate-spin" size={16} /> : undefined}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
