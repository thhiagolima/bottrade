interface PrivacyProps {
  onBack: () => void
}

export default function PrivacyPolicy({ onBack }: PrivacyProps) {
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
          <h1 className="font-display text-xl font-bold">Politica de Privacidade</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8 font-body text-sm leading-relaxed text-muted">
        <div className="bg-card border border-card-border rounded-lg p-6 md:p-8 space-y-8">

          <div className="text-center space-y-2">
            <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Politica de Privacidade do Bottrade</h1>
            <p className="text-xs text-muted">Ultima atualizacao: 26 de marco de 2026</p>
            <p className="text-xs text-muted">Em conformidade com a Lei Geral de Protecao de Dados (LGPD - Lei n. 13.709/2018)</p>
          </div>

          {/* 1 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">1. Dados Coletados</h2>
            <p>O Bottrade coleta e processa os seguintes dados:</p>

            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">1.1 Dados de Cadastro</h3>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Nome completo</li>
              <li>Endereco de email</li>
              <li>Senha (armazenada com hash bcrypt)</li>
            </ul>

            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">1.2 Dados de Configuracao</h3>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Configuracoes de trading (capital base, alavancagem, thresholds de indicadores)</li>
              <li>Pares favoritos e preferencias de visualizacao</li>
              <li>Configuracoes de alertas e notificacoes</li>
              <li>Preferencia de tema (claro/escuro)</li>
            </ul>

            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">1.3 Dados de Uso</h3>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Historico de leituras tecnicas geradas</li>
              <li>Historico de trades (paper trading e reais)</li>
              <li>Resultados de backtesting</li>
              <li>Logs de auditoria (acoes realizadas na plataforma)</li>
            </ul>

            <h3 className="font-display text-sm font-bold text-[var(--color-text)]">1.4 Dados Sensiveis</h3>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>API Keys de exchange (armazenadas com criptografia AES-256)</li>
              <li>Token de bot Telegram (armazenado com criptografia AES-256)</li>
              <li>Chat ID do Telegram</li>
            </ul>
          </section>

          {/* 2 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">2. Finalidade do Tratamento</h2>
            <p>Os dados coletados sao utilizados para as seguintes finalidades:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-[var(--color-text)]">Fornecimento do Servico:</strong> Gerar analises, leituras tecnicas, calcular scores e executar funcionalidades contratadas.</li>
              <li><strong className="text-[var(--color-text)]">Melhoria de Algoritmos:</strong> Dados anonimizados e agregados podem ser utilizados para aprimorar os algoritmos de analise (sem identificacao individual).</li>
              <li><strong className="text-[var(--color-text)]">Suporte ao Usuario:</strong> Atendimento a solicitacoes e resolucao de problemas tecnicos.</li>
              <li><strong className="text-[var(--color-text)]">Comunicacoes:</strong> Envio de notificacoes sobre o Servico, alteracoes nos termos e atualizacoes relevantes.</li>
              <li><strong className="text-[var(--color-text)]">Seguranca:</strong> Deteccao de fraudes, abusos e protecao da plataforma.</li>
            </ul>
          </section>

          {/* 3 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">3. Base Legal (LGPD)</h2>
            <p>O tratamento de dados pessoais pelo Bottrade fundamenta-se nas seguintes bases legais previstas na LGPD:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-[var(--color-text)]">Consentimento (Art. 7o, I):</strong> Ao criar sua conta, voce consente expressamente com o tratamento de seus dados conforme descrito nesta politica.</li>
              <li><strong className="text-[var(--color-text)]">Execucao de Contrato (Art. 7o, V):</strong> O tratamento e necessario para a execucao do contrato de prestacao de servicos (Termos de Uso).</li>
              <li><strong className="text-[var(--color-text)]">Interesse Legitimo (Art. 7o, IX):</strong> Para fins de seguranca da plataforma e prevencao de fraudes.</li>
            </ul>
          </section>

          {/* 4 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">4. Armazenamento e Seguranca</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Dados sao armazenados em banco de dados MySQL com acesso restrito.</li>
              <li>Dados sensiveis (API Keys, tokens) sao criptografados com <strong className="text-[var(--color-text)]">AES-256</strong> antes do armazenamento.</li>
              <li>Senhas sao armazenadas com hash bcrypt (nunca em texto puro).</li>
              <li>Backups sao realizados periodicamente e armazenados de forma segura.</li>
              <li>Acesso ao banco de dados e restrito por firewall e autenticacao.</li>
            </ul>
          </section>

          {/* 5 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">5. Compartilhamento de Dados</h2>
            <div className="bg-bull/10 border border-bull/30 rounded-lg p-4 text-xs leading-relaxed">
              <strong className="text-bull">O Bottrade NAO vende, aluga ou comercializa seus dados pessoais.</strong>
            </div>
            <p>Seus dados podem ser compartilhados apenas com:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-[var(--color-text)]">Stripe:</strong> Processamento de pagamentos (apenas dados necessarios para cobranca).</li>
              <li><strong className="text-[var(--color-text)]">Telegram:</strong> Envio de alertas, apenas se configurado voluntariamente pelo usuario.</li>
              <li><strong className="text-[var(--color-text)]">Binance / Exchanges:</strong> Execucao de ordens, apenas se o usuario fornecer suas API Keys e ativar a execucao por API.</li>
            </ul>
            <p>Nenhum terceiro tem acesso a seus dados de analise, historico de leituras ou configuracoes de acompanhamento.</p>
          </section>

          {/* 6 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">6. Medidas de Seguranca</h2>
            <p>O Bottrade adota as seguintes medidas tecnicas de seguranca:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-[var(--color-text)]">Autenticacao Clerk:</strong> Sessoes gerenciadas e tokens de acesso com expiracao para autenticacao segura.</li>
              <li><strong className="text-[var(--color-text)]">Criptografia AES-256:</strong> Para dados sensiveis (API Keys, tokens de integracao).</li>
              <li><strong className="text-[var(--color-text)]">Rate Limiting:</strong> Protecao contra ataques de forca bruta e abuso de endpoints.</li>
              <li><strong className="text-[var(--color-text)]">Audit Logging:</strong> Registro de acoes criticas para rastreabilidade.</li>
              <li><strong className="text-[var(--color-text)]">HTTPS:</strong> Toda comunicacao entre cliente e servidor e criptografada via TLS.</li>
              <li><strong className="text-[var(--color-text)]">WebSocket Seguro:</strong> Conexoes em tempo real autenticadas e criptografadas.</li>
            </ul>
          </section>

          {/* 7 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">7. Direitos do Titular (LGPD)</h2>
            <p>Em conformidade com a LGPD, voce tem os seguintes direitos sobre seus dados pessoais:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong className="text-[var(--color-text)]">Acesso:</strong> Solicitar informacoes sobre quais dados pessoais sao tratados.</li>
              <li><strong className="text-[var(--color-text)]">Retificacao:</strong> Solicitar a correcao de dados incompletos, inexatos ou desatualizados.</li>
              <li><strong className="text-[var(--color-text)]">Exclusao:</strong> Solicitar a eliminacao de dados pessoais tratados com base no consentimento.</li>
              <li><strong className="text-[var(--color-text)]">Portabilidade:</strong> Solicitar a transferencia de seus dados a outro fornecedor de servico.</li>
              <li><strong className="text-[var(--color-text)]">Revogacao do Consentimento:</strong> Revogar o consentimento a qualquer momento, sem prejuizo do tratamento realizado anteriormente.</li>
              <li><strong className="text-[var(--color-text)]">Oposicao:</strong> Opor-se ao tratamento de dados em determinadas circunstancias.</li>
            </ul>
            <p>Para exercer qualquer desses direitos, entre em contato pelo email indicado na secao 14.</p>
          </section>

          {/* 8 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">8. Exportacao de Dados</h2>
            <p>O Bottrade oferece funcionalidade de exportacao de dados diretamente pelo dashboard da plataforma. Voce pode exportar:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Historico completo de trades (paper e reais)</li>
              <li>Historico de leituras tecnicas</li>
              <li>Dados de performance e estatisticas</li>
              <li>Configuracoes de conta</li>
            </ul>
            <p>Os dados sao exportados em formato JSON, permitindo portabilidade e backup pessoal.</p>
          </section>

          {/* 9 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">9. Exclusao de Conta</h2>
            <p>Voce pode solicitar a exclusao de sua conta a qualquer momento diretamente pelo dashboard ou por email.</p>
            <p>Apos a solicitacao de exclusao:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Sua conta sera desativada imediatamente.</li>
              <li>Todos os seus dados pessoais, configuracoes, historico de trades e sinais serao <strong className="text-[var(--color-text)]">permanentemente deletados em ate 30 dias</strong>.</li>
              <li>Dados anonimizados e agregados (que nao permitem identificacao) podem ser retidos para fins estatisticos.</li>
              <li>A exclusao e irreversivel. Nao sera possivel recuperar os dados apos o periodo de 30 dias.</li>
            </ul>
          </section>

          {/* 10 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">10. Cookies e Armazenamento Local</h2>
            <p>O Bottrade <strong className="text-[var(--color-text)]">nao utiliza cookies de terceiros</strong> ou cookies de rastreamento.</p>
            <p>Utilizamos apenas <strong className="text-[var(--color-text)]">localStorage</strong> do navegador para:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Token de sessao para manter o usuario autenticado.</li>
              <li>Preferencia de tema (claro/escuro).</li>
              <li>Estado de conclusao do onboarding.</li>
            </ul>
            <p>Esses dados sao armazenados localmente no seu navegador e nao sao transmitidos a terceiros.</p>
          </section>

          {/* 11 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">11. Retencao de Dados</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-[var(--color-text)]">Conta ativa:</strong> Dados sao mantidos enquanto a conta estiver ativa.</li>
              <li><strong className="text-[var(--color-text)]">Apos exclusao:</strong> Todos os dados pessoais sao deletados em ate 30 dias apos a solicitacao de exclusao.</li>
              <li><strong className="text-[var(--color-text)]">Dados de pagamento:</strong> Registros de transacao podem ser retidos por ate 5 anos para fins fiscais e legais, conforme legislacao brasileira.</li>
              <li><strong className="text-[var(--color-text)]">Logs de auditoria:</strong> Retidos por ate 6 meses para fins de seguranca.</li>
            </ul>
          </section>

          {/* 12 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">12. Menores de Idade</h2>
            <p>O Servico e destinado exclusivamente a <strong className="text-[var(--color-text)]">maiores de 18 anos</strong>. Nao coletamos intencionalmente dados de menores de idade.</p>
            <p>Caso tenhamos conhecimento de que dados de um menor foram coletados, estes serao imediatamente eliminados.</p>
          </section>

          {/* 13 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">13. Alteracoes nesta Politica</h2>
            <p>O Bottrade podera atualizar esta Politica de Privacidade periodicamente. Em caso de alteracoes significativas:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Notificaremos voce por email cadastrado.</li>
              <li>Uma notificacao sera exibida na plataforma.</li>
              <li>A data de "ultima atualizacao" sera modificada no topo deste documento.</li>
            </ul>
            <p>Recomendamos que voce revise esta politica periodicamente.</p>
          </section>

          {/* 14 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">14. Encarregado de Dados (DPO) e Contato</h2>
            <p>Para exercer seus direitos como titular de dados, esclarecer duvidas ou reportar incidentes de seguranca, entre em contato com nosso Encarregado de Protecao de Dados:</p>
            <p className="text-[var(--color-accent)] font-mono-num">privacidade@bottrade.com</p>
            <p>Nos comprometemos a responder sua solicitacao em ate 15 dias uteis, conforme previsto na LGPD.</p>
          </section>

        </div>
      </main>
    </div>
  )
}
