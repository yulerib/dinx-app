# Design System - App Financeiro Casa

Este documento reúne todas as especificações visuais, regras de comportamento estético e tokens de design do projeto **App Financeiro Casa**, estabelecendo as diretrizes para um layout sóbrio, limpo, extremamente profissional e com toque retrô-futurista chique.

---

## 🎨 1. Diretrizes de Cores (Paleta Consolidada)

As cores foram divididas para identificar com clareza e de forma semântica cada uma das áreas do aplicativo.

| Seção / Componente | Finalidade | Hexadecimal | RGB |
| :--- | :--- | :--- | :--- |
| **Geral / Dashboard** | Visão consolidada e saldos globais | `#f5d916` | `245, 217, 22` |
| **Gastos Fixos** | Custos obrigatórios / mensais | `#e86659` | `232, 102, 89` |
| **Gastos Diários** | Despesas cotidianas recorrentes | `#ff9a3f` | `255, 154, 63` |
| **Compras Parceladas** | Parcelas e prazos futuros | `#71418b` | `113, 65, 139` |
| **Entradas & Créditos** | Receitas, abatimentos e redutores | `#6BA35A` | `107, 163, 90` |

### 🌗 Fundos do Sistema (Temas)

O aplicativo conta com uma alternância inteligente entre temas claro e escuro.

* **Tema Claro (Warm Ivory)**:
  * **Fundo Principal (`--bg-main`)**: `#F8F3E0` (marfim quente fosco)
  * **Fundo de Cards (`--bg-card`)**: `rgba(252, 250, 242, 0.9)` (marfim claro)
  * **Textos Principais**: `#1E293B`
* **Tema Escuro (Cinza Matte)**:
  * **Fundo Principal (`--bg-main`)**: `#1A1A1A` (cinza fosco plano)
  * **Fundo de Cards (`--bg-card`)**: `rgba(13, 13, 13, 0.85)` (10% mais escuro que o fundo, efeito glassmorphism)
  * **Textos Principais**: `#F1F5F9`

---

## 👁️ 2. Regras de Contraste Fino (Acessibilidade Visual)

Para garantir excelente legibilidade contra fundos sólidos de destaque:

1. **Boxes e Botões Coloridos**:
   * Todos os botões primários (`.btn-primary`) e os cabeçalhos de resumos mensais das seções **Fixos, Diários, Parcelas e Entradas** usam fontes e ícones em **branco puro (`#ffffff`)**.
2. **Destaque Amarelo (Geral/Dashboard)**:
   * Como o amarelo `#f5d916` possui luminosidade muito alta, o box de resumo global (`.summary-card-geral`) e o botão primário correspondente usam texto escuro **azul chumbo (`#161F2E`)**.

---

## 🔤 3. Tipografia

O projeto utiliza uma única família tipográfica para reforçar o caráter técnico, limpo e estruturado:

* **Fonte Principal**: `'Space Mono', monospace` (Google Fonts)
* **Estilo**: Monoespaçado moderno
* **Pesos utilizados**:
  * Regular (`400`): Leituras, detalhes de tabela, textos secundários.
  * Bold (`700`): Títulos de seções, botões, números e destaques.

---

## 📐 4. Elementos Visuais e Bordas

* **Raios de Canto (Border-Radius)**:
  * `--radius-sm`: `8px` (inputs pequenos, botões auxiliares)
  * `--radius-md`: `20px` (estilo pílula / pill para inputs maiores e botões)
  * `--radius-lg`: `25px` (cantos dos cards padrão)
  * `--radius-xl`: `30px` (cards principais de login e modais)
* **Sombras (Flat Retro Shadows)**:
  * O aplicativo evita sombras esfumaçadas clássicas e foca em sombras deslocadas "físicas" inspiradas no design flat:
    * `--shadow-sm`: `0 2px 0px rgba(0, 0, 0, 0.15)`
    * `--shadow-md`: `0 4px 0px rgba(0, 0, 0, 0.2)`
    * `--shadow-lg`: `0 8px 16px rgba(0, 0, 0, 0.3)`

---

## ⚡ 5. Micro-Animações e Transições

Todas as interações (hover em botões, foco em inputs, alternância de páginas e troca de temas claro/escuro) utilizam aceleração de hardware com a curva de animação customizada:

* **Transição normal**: `300ms cubic-bezier(0.4, 0, 0.2, 1)`
* **Transição rápida**: `150ms cubic-bezier(0.4, 0, 0.2, 1)`
