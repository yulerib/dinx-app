import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Definições base de cores HSL para cada seção (com os novos valores base para o modo Claro definidos pelo usuário)
const colorBases = {
  light: {
    dashboard: { h: 53,  s: 100, l: 44, cl: 95 }, // Amarelo: S+20 (100%), L+20 (44%)
    fixos:     { h: 5,   s: 82,  l: 56, cl: 94 }, // Vermelho: S+20 (82%), L+15 (56%)
    diarios:   { h: 28,  s: 100, l: 60, cl: 94 }, // Laranja: S+20 (100%), L+20 (60%)
    parcelas:  { h: 278, s: 48,  l: 41, cl: 93 }, // Roxo: S+0 (48%), L+0 (41%)
    entradas:  { h: 106, s: 74,  l: 43, cl: 93 }, // Verde: S+20 (74%), L+15 (43%)
    reserva:   { h: 197, s: 100, l: 48, cl: 93 }, // Azul: S+20 (100%), L+20 (48%)
    extrato:   { h: 53,  s: 100, l: 44, cl: 95 },
  },
  dark: {
    dashboard: { h: 53,  s: 85,  l: 54, cl: 25 }, // Amarelo: S-15 (85%), L-5 (54%)
    fixos:     { h: 5,   s: 100, l: 56, cl: 25 }, // Vermelho: S+0 (100%), L-10 (56%)
    diarios:   { h: 28,  s: 90,  l: 55, cl: 25 }, // Laranja: S-10 (90%), L-15 (55%)
    parcelas:  { h: 278, s: 53,  l: 61, cl: 25 }, // Roxo: S+10 (53%), L+10 (61%)
    entradas:  { h: 106, s: 64,  l: 38, cl: 20 }, // Verde: S+0 (64%), L-20 (38%)
    reserva:   { h: 197, s: 100, l: 58, cl: 22 }, // Azul: S+0 (100%), L-5 (58%)
    extrato:   { h: 53,  s: 85,  l: 54, cl: 25 },
  }
};

