# Sidebar + Detalhe Layout — Design Spec

## Resumo

Reestruturação do layout do dashboard de grid de cards para sidebar colapsável + área de detalhe. A sidebar lista todos os pares monitorados como mini-cards com preço, direção e score. A área de detalhe exibe o par selecionado com gráfico candlestick, indicadores, sinal, gestão de risco, recomendação e histórico de trades.

---

## Estrutura do Layout

```
┌──────────────────────────────────────────────────────────┐
│  HEADER: "Bottrade" ● | [Histórico] [⚙]                 │
├────────────┬─────────────────────────────────────────────┤
│  SIDEBAR   │  ÁREA DE DETALHE (par selecionado)          │
│  colapsável│                                             │
│  220px ↔   │  Header: símbolo, preço, mark, funding      │
│  48px      │  Gráfico: candlestick 15min + MAs overlay   │
│            │  Grid: indicadores | gestão de risco         │
│  mini-cards│  Sinal + recomendação de trade               │
│  por par   │  Histórico de trades do par                  │
└────────────┴─────────────────────────────────────────────┘
```

---

## Sidebar (`AppSidebar.tsx`)

### Estado Expandido (largura: 220px)

- **Logo** "Bottrade" no topo
- **Mini-cards** por par, cada um com:
  - Símbolo (BTCUSDT)
  - Preço atual formatado
  - Variação 24h (verde/vermelho)
  - Badge de direção: LONG (verde), SHORT (vermelho), NEUTRO (amarelo)
  - Score numérico
  - Mini barra de score com gradiente (vermelho→amarelo→verde)
  - Borda esquerda colorida pela direção
- **Par selecionado** tem fundo diferente (`bg-card-border` ou similar)
- **Botão "+ Adicionar par"** no final da lista — abre o dropdown de busca de pares (reutilizar lógica do SettingsPanel)
- **Botão de colapsar** (ícone seta ←) no rodapé da sidebar

### Estado Colapsado (largura: 48px)

- Símbolos curtos verticais (BTC, ETH, SOL) — usar os 3-4 primeiros caracteres do symbol antes de "USDT"
- Bolinha de cor ao lado indicando direção do sinal
- **Tooltip no hover** com preço e score
- **Botão de expandir** (ícone seta →)

### Interação

- Clicar num par na sidebar → seleciona e atualiza a área de detalhe
- Estado `selectedPair` no Zustand store
- Default: seleciona o primeiro par da lista
- Transição de expandido/colapsado com animação CSS (transition width)

---

## Área de Detalhe (`PairDetail.tsx`)

Exibe informações completas do par selecionado. Recebe `PairAnalysis` do store.

### Seções (de cima para baixo):

#### 1. Header do Par

Linha única com:
- Símbolo grande e bold
- Preço atual (font-mono-num, grande) com animação de piscar
- Mark price (menor, muted)
- Variação 24h (verde/vermelho)
- Funding rate com cor e countdown
- Volume 24h
- Badge de direção (LONG/SHORT/NEUTRO)

#### 2. Gráfico Candlestick (`CandlestickChart.tsx`)

Usa `lightweight-charts` (TradingView):
- **Tipo:** CandlestickSeries
- **Timeframe:** 15 minutos
- **Dados:** candles do buffer do server (enviados via state-snapshot ou novo evento)
- **Overlays:** LineSeries para MA20 (azul), MA50 (laranja), MA200 (branco)
- **Altura:** ~300px
- **Atualização em tempo real:**
  - A cada `price-update`: atualizar último candle (open candle em construção)
  - A cada `analysis-update`: adicionar novo candle fechado
- **Cores:** candle up = #00c896 (bull), candle down = #ff4444 (bear), background = #0f0f0f
- **Redimensionável:** ajustar ao resize da janela

**Dados necessários do server:**
- O `state-snapshot` e `analysis-update` já enviam `PairAnalysis` com campo `candles: CandleData[]`
- Atualmente o server envia `candles: []` para economizar banda
- **Alterar:** enviar os últimos 100 candles no `state-snapshot` e no `analysis-update` (apenas para o par solicitado ou todos)

#### 3. Grid Indicadores + Risco

Layout em 2 colunas (mesmo conteúdo do IndicatorPanel e RiskPanel atuais, mas com mais espaço):

**Coluna esquerda — Indicadores:**
- Tabela de MAs/EMAs com status (✅/🔴)
- MACD: histograma, trend, divergência
- StochRSI: K/D, zona, persistente
- Volume: atual vs média, spike

**Coluna direita — Gestão de Risco:**
- Entry, SL (vermelho), TP (verde) com %
- R:R ratio
- Posição, margem, alavancagem

#### 4. Sinal + Recomendação

- Badge de direção + score bar (como SignalPanel atual)
- "ALTA CONFIANÇA" badge se aplicável
- Decisão crítica + action points
- Overrides como badges amarelos
- **Se trade aberto:** badge com tipo/preço + P&L unrealizado + recomendação colorida

#### 5. Histórico de Trades do Par (`PairTradeHistory.tsx`)

Mini-tabela compacta:
- Win Rate em destaque: "Win Rate: 75% (6/8)"
- Últimos 5 trades do par: direção, entry, exit, resultado (WIN/LOSS/REVERSED), P&L%
- Link "Ver todos" que abre o TradeHistoryDrawer filtrado por este par

---

## Alterações no Server

### `index.ts`

- Incluir candles no `state-snapshot` e `analysis-update`:
  - Enviar os últimos 100 candles (não todos os 250) para economia de banda
  - `candles: wsManager.getCandles(symbol).slice(-100)` em vez de `candles: []`

### Novo evento Socket.io (opcional)

- `'get-candles'`: `{ symbol }` → callback `CandleData[]` — para quando o client muda de par e precisa dos candles históricos daquele par

---

## Alterações no Client

### Store (`useStore.ts`)

Novos campos:
```typescript
selectedPair: string | null      // par selecionado na sidebar
sidebarCollapsed: boolean        // sidebar expandida/colapsada
```

Novas actions:
```typescript
selectPair: (symbol: string) => void
toggleSidebar: () => void
```

### Socket Hook (`useSocket.ts`)

- Novo helper: `emitGetCandles(symbol, callback)` — buscar candles de um par

### Componentes

| Componente | Ação |
|-----------|------|
| `AppSidebar.tsx` | **NOVO** — sidebar colapsável com mini-cards |
| `SidebarPairCard.tsx` | **NOVO** — mini-card de par na sidebar |
| `PairDetail.tsx` | **NOVO** — área de detalhe do par selecionado |
| `CandlestickChart.tsx` | **NOVO** — gráfico com lightweight-charts |
| `PairTradeHistory.tsx` | **NOVO** — mini-tabela de trades do par |
| `Dashboard.tsx` | **ALTERAR** — layout flex com sidebar + detalhe |
| `PairCard.tsx` | **MANTER** — pode ser reutilizado em PairDetail ou removido |

### Dependência Nova

```bash
npm install --workspace=packages/client lightweight-charts
```

---

## Responsividade

- **Desktop (>1024px):** sidebar expandida + detalhe
- **Tablet (768-1024px):** sidebar colapsada por padrão + detalhe
- **Mobile (<768px):** sidebar vira drawer overlay, detalhe ocupa tela cheia
