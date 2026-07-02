# Bottrade — Dashboard de Análise Crypto em Tempo Real

## Resumo

Dashboard web em tempo real para análise técnica automatizada de pares de futuros da Binance. Conecta via WebSocket à Binance, calcula indicadores técnicos (MA, EMA, MACD, StochRSI, Volume), aplica regras de negócio para gerar sinais LONG/SHORT/NEUTRO com score de confluência (0-100), e exibe tudo em interface React com atualizações em tempo real. Persiste histórico de sinais em MySQL. Estrutura preparada para execução de ordens no futuro.

---

## Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Estrutura | Monorepo com workspaces | Tipos compartilhados entre front/back, um npm install |
| Frontend | React + Vite + TailwindCSS + Zustand | Stack moderna, rápido HMR, estado simples |
| Backend | Express + Socket.io + ws | Socket.io para client, ws nativo para Binance |
| Banco de dados | MySQL (XAMPP) | Já disponível no ambiente |
| Autenticação | Nenhuma (uso local) | Apenas um usuário, acesso local |
| Deploy/Dev | Tudo via Node.js | Vite dev server + Express separado |
| API keys Binance | .env (por enquanto) | Sem auth = sem tabela de keys, migra quando implementar ordens |

---

## Estrutura do Projeto

```
bottrade/
├── package.json                    # root workspace
├── tsconfig.base.json              # config TS compartilhada
├── .env                            # DB_HOST, DB_USER, DB_PASS, DB_NAME, PORT, CLIENT_ORIGIN
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── types.ts            # interfaces compartilhadas
│   │
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Express + Socket.io entry
│   │       ├── wsManager.ts        # WebSocket Binance
│   │       ├── calculator.ts       # indicadores técnicos
│   │       ├── signals.ts          # lógica de sinais + score
│   │       ├── database.ts         # MySQL connection + queries
│   │       └── config.ts           # constantes e defaults
│   │
│   └── client/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── store/
│           │   └── useStore.ts     # Zustand
│           ├── hooks/
│           │   └── useSocket.ts    # Socket.io hook
│           ├── components/
│           │   ├── Dashboard.tsx
│           │   ├── PairCard.tsx
│           │   ├── PriceHeader.tsx
│           │   ├── IndicatorPanel.tsx
│           │   ├── SignalPanel.tsx
│           │   ├── RiskPanel.tsx
│           │   ├── AlertToast.tsx
│           │   └── SettingsPanel.tsx
│           └── styles/
│               └── globals.css
```

---

## Tipos Compartilhados (packages/shared/src/types.ts)

```typescript
export interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IndicatorValues {
  ma20: number; ma50: number; ma100: number; ma200: number
  ema20: number; ema50: number
  macd: { macd: number; signal: number; histogram: number; trend: 'bullish' | 'bearish' | 'neutral'; divergence: 'bullish' | 'bearish' | null }
  stochRsi: { k: number; d: number; zone: 'overbought' | 'oversold' | 'neutral'; persistentOverbought: boolean; persistentOversold: boolean }
  volume: { current: number; average: number; isSpike: boolean; candleDirection: 'green' | 'red' }
}

export interface PriceData {
  symbol: string
  price: number
  markPrice: number
  change24h: number
  volume24h: number
  fundingRate: number
  fundingCountdown: string // formato "HH:MM:SS"
}

export interface RiskManagement {
  entry: number
  stopLoss: number
  takeProfit: number
  stopLossPercent: number
  takeProfitPercent: number
  positionSize: number
  margin: number
  riskRewardRatio: number
  leverage: number
}

export interface Alert {
  type: 'direction-change' | 'funding-extreme' | 'stochrsi-extreme' | 'full-alignment'
  symbol: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: number
}

export interface SignalData {
  direction: 'LONG' | 'SHORT' | 'NEUTRO'
  confluenceScore: number
  confidence: 'normal' | 'high'
  alerts: Alert[]
  riskManagement: RiskManagement | null // null quando NEUTRO
  criticalDecision: string
  actionPoints: string[]
  entryTrigger?: string
  reversalTrigger?: string
  overrides: string[]
}

export interface PairAnalysis {
  symbol: string
  candles: CandleData[]
  indicators: IndicatorValues
  price: PriceData
  signal: SignalData
  lastUpdate: number
}

export interface UserSettings {
  baseCapital: number        // padrão R$100
  leverage: number           // padrão 5
  fundingThreshold: number   // padrão 0.05
  stochRsiHighThreshold: number  // padrão 90
  stochRsiLowThreshold: number   // padrão 10
  soundAlerts: boolean
  desktopNotifications: boolean
  pairs: string[]            // padrão ['ETHUSDT', 'BTCUSDT']
}

// Registro de sinal retornado pelo histórico (mapeamento da tabela signals)
export interface SignalRecord {
  id: number
  symbol: string
  direction: 'LONG' | 'SHORT' | 'NEUTRO'
  confluenceScore: number
  confidence: 'normal' | 'high'
  entryPrice: number
  stopLoss: number | null
  takeProfit: number | null
  riskRewardRatio: number | null
  fundingRate: number | null
  criticalDecision: string | null
  actionPoints: string[]
  overrides: string[]
  createdAt: string // ISO 8601
}
```

