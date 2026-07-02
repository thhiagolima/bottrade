# Trade Tracking & Assertividade — Design Spec

## Resumo

Sistema de tracking de trades para medir a assertividade dos sinais gerados pelo Bottrade. Um trade é aberto automaticamente quando um sinal de alta confiança é gerado (score ≥85 ou ≤15). O trade é fechado quando o preço atinge TP, SL, ou quando o sinal inverte. O dashboard exibe win rate por par e um histórico completo com métricas de performance.

---

## Fluxo do Trade

```
Sinal LONG/SHORT com alta confiança (score ≥85 ou ≤15)
    │
    ▼
Trade ABERTO (salva entry, SL, TP, timestamp)
    │                              máximo 1 trade aberto por símbolo
    ├─ Preço atinge TP  → CLOSED (WIN, P&L = TP distance %)
    ├─ Preço atinge SL  → CLOSED (LOSS, P&L = SL distance %)
    └─ Sinal inverte    → CLOSED (REVERSED, P&L = (exitPrice - entryPrice) / entryPrice %)
```

**Regras:**
- Máximo 1 trade aberto por símbolo ao mesmo tempo
- Só abre trade com `confidence === 'high'` (score ≥85 LONG ou ≤15 SHORT)
- "Sinal inverte" = direção muda de LONG para SHORT ou vice-versa (NEUTRO não fecha)
- P&L para LONG: `(exit - entry) / entry * 100`
- P&L para SHORT: `(entry - exit) / entry * 100`
- Verificação de TP/SL ocorre a cada `price-update` (~1s) contra `price.price` (last trade price)

---

## Sistema de Recomendações em Tempo Real

Quando há um trade aberto, o sistema gera **recomendações ativas** baseadas nos indicadores atuais. A cada `analysis-update` (candle fechado), o tradeTracker avalia o trade aberto e emite uma recomendação.

### Tipos de Recomendação

| Tipo | Condição | Mensagem exemplo |
|------|----------|------------------|
| `HOLD` | Indicadores alinhados com a direção do trade | "Manter posição — momentum e estrutura confirmam direção" |
| `PARTIAL_50` | Sinais de enfraquecimento (2+ indicadores divergindo) | "Cogitar realizar 50% — StochRSI em sobrecompra persistente, MACD perdendo momentum" |
| `PARTIAL_75` | Sinais claros de reversão parcial (3+ indicadores contra) | "Realizar 75% — divergência bearish no MACD, volume spike contra, funding extremo" |
| `CLOSE_100` | Sinais claros de reversão total (score cruzou para zona oposta) | "Realizar 100% da posição — sinais claros de reversão: score caiu para zona SHORT" |
| `MOVE_SL` | Preço avançou significativamente a favor (>50% do caminho ao TP) | "Mover Stop Loss para breakeven ($X) — proteger lucro parcial" |

### Lógica de Avaliação

Para um trade LONG aberto, a cada candle fechado:

1. **P&L atual**: calcular % de lucro/prejuízo unrealizado
2. **Contagem de sinais contra**: quantos dos seguintes estão contra:
   - MACD histograma virando negativo/perdendo momentum
   - StochRSI em sobrecompra persistente (3+ candles)
   - Divergência bearish detectada
   - Volume spike com candle vermelho
   - Funding rate extremo contra a posição (>0.10% para LONG)
   - Score caiu abaixo de 65 (saiu da zona LONG)
3. **Gerar recomendação**:
   - 0 sinais contra → `HOLD`
   - 1 sinal contra → `HOLD` com nota de cautela
   - 2 sinais contra → `PARTIAL_50`
   - 3 sinais contra → `PARTIAL_75`
   - 4+ sinais contra OU score na zona oposta → `CLOSE_100`
   - P&L > 50% do caminho ao TP e 0-1 sinais contra → `MOVE_SL`

(Lógica invertida para SHORT)

### Interface

