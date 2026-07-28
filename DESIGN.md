# Design System - Material Design 3 (M3)

Este documento reúne todas as especificações visuais, regras de comportamento estético, tokens de design e arquitetura de layout do projeto **App Financeiro Casa**, estabelecendo as diretrizes baseadas no **Material Design 3 (M3)** do Google, após calibração e homologação final.

---

## 🎨 1. Sistema Dinâmico de Cores (Design Tokens)

O aplicativo adota a lógica de cores do M3, mantendo a identidade das cores originais de cada seção do projeto como cores "Semente" (Seed Colors) e aplicando variações ideais de saturação (S) e luminância (L) para os modos Claro (Light) e Escuro (Dark).

As variáveis CSS de cores são definidas e injetadas estaticamente no [index.css](file:///c:/Users/Yule%20Ribeiro/Documents/IA/BLAISE_APP/frontend/src/index.css) de acordo com a classe de seção (`.theme-dashboard`, `.theme-fixos`, etc.) e o atributo de tema global (`[data-theme='light']`/`[data-theme='dark']`).

### 🌗 Mapeamento de Neutros (Claro / Escuro)

*   **Tema Claro (Warm Ivory)**
    *   `--md-sys-color-background`: `#F8F3E0` (Marfim quente fosco original)
    *   `--md-sys-color-surface`: `#FCFAF2` (Marfim claro para fundos de cards)
    *   `--md-sys-color-outline-variant`: `#CBE6FF` (Bordas leves)
    *   `--md-sys-color-outline`: `#7A776E` (Bordas de inputs/divisores)
    *   `--md-sys-color-on-surface`: `#1C1B12` (Chumbo escuro para legibilidade)

*   **Tema Escuro (Chumbo Matte)**
    *   `--md-sys-color-background`: `#141414` (Cinza fosco puro plano)
    *   `--md-sys-color-surface`: `#1D1D1C` (Cinza escuro glassmorphic)
    *   `--md-sys-color-outline-variant`: `#49473F` (Bordas internas leves)
    *   `--md-sys-color-outline`: `#949086` (Bordas estruturais)
    *   `--md-sys-color-on-surface`: `#E6E2D9` (Off-white de alto contraste)

### 📊 Cores por Seção e Valores Calibrados (HSL)

| Seção | Cor Original | HSL Modo Claro (Luz) | HSL Modo Escuro (Dark) | Aplicação e Significado |
| :--- | :---: | :--- | :--- | :--- |
| **Geral / Dashboard** | Amarelo | `hsl(53, 100%, 44%)` | `hsl(53, 85%, 54%)` | Visão geral consolidada e extratos |
| **Entradas & Créditos**| Verde | `hsl(106, 74%, 43%)` | `hsl(106, 64%, 38%)` | Depósitos, créditos e botões de recebido |
| **Gastos Fixos** | Vermelho | `hsl(5, 82%, 56%)` | `hsl(5, 100%, 56%)` | Contas fixas e botões de despesas vencidas |
| **Gastos Diários** | Laranja | `hsl(28, 100%, 60%)` | `hsl(28, 90%, 55%)` | Orçamento e despesas cotidianas variáveis |
| **Cartão de Crédito** | Roxo | `hsl(278, 48%, 41%)` | `hsl(278, 53%, 61%)` | Compras parceladas e limite teto |
| **Reserva Financeira** | Azul | `hsl(197, 100%, 48%)` | `hsl(197, 100%, 58%)` | Investimentos e valores a repor |

---

## 🔤 2. Tipografia Dinâmica (Roboto Flex Variable)

O projeto utiliza exclusivamente a fonte variável **Roboto Flex** (carregada localmente via npm), permitindo a calibração exata dos eixos de variação para otimização da leitura:

### ⚙️ Eixos de Variação Calibrados
*   **Corpo do App (Parágrafos, Labels, Inputs):** 
    *   Eixos: Peso (`wght`) `1000`, Largura (`wdth`) `151%`, Grau (`GRAD`) `0`
*   **Títulos Grandes (H1 / H2 / Cabeçalhos):** 
    *   Eixos: Peso (`wght`) `1000`, Largura (`wdth`) `65%`, Grau (`GRAD`) `0`
*   **Subtítulos e Títulos de Cards (H3):** 
    *   Eixos: Peso (`wght`) `650`, Largura (`wdth`) `151%`, Grau (`GRAD`) `0`
*   **Valores Numéricos e Tabelas:** 
    *   Eixos: Peso (`wght`) `600`, Largura (`wdth`) `90%`, Grau (`GRAD`) `0`
*   **Botões e Links de Menu:** 
    *   Eixos: Peso (`wght`) `1150`, Largura (`wdth`) `151%`, Grau (`GRAD`) `0`

---

## 📐 3. Elevação e Formas (Shapes)

O M3 organiza os elementos em planos tridimensionais virtuais, com raios de canto orgânicos.

### Cantos Arredondados (Shapes)
*   `--md-shape-small` (`8px`): Inputs, campos de textos e dropdowns.
*   `--md-shape-medium` (`12px`): Chips, badges e mini-cards de estatísticas.
*   `--md-shape-large` (`16px`): Cards padrão de transações e conteúdo.
*   `--md-shape-extra-large` (`28px`): Modais, gavetas e containers de login.
*   `--md-shape-full` (`100px` / Pílula): Botões principais e indicadores de menu ativo.

### Níveis de Elevação (Shadows & Overlays)
*   **Elevation 0:** Plano. Usado no fundo e em botões desabilitados.
*   **Elevation 1 (`--md-elevation-1`):** Usado nos `.card` padrão. Adiciona profundidade leve.
*   **Elevation 2 (`--md-elevation-2`):** Hover em cards comuns e botões ativos.
*   **Elevation 3 (`--md-elevation-3`):** Hover em StatCards ativos.
*   **Elevation 4 (`--md-elevation-4`):** Modais e diálogos flutuantes (`.modal-card`).
*   **Elevation 5 (`--md-elevation-5`):** Bottom Sheets mobile.

---

## 🧭 4. Estrutura de Navegação Responsiva

### 💻 Desktop: M3 Navigation Drawer
*   O menu lateral possui largura fixa de `280px` com alinhamento dos itens e ícones à **esquerda** no estado expandido.
*   Os links ativos contam com a **pílula ativa M3** de fundo (`secondary-container`) com cantos de `100px` e texto em contraste.
*   O botão **"Sair" (Logout)** está fixado de forma elegante no rodapé da barra lateral (`.sidebar-footer`).

### 📱 Mobile: Navigation Bar & Bottom Sheet
*   **M3 Bottom Navigation Bar:** Fixada na base da tela (`height: 80px`), contendo os 4 itens principais (`Visão Geral`, `Entradas`, `Gastos Fixos`, `Gastos Diários`) e o botão `Mais`.
    *   Os rótulos (`.m3-bottom-nav-label`) possuem centralização horizontal estrita (`text-align: center`) para alinhar perfeitamente com os ícones mesmo em caso de quebra em duas linhas (ex: "Gastos Diários").
*   **M3 Bottom Sheet Drawer:** Gaveta flutuante acionada pelo botão `Mais`, que desliza de baixo para cima com cantos de `28px` no topo, contendo as opções secundárias (`Cartão de Crédito`, `Extrato`, `Reserva`, `Observações`, `Assistente` e o botão `Sair`).

---

## 🔀 5. Biblioteca de Ícones

*   O projeto adota a biblioteca **Lucide Icons** de forma exclusiva e permanente como padrão estético.
*   O componente [M3Icon.tsx](file:///c:/Users/Yule%20Ribeiro/Documents/IA/BLAISE_APP/frontend/src/components/ui/M3Icon.tsx) clona e renderiza as instâncias SVG de forma limpa.
*   Ícones internos de botões de novas ações utilizam espessura bold (`stroke-width: 3.2px !important`) e herdam sub-tons correspondentes à cor primária de cada seção.

---

## 🛠️ 6. Homologação e Finalização do Redesign
*   O componente de testes temporário (`VisualTester.tsx`) foi **removido permanentemente** do código principal do aplicativo após a calibração final e aprovação do layout pelo usuário.
*   Todas as regras de HSL e tipografia foram consolidadas de forma estática no arquivo [index.css](file:///c:/Users/Yule%20Ribeiro/Documents/IA/BLAISE_APP/frontend/src/index.css), reduzindo o processamento em runtime e eliminando dependências dinâmicas no DOM.