---

## Banco de Dados (MySQL)

### Tabela: signals

```sql
CREATE TABLE signals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  direction ENUM('LONG', 'SHORT', 'NEUTRO') NOT NULL,
  confluence_score DECIMAL(5,2) NOT NULL,
  confidence ENUM('normal', 'high') NOT NULL DEFAULT 'normal',
  entry_price DECIMAL(18,8) NOT NULL,
  stop_loss DECIMAL(18,8),
  take_profit DECIMAL(18,8),
  risk_reward_ratio DECIMAL(4,2),
  funding_rate DECIMAL(10,6),
  critical_decision TEXT,
  action_points JSON,
  overrides JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_symbol (symbol),
  INDEX idx_created_at (created_at)
);
```

### Tabela: indicator_snapshots

```sql
CREATE TABLE indicator_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  signal_id INT NOT NULL,
  ma20 DECIMAL(18,8), ma50 DECIMAL(18,8),
  ma100 DECIMAL(18,8), ma200 DECIMAL(18,8),
  ema20 DECIMAL(18,8), ema50 DECIMAL(18,8),
  macd_value DECIMAL(18,8), macd_signal DECIMAL(18,8), macd_histogram DECIMAL(18,8),
  macd_divergence VARCHAR(10),
  stoch_k DECIMAL(8,4), stoch_d DECIMAL(8,4),
  stoch_persistent_overbought BOOLEAN DEFAULT FALSE,
  stoch_persistent_oversold BOOLEAN DEFAULT FALSE,
  volume_current DECIMAL(24,8), volume_average DECIMAL(24,8),
  volume_is_spike BOOLEAN DEFAULT FALSE,
  volume_candle_direction ENUM('green', 'red') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_signal_id (signal_id),
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE
);
```

### Tabela: settings

Armazena `UserSettings` como um único registro JSON (key_name='user_settings'). Na leitura, faz parse para `UserSettings`. Na escrita, serializa para JSON string.