```typescript
export interface TradeRecommendation {
  type: 'HOLD' | 'PARTIAL_50' | 'PARTIAL_75' | 'CLOSE_100' | 'MOVE_SL'
  message: string
  reasons: string[]           // lista de indicadores que motivaram
  unrealizedPnl: number       // P&L % atual
  suggestedAction: string     // texto direto: "Manter", "Realizar 50%", etc.
  newStopLoss?: number        // para MOVE_SL: novo SL sugerido (breakeven)
}
```

### Exibição no PairCard

Quando há trade aberto, exibir abaixo do badge de trade:
- Cor por tipo: verde (HOLD), amarelo (PARTIAL_50, MOVE_SL), laranja (PARTIAL_75), vermelho (CLOSE_100)
- Ícone + texto da recomendação
- Lista de razões colapsável
- P&L unrealizado em destaque

### Socket.io Event

- `'trade-recommendation'`: `{ symbol: string, recommendation: TradeRecommendation }` — emitido a cada analysis-update se tem trade aberto

---

## Banco de Dados

### Tabela: trades

```sql
CREATE TABLE IF NOT EXISTS trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  direction ENUM('LONG', 'SHORT') NOT NULL,
  entry_price DECIMAL(18,8) NOT NULL,
  stop_loss DECIMAL(18,8) NOT NULL,
  take_profit DECIMAL(18,8) NOT NULL,
  exit_price DECIMAL(18,8),
  result ENUM('WIN', 'LOSS', 'REVERSED'),
  pnl_percent DECIMAL(8,4),
  confluence_score DECIMAL(5,2) NOT NULL,
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_opened_at (opened_at)
);
```

---

## Backend

### Novo módulo: `packages/server/src/tradeTracker.ts`

**Estado em memória:**
```typescript
Map<string, Trade> // trades abertos, chave = symbol
```

**Interface Trade (adicionar ao shared/types.ts):**
```typescript
export interface Trade {
  id?: number
  symbol: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  stopLoss: number
  takeProfit: number
  exitPrice: number | null
  result: 'WIN' | 'LOSS' | 'REVERSED' | null
  pnlPercent: number | null
  confluenceScore: number
  status: 'OPEN' | 'CLOSED'
  openedAt: string // ISO 8601
  closedAt: string | null
}

export interface TradeRecommendation {
  type: 'HOLD' | 'PARTIAL_50' | 'PARTIAL_75' | 'CLOSE_100' | 'MOVE_SL'
  message: string
  reasons: string[]
  unrealizedPnl: number
  suggestedAction: string
  newStopLoss?: number
}

export interface TradeStats {
  symbol: string | null // null = global
  totalTrades: number
  wins: number
  losses: number
  reversed: number
  winRate: number // 0-100
  avgWinPnl: number
  avgLossPnl: number
  bestTrade: number // best P&L %
  worstTrade: number // worst P&L %
}
```

**Funções:**

```typescript
export class TradeTracker {
  // Chamado quando generateSignal retorna um novo sinal (a cada candle fechado)
  checkSignalForTrade(symbol: string, signal: SignalData, currentPrice: number): void
  // - Se signal.confidence === 'high' e riskManagement !== null e sem trade aberto para symbol:
  //   abre trade, salva no MySQL, emite 'trade-opened'
  // - Se sinal inverteu (trade aberto é LONG e novo sinal é SHORT, ou vice-versa):
  //   fecha trade com resultado REVERSED, salva, emite 'trade-closed'
  // - Se tem trade aberto: gera recomendação e emite 'trade-recommendation'

  // Chamado a cada price-update
  checkPriceForExits(symbol: string, currentPrice: number): void
  // - Se tem trade aberto para symbol:
  //   LONG: price >= takeProfit → WIN; price <= stopLoss → LOSS
  //   SHORT: price <= takeProfit → WIN; price >= stopLoss → LOSS
  //   Fecha trade, salva, emite 'trade-closed'

  // Gera recomendação para trade aberto baseado nos indicadores atuais
  generateRecommendation(trade: Trade, signal: SignalData, indicators: IndicatorValues, price: PriceData): TradeRecommendation
  // - Conta sinais contra a direção do trade (MACD, StochRSI, divergência, volume, funding, score)
  // - 0 contra → HOLD; 2 contra → PARTIAL_50; 3 contra → PARTIAL_75; 4+ → CLOSE_100
  // - P&L > 50% do TP e poucos sinais contra → MOVE_SL (breakeven)

  // Buscar trades do MySQL
  getOpenTrades(): Promise<Trade[]>
  getTradeHistory(symbol?: string, limit?: number, offset?: number): Promise<{ trades: Trade[], total: number }>
  getStats(symbol?: string): Promise<TradeStats>
}
```