export function VisualTester() {
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'colors' | 'fonts'>('colors');
  
  // Controles de Fontes Hierárquicas (Roboto Flex Variable)
  const [hWeight, setHWeight] = useState(1000);
  const [hWidth, setHWidth] = useState(65);
  
  const [subWeight, setSubWeight] = useState(650);
  const [subWidth, setSubWidth] = useState(151);

  const [bodyWeight, setBodyWeight] = useState(1000);
  const [bodyWidth, setBodyWidth] = useState(151);

  const [dataWeight, setDataWeight] = useState(600);
  const [dataWidth, setDataWidth] = useState(90);

  const [grade, setGrade] = useState(0); // Eixo GRAD: -200 a 150

  // Controles de Calibração de Cores HSL das Sessões (Fundo e cards são mantidos estritamente originais e fixos)
  const [satOffset, setSatOffset] = useState(0);             // -40 a +20
  const [primaryLOffset, setPrimaryLOffset] = useState(0);   // -20 a +20
  const [containerLOffset, setContainerLOffset] = useState(0); // -20 a +20

  // 1. Aplica estilos dinâmicos de tipografia na página
  useEffect(() => {
    const styleId = 'm3-dynamic-typography-tester';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      /* Configuração global de fontes herdada de forma limpa pelo HTML/Body */
      html, body {
        font-family: 'Roboto Flex Variable', sans-serif !important;
      }

      /* Corpo do App - exclui ícones Material Symbols de receber override de fonte */
      body, p, span:not(.cr-value):not(.material-symbols-outlined):not(.material-symbols-rounded):not(.material-symbols-sharp):not(.m3-bottom-nav-label):not(.nav-label), li, label, input, select, textarea, button:not(.btn):not(.cr-value):not(.m3-bottom-nav-item) {
        font-variation-settings: 'wght' ${bodyWeight}, 'wdth' ${bodyWidth}, 'GRAD' ${grade} !important;
        font-stretch: ${bodyWidth}% !important;
      }
      
      /* Títulos (H1 / H2) */
      .text-h1, h1, .text-h2, h2, .sidebar-header h2, .bottom-sheet-header h3 {
        font-variation-settings: 'wght' ${hWeight}, 'wdth' ${hWidth}, 'GRAD' ${grade} !important;
        font-stretch: ${hWidth}% !important;
      }
      
      /* Subtítulos (H3) */
      .text-h3, h3, .stat-card-title {
        font-variation-settings: 'wght' ${subWeight}, 'wdth' ${subWidth}, 'GRAD' ${grade} !important;
        font-stretch: ${subWidth}% !important;
      }
      
      /* Valores Numéricos / Tabelas / Badges */
      .cr-value, td, th, .stat-card-value, .fixed-summary-row1 span, .fixed-summary-proj, .progress-bar-label, [class*="value-"], [class*="amount-"] {
        font-family: 'Roboto Flex Variable', sans-serif !important;
        font-variation-settings: 'wght' ${dataWeight}, 'wdth' ${dataWidth}, 'GRAD' ${grade} !important;
        font-stretch: ${dataWidth}% !important;
      }

      /* Botões e Links de Menu */
      .btn, .nav-link, .bottom-sheet-menu-item, .m3-bottom-nav-item {
        font-variation-settings: 'wght' ${bodyWeight + 150}, 'wdth' ${bodyWidth}, 'GRAD' ${grade} !important;
        font-stretch: ${bodyWidth}% !important;
      }
    `;
  }, [hWeight, hWidth, subWeight, subWidth, bodyWeight, bodyWidth, dataWeight, dataWidth, grade]);

  // 2. Aplica estilos dinâmicos de cores baseados na calibração HSL
  useEffect(() => {
    const styleId = 'm3-dynamic-colors-tester';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const t = theme === 'dark' ? 'dark' : 'light';
    const bases = colorBases[t];

    const calcColor = (baseColor: { h: number, s: number, l: number, cl: number }) => {
      const s = Math.max(0, Math.min(100, baseColor.s + satOffset));
      const l = Math.max(0, Math.min(100, baseColor.l + primaryLOffset));
      const cl = Math.max(0, Math.min(100, baseColor.cl + containerLOffset));
      const onCl = t === 'light' ? Math.max(0, cl - 55) : Math.min(100, cl + 55);
      
      return {
        primary: `hsl(${baseColor.h}, ${s}%, ${l}%)`,
        container: `hsl(${baseColor.h}, ${s}%, ${cl}%)`,
        onContainer: `hsl(${baseColor.h}, ${s}%, ${onCl}%)`
      };
    };

    const cDashboard = calcColor(bases.dashboard);
    const cFixos = calcColor(bases.fixos);
    const cDiarios = calcColor(bases.diarios);
    const cParcelas = calcColor(bases.parcelas);
    const cEntradas = calcColor(bases.entradas);
    const cReserva = calcColor(bases.reserva);
    const cExtrato = calcColor(bases.extrato);

    styleEl.innerHTML = `
      /* Geral/Dashboard */
      .theme-dashboard {
        --md-sys-color-primary: ${cDashboard.primary} !important;
        --md-sys-color-primary-container: ${cDashboard.container} !important;
        --md-sys-color-on-primary-container: ${cDashboard.onContainer} !important;
        --section-color: ${cDashboard.primary} !important;
      }
      
      /* Gastos Fixos */
      .theme-fixos {
        --md-sys-color-primary: ${cFixos.primary} !important;
        --md-sys-color-primary-container: ${cFixos.container} !important;
        --md-sys-color-on-primary-container: ${cFixos.onContainer} !important;
        --section-color: ${cFixos.primary} !important;
      }

      /* Gastos Diários */
      .theme-diarios {
        --md-sys-color-primary: ${cDiarios.primary} !important;
        --md-sys-color-primary-container: ${cDiarios.container} !important;
        --md-sys-color-on-primary-container: ${cDiarios.onContainer} !important;
        --section-color: ${cDiarios.primary} !important;
      }

      /* Compras Parceladas */
      .theme-parcelas {
        --md-sys-color-primary: ${cParcelas.primary} !important;
        --md-sys-color-primary-container: ${cParcelas.container} !important;
        --md-sys-color-on-primary-container: ${cParcelas.onContainer} !important;
        --section-color: ${cParcelas.primary} !important;
      }

      /* Entradas & Créditos */
      .theme-entradas {
        --md-sys-color-primary: ${cEntradas.primary} !important;
        --md-sys-color-primary-container: ${cEntradas.container} !important;
        --md-sys-color-on-primary-container: ${cEntradas.onContainer} !important;
        --section-color: ${cEntradas.primary} !important;
      }

      /* Reserva Financeira */
      .theme-reserva {
        --md-sys-color-primary: ${cReserva.primary} !important;
        --md-sys-color-primary-container: ${cReserva.container} !important;
        --md-sys-color-on-primary-container: ${cReserva.onContainer} !important;
        --section-color: ${cReserva.primary} !important;
      }

      /* Extrato */
      .theme-extrato {
        --md-sys-color-primary: ${cExtrato.primary} !important;
        --md-sys-color-primary-container: ${cExtrato.container} !important;
        --md-sys-color-on-primary-container: ${cExtrato.onContainer} !important;
        --section-color: ${cExtrato.primary} !important;
      }
    `;
  }, [theme, satOffset, primaryLOffset, containerLOffset]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 99999,
        fontFamily: "'Roboto Flex Variable', sans-serif",
      }}
    >
      {/* Botão de Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: 'var(--md-sys-color-primary)',
          color: 'var(--md-sys-color-on-primary)',
          border: '1px solid var(--md-sys-color-outline)',
          borderRadius: '100px',
          padding: '10px 20px',
          fontSize: '13px',
          fontWeight: 700,
          boxShadow: 'var(--md-elevation-3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.filter = 'brightness(0.92)';
          e.currentTarget.style.boxShadow = 'var(--md-elevation-4)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.filter = 'none';
          e.currentTarget.style.boxShadow = 'var(--md-elevation-3)';
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>tune</span>
        Visual Lab (M3) {isOpen ? '▲' : '▼'}
      </button>

      {/* Painel de Controles */}
      {isOpen && (
        <div
          className="card"
          style={{
            position: 'absolute',
            bottom: '50px',
            left: 0,
            width: '360px',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-main)',
            borderRadius: '28px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--md-elevation-5)',
            maxHeight: '75vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            transformOrigin: 'bottom left',
            animation: 'modalSlideIn 0.2s ease-out',
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Material Design 3 Lab</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)', opacity: 0.8 }}>
              Calibração de sub-tons e tipografia em tempo real.
            </p>
          </div>

          {/* Abas */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setActiveTab('colors')}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '12px',
                fontWeight: activeTab === 'colors' ? 700 : 500,
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: activeTab === 'colors' ? '2px solid var(--md-sys-color-primary)' : '2px solid transparent',
                color: activeTab === 'colors' ? 'var(--md-sys-color-primary)' : 'inherit',
                cursor: 'pointer',
                background: 'none',
              }}
            >
              Calibração de Tons
            </button>
            <button
              onClick={() => setActiveTab('fonts')}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '12px',
                fontWeight: activeTab === 'fonts' ? 700 : 500,
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: activeTab === 'fonts' ? '2px solid var(--md-sys-color-primary)' : '2px solid transparent',
                color: activeTab === 'fonts' ? 'var(--md-sys-color-primary)' : 'inherit',
                cursor: 'pointer',
                background: 'none',
              }}
            >
              Hierarquia Roboto Flex
            </button>
          </div>

          {/* ABA: CALIBRAÇÃO DE CORES HSL */}
          {activeTab === 'colors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Tema */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Controle de Sistema</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-outline"
                    onClick={toggleTheme}
                    style={{ flex: 1, height: '36px', padding: '0 8px', fontSize: '11px' }}
                  >
                    Tema: {theme === 'dark' ? 'Escuro' : 'Claro'}
                  </button>
                </div>
              </div>

              {/* Ajuste HSL das Seções */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Calibração das Cores de Seção</span>
                <p style={{ margin: 0, fontSize: '9px', opacity: 0.7, lineHeight: 1.4 }}>
                  Os controladores abaixo calibram offsets a partir da nova referência M3. Os fundos e cards do app mantêm-se nos tons originais do projeto.
                </p>
                
                {/* Saturação */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <label>Ajuste de Saturação:</label>
                    <strong>{satOffset > 0 ? `+${satOffset}` : satOffset}%</strong>
                  </div>
                  <input type="range" min="-40" max="20" step="2" value={satOffset} onChange={e => setSatOffset(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                </div>

                {/* Luminância Chave */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <label>Ajuste de Luminância Primária:</label>
                    <strong>{primaryLOffset > 0 ? `+${primaryLOffset}` : primaryLOffset}%</strong>
                  </div>
                  <input type="range" min="-20" max="20" step="1" value={primaryLOffset} onChange={e => setPrimaryLOffset(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                </div>

                {/* Luminância Container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <label>Ajuste de Luminância de Containers:</label>
                    <strong>{containerLOffset > 0 ? `+${containerLOffset}` : containerLOffset}%</strong>
                  </div>
                  <input type="range" min="-20" max="20" step="1" value={containerLOffset} onChange={e => setContainerLOffset(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                </div>
              </div>

            </div>
          )}

          {/* ABA: HIERARQUIA ROBOTO FLEX */}
          {activeTab === 'fonts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Títulos (H1 / H2) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>1. Títulos (H1 / H2)</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '9px', opacity: 0.7 }}>Peso: {hWeight}</label>
                    <input type="range" min="100" max="1000" step="50" value={hWeight} onChange={e => setHWeight(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '9px', opacity: 0.7 }}>Largura: {hWidth}%</label>
                    <input type="range" min="25" max="151" step="1" value={hWidth} onChange={e => setHWidth(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                  </div>
                </div>
              </div>

              {/* Subtítulos (H3) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>2. Subtítulos (H3 / Cards Header)</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '9px', opacity: 0.7 }}>Peso: {subWeight}</label>
                    <input type="range" min="100" max="1000" step="50" value={subWeight} onChange={e => setSubWeight(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '9px', opacity: 0.7 }}>Largura: {subWidth}%</label>
                    <input type="range" min="25" max="151" step="1" value={subWidth} onChange={e => setSubWidth(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                  </div>
                </div>
              </div>

              {/* Corpo (Textos Gerais) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>3. Corpo (Parágrafos e Labels)</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '9px', opacity: 0.7 }}>Peso: {bodyWeight}</label>
                    <input type="range" min="100" max="1000" step="50" value={bodyWeight} onChange={e => setBodyWeight(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '9px', opacity: 0.7 }}>Largura: {bodyWidth}%</label>
                    <input type="range" min="25" max="151" step="1" value={bodyWidth} onChange={e => setBodyWidth(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                  </div>
                </div>
              </div>

              {/* Dados Finanças (Valores Numéricos / Tabelas) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>4. Dados (Números / Valores / Tabelas)</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '9px', opacity: 0.7 }}>Peso: {dataWeight}</label>
                    <input type="range" min="100" max="1000" step="50" value={dataWeight} onChange={e => setDataWeight(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '9px', opacity: 0.7 }}>Largura: {dataWidth}%</label>
                    <input type="range" min="25" max="151" step="1" value={dataWidth} onChange={e => setDataWidth(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }} />
                  </div>
                </div>
              </div>

              {/* Ajuste Óptico Global (Grade - GRAD Eixo) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700 }}>Ajuste Óptico Global (Grade)</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>{grade}</span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="150"
                  step="10"
                  value={grade}
                  onChange={e => setGrade(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }}
                />
                <p style={{ margin: '2px 0 0 0', fontSize: '9px', opacity: 0.6 }}>
                  Eixo GRAD da Roboto Flex (escala -200 a 150). Compensa irradiação de luz física em temas escuros.
                </p>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
