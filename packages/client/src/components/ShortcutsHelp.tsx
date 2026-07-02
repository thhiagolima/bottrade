export default function ShortcutsHelp() {
  return (
    <div
      id="shortcuts-help"
      style={{ display: 'none' }}
      className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          (e.currentTarget as HTMLElement).style.display = 'none'
        }
      }}
    >
      <div className="bg-card border border-card-border rounded-lg p-6 max-w-md w-full mx-4 animate-fade-in">
        <h2 className="text-lg font-display font-bold mb-4">Atalhos de teclado</h2>
        <div className="space-y-3 text-sm">
          <div className="text-muted font-medium uppercase text-xs tracking-wider">Navegacao</div>
          <Shortcut keys="^ v" desc="Navegar entre pares" />
          <Shortcut keys="1 2 3" desc="Selecionar par por posicao" />

          <div className="text-muted font-medium uppercase text-xs tracking-wider mt-4">Paineis</div>
          <Shortcut keys="S" desc="Configuracoes" />
          <Shortcut keys="H" desc="Historico de trades" />
          <Shortcut keys="B" desc="Backtest" />
          <Shortcut keys="P" desc="Performance" />
          <Shortcut keys="C" desc="Modo comparacao" />
          <Shortcut keys="Esc" desc="Fechar painel ativo" />

          <div className="text-muted font-medium uppercase text-xs tracking-wider mt-4">Outros</div>
          <Shortcut keys="?" desc="Mostrar/ocultar atalhos" />
        </div>
        <p className="text-dim text-xs mt-4">Pressione ? para fechar</p>
      </div>
    </div>
  )
}

function Shortcut({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{desc}</span>
      <div className="flex gap-1">
        {keys.split(' ').map((key, i) => (
          <kbd key={i} className="bg-bg-elevated border border-card-border rounded px-2 py-0.5 text-xs font-mono text-white">
            {key}
          </kbd>
        ))}
      </div>
    </div>
  )
}