### Alterações em `database.ts`

Adicionar funções:
- `createTradesTable()`: CREATE TABLE IF NOT EXISTS (chamado no initDatabase)
- `insertTrade(trade)`: INSERT, retorna id
- `closeTrade(id, exitPrice, result, pnlPercent)`: UPDATE status=CLOSED, set exit fields
- `getOpenTrades()`: SELECT WHERE status='OPEN'
- `getTradeHistory(symbol?, limit, offset)`: SELECT com paginação
- `getTradeStats(symbol?)`: queries agregadas para calcular TradeStats

### Alterações em `index.ts`

- Instanciar TradeTracker no boot
- No handler `candle-closed` (após generateSignal): chamar `tradeTracker.checkSignalForTrade()`
- No handler `price-update`: chamar `tradeTracker.checkPriceForExits()`
- Novos Socket.io events emitidos pelo TradeTracker:
  - `'trade-opened'`: `Trade`
  - `'trade-closed'`: `Trade`
  - `'trade-recommendation'`: `{ symbol, recommendation: TradeRecommendation }`
- Novo Socket.io handler:
  - `'get-trade-history'`: `{ symbol?, limit?, offset? }` → callback `{ trades, total }`
  - `'get-trade-stats'`: `{ symbol? }` → callback `TradeStats`
- No `state-snapshot`: incluir trades abertos e stats globais

---

## Frontend

### Store (useStore.ts) — novos campos

```typescript
openTrades: Record<string, Trade>       // trade aberto por símbolo
tradeStats: Record<string, TradeStats>  // stats por símbolo
globalStats: TradeStats | null          // stats globais
historyOpen: boolean                    // drawer de histórico aberto
```

### Socket Hook (useSocket.ts) — novos listeners

- `'trade-opened'`: adiciona ao openTrades
- `'trade-closed'`: remove de openTrades, atualiza stats

### PairCard — mini win rate

Abaixo do SignalPanel, nova linha:
- Se tem trade aberto: badge verde/vermelho `TRADE ABERTO: LONG @ $2,153.00` com P&L unrealizado
- Win rate do par: `Win Rate: 75% (6/8)` em texto muted
- Se sem trades: `Sem histórico de trades`

### Novo componente: `TradeHistoryDrawer.tsx`

Abre ao clicar num botão "Histórico" no header (ao lado do gear).

**Métricas no topo:**
- Win Rate geral: X%
- Total / Wins / Losses / Reversed
- P&L médio wins vs losses
- Melhor / Pior trade

**Filtro:**
- Select por par (ou "Todos")

**Tabela:**
| Símbolo | Direção | Entry | Exit | Resultado | P&L% | Data |
|---------|---------|-------|------|-----------|------|------|

- WIN: texto verde
- LOSS: texto vermelho
- REVERSED: texto amarelo
- Paginação (20 por página)

---

## Socket.io Events (adicionais)

**Server → Client:**
| Evento | Payload |
|--------|---------|
| `trade-opened` | `Trade` |
| `trade-closed` | `Trade` |

**Client → Server:**
| Evento | Payload |
|--------|---------|
| `get-trade-history` | `{ symbol?, limit?, offset? }` → callback `{ trades: Trade[], total }` |
| `get-trade-stats` | `{ symbol? }` → callback `TradeStats` |