```sql
CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(50) UNIQUE NOT NULL,
  value JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## Lógica de Sinais e Score de Confluência

### Pesos

| Indicador | Peso | Lógica |
|-----------|:---:|--------|
| Estrutura de MAs | 25 | Posição do preço em relação às 6 médias |
| MACD | 20 | Histograma + tendência + divergência (bônus ±15) |
| StochRSI | 20 | Posição K/D + cruzamentos + zonas extremas |
| Volume | 15 | Spike + direção do candle |
| Funding Rate | 15 | Magnitude e direção |
| Alinhamento EMA | 5 | EMA20 vs EMA50 |

### Cálculo do Score Base (0-100)

**Estrutura de MAs (0-25):**
- Acima de 6 médias: 25
- Acima de 5: 20
- Acima de 4: 16
- Acima de 3: 12
- Acima de 2: 8
- Acima de 1: 4
- Abaixo de todas: 0

**MACD (0-20):**
- Histograma positivo + crescendo: 20
- Histograma positivo + diminuindo: 14
- Histograma zerado: 10
- Histograma negativo + diminuindo (voltando ao zero): 6
- Histograma negativo + crescendo (mais negativo): 0
- Bônus divergência bullish: +15 ao score total
- Penalidade divergência bearish: -15 ao score total

**StochRSI (0-20):**
- K cruzou acima de D + zona neutra: 20
- K > D + subindo: 16
- K ≈ D: 10
- K < D + caindo: 4
- K cruzou abaixo de D + zona neutra: 0

**Volume (0-15):**
- Spike + candle verde: 15
- Volume normal + candle verde: 10
- Volume normal sem direção clara: 7.5
- Volume normal + candle vermelho: 5
- Spike + candle vermelho: 0

**Funding Rate (0-15):**
- < -0.05%: 15
- -0.05% a 0%: 12
- 0% a +0.03%: 7.5
- +0.03% a +0.05%: 4
- > +0.05%: 0

**Alinhamento EMA (0-5):**
- EMA20 > EMA50 + distância crescendo: 5
- EMA20 > EMA50 + distância diminuindo: 3
- EMA20 ≈ EMA50: 2.5
- EMA20 < EMA50 + distância diminuindo: 2
- EMA20 < EMA50 + distância crescendo: 0

### Pipeline de Cálculo

1. Somar sub-scores de cada indicador → score base (0-100)
2. Aplicar multiplicador de contexto (abaixo)
3. Aplicar bônus/penalidade de divergência MACD (±15) — aplicado após multiplicador para manter o impacto fixo de ±15
4. **Clampar resultado para [0, 100]**: `finalScore = Math.max(0, Math.min(100, score))`
5. Classificar direção e confiança

### Multiplicador de Contexto

- Estrutura bullish (4+ MAs acima) mas score base < 50 → score × 0.7
- Estrutura bearish (4+ MAs abaixo) mas score base > 50 → score × 0.7
- Alinhado → 1.0x

### Classificação

| Score | Direção | Confiança |
|:-----:|---------|-----------|
| [85, 100] | LONG | ALTA |
| [65, 85) | LONG | Normal |
| (35, 65) | NEUTRO | — |
| (15, 35] | SHORT | Normal |
| [0, 15] | SHORT | ALTA |

### Overrides

| Condição | Ação |
|----------|------|
| Funding > +0.10% | Alerta crítico + bloqueia LONG |
| Funding < -0.10% | Alerta crítico + bloqueia SHORT |
| Funding < -0.20% | "FUNDING EXTREMO — não operar short" |
| StochRSI K e D = 100 | Bloqueia novo LONG + sinal de saída |
| StochRSI K = 0 | Bloqueia novo SHORT + "bounce iminente" |
| StochRSI K 90-100 por 3+ candles 15m | Sobrecompra persistente, reduz confiança LONG. Contador incrementa a cada candle fechado com K >= 90, reseta quando K < 90. |
| StochRSI K 0-10 por 3+ candles 15m | Sobrevenda persistente, reduz confiança SHORT. Contador incrementa a cada candle fechado com K <= 10, reseta quando K > 10. |

### Gestão de Risco

**Stop Loss:**
- LONG: MA mais próxima abaixo do preço. Mínimo 0.5% de distância.
- SHORT: MA mais próxima acima do preço. Mínimo 0.5%.
- Fallback (sem MA): 1.5% de distância.

**Take Profit (dinâmico, intervalos half-open):**
- Score [65, 75) ou (25, 35]: R:R 1.5:1
- Score [75, 85) ou (15, 25]: R:R 2:1
- Score [85, 100] ou [0, 15]: R:R 3:1
- Score NEUTRO (35, 65): riskManagement = null (sem sugestão de trade)

**Posição:**
- Tamanho = Capital × Alavancagem
- Margem = Tamanho / Alavancagem
- Score > 85: sugere alavancagem maior (até máximo configurado)

---

## WebSocket e Comunicação

### Binance Streams

Uma conexão WebSocket combinada por par, contendo 3 streams. Símbolos devem ser convertidos para lowercase ao construir a URL (`symbol.toLowerCase()`).

```
wss://fstream.binance.com/stream?streams=
  ethusdt@kline_15m/
  ethusdt@markPrice@1s/
  ethusdt@ticker
