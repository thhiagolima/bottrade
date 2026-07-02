interface TermsProps {
  onBack: () => void
}

export default function TermsOfService({ onBack }: TermsProps) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-card-border transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-display text-xl font-bold">Termos de Uso</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8 font-body text-sm leading-relaxed text-muted">
        <div className="bg-card border border-card-border rounded-lg p-6 md:p-8 space-y-8">

          <div className="text-center space-y-2">
            <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Termos de Uso do Bottrade</h1>
            <p className="text-xs text-muted">Ultima atualizacao: 26 de marco de 2026</p>
          </div>

          {/* 1 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">1. Definicoes</h2>
            <p><strong className="text-[var(--color-text)]">"Bottrade"</strong> refere-se a plataforma de analise de criptomoedas operada pela Bottrade Tecnologia, incluindo o site, aplicacao web, APIs e todos os servicos relacionados.</p>
            <p><strong className="text-[var(--color-text)]">"Servico"</strong> refere-se a todas as funcionalidades oferecidas pela plataforma, incluindo: monitoramento de pares, analise tecnica automatizada, sistema de pontuacao de confluencia (Confluence Score), planejamento de risco, paper tracking, backtesting, alertas e integracao opcional com exchanges de criptomoedas.</p>
            <p><strong className="text-[var(--color-text)]">"Usuario"</strong> refere-se a qualquer pessoa fisica ou juridica que crie uma conta e utilize o Servico.</p>
            <p><strong className="text-[var(--color-text)]">"Exchange"</strong> refere-se a plataformas de terceiros (como Binance) utilizadas para negociacao de criptomoedas.</p>
          </section>

          {/* 2 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">2. Aceitacao dos Termos</h2>
            <p>Ao criar uma conta no Bottrade, voce declara ter lido, compreendido e concordado com estes Termos de Uso em sua integralidade. Caso nao concorde com qualquer disposicao, nao utilize o Servico.</p>
            <p>O uso continuado da plataforma apos alteracoes nos termos constitui aceitacao tacita das modificacoes.</p>
          </section>

          {/* 3 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">3. Descricao do Servico</h2>
            <p>O Bottrade e uma <strong className="text-[var(--color-text)]">ferramenta de analise tecnica de criptomoedas</strong>. O Servico inclui:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Monitoramento em tempo real de pares de criptomoedas (futuros perpetuos)</li>
              <li>Calculo automatico de indicadores tecnicos (RSI, MACD, StochRSI, Bollinger Bands, ADX, ATR, entre outros)</li>
              <li>Sistema de pontuacao de confluencia (0-100) que agrega multiplos indicadores</li>
              <li>Leituras direcionais (LONG/SHORT/NEUTRO) baseadas em analise tecnica</li>
              <li>Calculadora de risco com estimativas de Stop Loss e Take Profit</li>
              <li>Paper Trading (simulacao sem dinheiro real)</li>
              <li>Backtesting com dados historicos</li>
              <li>Execucao por API da exchange como recurso avancado e opcional</li>
            </ul>
            <div className="bg-warn/10 border border-warn/30 rounded-lg p-4 text-warn text-xs leading-relaxed">
              <strong>IMPORTANTE:</strong> O Bottrade NAO e uma corretora, consultoria financeira, ou empresa de investimentos. O Servico NAO constitui recomendacao de investimento, aconselhamento financeiro ou oferta de valores mobiliarios.
            </div>
          </section>

          {/* 4 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">4. Contas de Usuario</h2>
            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">4.1 Registro</h3>
            <p>Para utilizar o Servico, voce deve criar uma conta fornecendo informacoes precisas, completas e atualizadas. Voce e responsavel por manter a exatidao dessas informacoes.</p>
            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">4.2 Seguranca da Conta</h3>
            <p>Voce e o unico responsavel por manter a confidencialidade de suas credenciais de acesso (email e senha). Qualquer atividade realizada em sua conta sera de sua responsabilidade.</p>
            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">4.3 Idade Minima</h3>
            <p>O Servico e destinado exclusivamente a maiores de 18 anos. Ao criar uma conta, voce declara ter pelo menos 18 anos de idade.</p>
          </section>

          {/* 5 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">5. Planos e Pagamento</h2>
            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">5.1 Planos Disponiveis</h3>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-[var(--color-text)]">Free:</strong> Acesso limitado com ate 3 pares monitorados e indicadores basicos.</li>
              <li><strong className="text-[var(--color-text)]">Pro (R$49/mes):</strong> Pares ilimitados, multi-timeframe, paper trading, backtesting, alertas Telegram.</li>
              <li><strong className="text-[var(--color-text)]">Trader (R$99/mes):</strong> Todas as funcionalidades Pro + recursos avancados de execucao por API, mediante configuracao manual.</li>
            </ul>
            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">5.2 Cobranca</h3>
            <p>Os planos pagos sao cobrados de forma recorrente (mensal) via Stripe. A cobranca e realizada automaticamente na data de renovacao.</p>
            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">5.3 Cancelamento</h3>
            <p>Voce pode cancelar seu plano a qualquer momento pelo dashboard. O acesso as funcionalidades do plano permanece ativo ate o final do periodo ja pago. Nao ha reembolso proporcional.</p>
          </section>

          {/* 6 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">6. API Keys de Exchange</h2>
            <p>O Bottrade permite que voce conecte sua conta de exchange (ex: Binance) fornecendo suas API Keys. Ao fazer isso, voce declara e concorda que:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>As API Keys sao fornecidas voluntariamente e sob sua inteira responsabilidade.</li>
              <li>Voce e o unico responsavel por configurar as permissoes corretas nas API Keys (recomendamos permissoes apenas de trading, sem permissao de saque).</li>
              <li>O Bottrade armazena suas API Keys de forma criptografada (AES-256), mas nao se responsabiliza por acessos nao autorizados decorrentes de violacao de suas proprias credenciais.</li>
              <li>Ordens enviadas por integracoes de API configuradas por voce sao de sua exclusiva responsabilidade.</li>
              <li>O Bottrade NAO garante a execucao correta, no tempo adequado, ou ao preco esperado de qualquer ordem.</li>
            </ul>
          </section>

          {/* 7 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">7. Isencao de Responsabilidade</h2>
            <div className="bg-bear/10 border border-bear/30 rounded-lg p-4 space-y-3 text-xs leading-relaxed">
              <p className="text-bear font-bold uppercase text-sm">AVISO CRITICO DE RISCO</p>
              <ul className="list-disc list-inside space-y-2 text-bear/90">
                <li><strong>Trading de criptomoedas envolve risco significativo de perda financeira.</strong> Voce pode perder parte ou todo o seu capital investido.</li>
                <li><strong>O Bottrade e exclusivamente uma ferramenta de monitoramento e analise tecnica.</strong> Nenhuma leitura, pontuacao, recomendacao ou informacao fornecida pelo Servico constitui recomendacao de investimento ou aconselhamento financeiro.</li>
                <li><strong>Resultados passados NAO garantem resultados futuros.</strong> Resultados de backtesting e paper trading sao simulacoes e nao refletem necessariamente o desempenho em condicoes reais de mercado.</li>
                <li><strong>O usuario e o unico responsavel por suas decisoes de trading.</strong> Ao utilizar leituras, pontuacoes ou funcionalidades do Bottrade para tomar decisoes de investimento, voce assume total responsabilidade pelos resultados.</li>
                <li><strong>O Bottrade nao e regulado por nenhuma autoridade financeira</strong> (CVM, BACEN, SEC ou equivalentes). O Servico nao se enquadra como atividade regulada de intermediacao financeira.</li>
                <li><strong>Integracoes de execucao por API operam por sua conta e risco.</strong> Ordens podem ser executadas em condicoes adversas de mercado, com slippage, em momentos de alta volatilidade ou com falhas de conectividade.</li>
              </ul>
            </div>
          </section>

          {/* 8 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">8. Limitacao de Responsabilidade</h2>
            <p>Na maxima extensao permitida pela lei:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>O Bottrade <strong className="text-[var(--color-text)]">nao se responsabiliza por quaisquer perdas financeiras</strong> diretas, indiretas, incidentais, consequenciais ou punitivas decorrentes do uso do Servico.</li>
              <li>O Bottrade nao garante disponibilidade ininterrupta, livre de erros ou totalmente segura do Servico.</li>
              <li>O Bottrade nao se responsabiliza por falhas de terceiros, incluindo exchanges, provedores de dados ou servicos de pagamento.</li>
              <li>A responsabilidade total do Bottrade, em qualquer circunstancia, esta limitada ao valor pago pelo Usuario nos ultimos 12 meses de assinatura.</li>
            </ul>
          </section>

          {/* 9 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">9. Propriedade Intelectual</h2>
            <p>Todo o conteudo do Bottrade, incluindo mas nao limitado a:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Algoritmo de calculo do Confluence Score e Heat Score</li>
              <li>Interface de usuario, design e layout</li>
              <li>Codigo-fonte, APIs e documentacao tecnica</li>
              <li>Marca, logotipo e identidade visual</li>
            </ul>
            <p>Sao de propriedade exclusiva do Bottrade e estao protegidos pela legislacao brasileira de direitos autorais e propriedade intelectual.</p>
          </section>

          {/* 10 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">10. Uso Aceitavel</h2>
            <p>Ao utilizar o Servico, voce concorda em NAO:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Utilizar o Servico para manipulacao de mercado ou qualquer atividade ilegal.</li>
              <li>Realizar engenharia reversa, descompilar ou tentar extrair o codigo-fonte do Servico.</li>
              <li>Compartilhar suas credenciais de acesso com terceiros.</li>
              <li>Utilizar bots, scrapers ou ferramentas automatizadas para acessar o Servico de forma nao autorizada.</li>
              <li>Sobrecarregar intencionalmente os servidores ou infraestrutura do Bottrade.</li>
              <li>Revender, sublicenciar ou redistribuir o acesso ao Servico.</li>
            </ul>
          </section>

          {/* 11 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">11. Privacidade</h2>
            <p>O tratamento de seus dados pessoais e regido pela nossa Politica de Privacidade, disponivel separadamente. A Politica de Privacidade e parte integrante destes Termos de Uso.</p>
          </section>

          {/* 12 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">12. Modificacoes dos Termos</h2>
            <p>O Bottrade reserva-se o direito de alterar estes Termos de Uso a qualquer momento. Alteracoes significativas serao comunicadas com pelo menos <strong className="text-[var(--color-text)]">30 dias de antecedencia</strong> por email ou notificacao na plataforma.</p>
            <p>O uso continuado do Servico apos o periodo de aviso constitui aceitacao dos novos termos.</p>
          </section>

          {/* 13 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">13. Rescisao</h2>
            <p>O Bottrade podera, a seu exclusivo criterio, suspender ou encerrar a conta de qualquer Usuario que:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Viole qualquer disposicao destes Termos de Uso.</li>
              <li>Utilize o Servico para atividades ilegais ou fraudulentas.</li>
              <li>Prejudique o funcionamento da plataforma ou a experiencia de outros usuarios.</li>
            </ul>
            <p>Em caso de rescisao por violacao, nao havera direito a reembolso de valores pagos.</p>
          </section>

          {/* 14 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">14. Lei Aplicavel e Foro</h2>
            <p>Estes Termos de Uso sao regidos e interpretados de acordo com as leis da Republica Federativa do Brasil.</p>
            <p>Fica eleito o foro da comarca de Sao Paulo/SP para dirimir quaisquer controversias decorrentes destes Termos, com renuncia a qualquer outro, por mais privilegiado que seja.</p>
          </section>

          {/* 15 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">15. Contato</h2>
            <p>Para questoes relacionadas a estes Termos de Uso, entre em contato:</p>
            <p className="text-[var(--color-accent)] font-mono-num">legal@bottrade.com</p>
          </section>

        </div>
      </main>
    </div>
  )
}