```

Limite: Binance permite até 300 conexões WebSocket por IP em Futures.

- `@kline_15m`: processa apenas candles fechados (`kline.x === true`)
- `@markPrice@1s`: mark price, funding rate, `nextFundingTime` (Unix ms). O servidor calcula o countdown: `fundingCountdown = nextFundingTime - Date.now()`, formatado como "HH:MM:SS"
- `@ticker`: preço, variação 24h, volume 24h

### Candles Históricos

Na inicialização e reconexão:
```
GET https://fapi.binance.com/fapi/v1/klines?symbol={SYMBOL}&interval=15m&limit=200
```
Cache em memória com buffer de 250 candles (50 a mais que o necessário para MA200, permitindo histórico de tendência). Novos candles adicionados ao final, remove o mais antigo quando excede 250. Sinais só são gerados após ter no mínimo 200 candles.

### Reconexão com Backoff

```
Tentativa 1: 1s → 2: 2s → 3: 4s → 4: 8s → ... → máximo: 30s
Após reconectar: re-busca 200 candles via REST
```

### Socket.io Events

**Server → Client:**

| Evento | Frequência | Payload |
|--------|-----------|---------|
| `price-update` | ~1s/par | `PriceData` |
| `analysis-update` | 15min (candle fechado) | `PairAnalysis` |
| `alert` | Quando condição atingida | `Alert` |
| `connection-status` | Conexão/desconexão | `{ symbol, connected }` |
| `settings-updated` | Quando config muda | `UserSettings` |
| `state-snapshot` | Na reconexão do client | `PairAnalysis[]` (estado completo de todos os pares ativos) |

**Client → Server:**

| Evento | Payload |
|--------|---------|
| `add-pair` | `{ symbol: string }` |
| `remove-pair` | `{ symbol: string }` |
| `update-settings` | `Partial<UserSettings>` |
| `get-history` | `{ symbol?, limit?, offset? }` → resposta via callback: `{ signals: SignalRecord[], total: number }` |

---

## Tratamento de Erros e Resiliência

### MySQL
- Retry com backoff exponencial em caso de perda de conexão (1s, 2s, 4s, max 30s)
- Se MySQL indisponível: buffer de sinais em memória (máximo 100 registros) e salvar quando reconectar
- Log de erros no console com timestamp

### Binance REST API
- HTTP 429 (rate limit): respeitar header `Retry-After`, aguardar e re-tentar
- HTTP 418 (IP ban): alertar usuário no dashboard, pausar requisições REST
- HTTP 5xx: retry com backoff, máximo 3 tentativas
- Timeout de 10s por requisição

### Binance WebSocket
- Reconexão com backoff (já definido acima)
- Durante desconexão: exibir indicador "DESCONECTADO" no PairCard correspondente, preços ficam acinzentados
- Após reconexão: re-buscar candles via REST para recalcular indicadores antes de gerar novos sinais
- Ping/pong a cada 30s para detectar conexões mortas

### Indicadores
- Não gerar sinais se houver menos de 200 candles (MA200 precisa de 200 data points)
- Exibir "Carregando indicadores..." no card até ter dados suficientes

### Socket.io (client)
- Reconexão automática nativa do Socket.io
- Após reconexão: servidor envia snapshot completo do estado atual de todos os pares
- Exibir indicador de conexão no header (verde = conectado, vermelho = desconectado)

### API Keys Binance
- Não são necessárias para a implementação atual (todos os endpoints usados são públicos)
- Reservadas para futura execução de ordens
- Quando implementadas: armazenar em `.env`, nunca expor ao frontend

---

## CORS

Express e Socket.io configurados com:
```typescript
cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }
```

---

## Frontend

### Tema Visual

- Fundo: #0f0f0f
- Cards: #1a1a1a, borda #2a2a2a
- Verde: #00c896 (LONG, positivos)
- Vermelho: #ff4444 (SHORT, negativos)
- Amarelo: #ffaa00 (alertas, NEUTRO)
- Texto primário: #ffffff
- Texto secundário: #888888
- Font monospace para números

### Componentes

**Dashboard.tsx** — Grid responsivo (1/2/3+ colunas), header com status de conexão, botão de config.

**PairCard.tsx** — Card principal, borda esquerda colorida (verde/vermelho/amarelo conforme sinal). Compõe os 4 sub-componentes.

**PriceHeader.tsx** — Preço com animação de piscar, variação 24h, funding rate com alerta visual, countdown, mark price.

**IndicatorPanel.tsx** — Tabela de MAs/EMAs com ícones (acima/abaixo), MACD com cor e tendência, StochRSI K/D + zona, Volume atual vs média + spike.

**SignalPanel.tsx** — Direção em destaque com cor, barra de score com gradiente, badge "ALTA CONFIANCA", decisão crítica, action points, triggers.

**RiskPanel.tsx** — Entry/SL/TP com valores e %, tamanho da posição, margem, R:R visual.

**SettingsPanel.tsx** — Drawer lateral: capital, alavancagem, pares, thresholds, toggles de som e notificação. Persiste no MySQL.

**AlertToast.tsx** — react-hot-toast com cores do tema. Tipos: mudança de direção, funding extremo, StochRSI extremo, alinhamento total.

### Indicadores Visuais

- Piscar suave no preço quando atualiza
- Barra de score com gradiente vermelho → amarelo → verde
- Ícones: ✅ ⚠️ 🔴 🟢 📌 ⚡

### Performance

- Throttle de UI: máximo 1 atualização/segundo por par
- Virtualização da lista se > 10 pares (futuro, não incluso no v1)
- Cache de candles históricos

---

## Dependências Principais

### Server
- express, socket.io, ws, technicalindicators, axios, mysql2, dotenv

### Client
- react, react-dom, socket.io-client, zustand, react-hot-toast

### Dev
- typescript, vite, tsx, tailwindcss, @types/node

---

## Portas

- Frontend (Vite dev): `localhost:5173`
- Backend (Express): `localhost:${PORT || 3001}` (configurável via .env)
