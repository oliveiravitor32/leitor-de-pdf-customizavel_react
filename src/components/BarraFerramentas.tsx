import type { ReactNode } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Maximize2,
  Minimize2,
  RotateCcw,
  Rows3,
  Settings2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { BotaoIcone, Campo, Deslizante, classesSelect } from "./Controle";
import {
  opcoesFonteLeitura,
  predefinicoes,
  rotulosPredefinicoes,
} from "../lib/predefinicoes";
import type { EstadoLeitor } from "../types";

type PropsBarra = {
  estado: EstadoLeitor;
  nomeArquivo: string;
  paginaAtual: number;
  totalPaginas: number;
  zoom: number;
  painelAberto: boolean;
  onAlternarPainel: () => void;
  onIrParaPagina: (pagina: number) => void;
  onZoom: (delta: number) => void;
  onAtualizar: (
    patch: Partial<EstadoLeitor>,
    opcoes?: { manterPredefinicao?: boolean },
  ) => void;
  onPredefinicao: (nome: string) => void;
  onResetar: () => void;
  /** Motor de PDF em uso e, se caiu para o reserva, o motivo. */
  motor?: string;
  motivoReserva?: string;
  onAbrirOutro: () => void;
  telaCheia: boolean;
  onAlternarTelaCheia: () => void;
  /** Seção de conta/sincronização, montada pelo App. */
  painelConta?: ReactNode;
  /** Modo leitura imersivo (toque no meio da página): barras escondidas. */
  barrasOcultas?: boolean;
};

export function BarraFerramentas({
  estado,
  nomeArquivo,
  paginaAtual,
  totalPaginas,
  zoom,
  painelAberto,
  onAlternarPainel,
  onIrParaPagina,
  onZoom,
  onAtualizar,
  onPredefinicao,
  onResetar,
  motor,
  motivoReserva,
  onAbrirOutro,
  telaCheia,
  onAlternarTelaCheia,
  painelConta,
  barrasOcultas = false,
}: PropsBarra) {
  const modoLeitura = estado.modo === "leitura";
  // Fundo sólido levemente puxado para a cor do texto: as barras e a gaveta
  // não deixam o PDF vazar por trás e acompanham qualquer predefinição.
  const fundoBarra = `color-mix(in srgb, ${estado.fundo} 92%, currentColor)`;

  const controlesPagina = (
    <ControlesPagina paginaAtual={paginaAtual} totalPaginas={totalPaginas} onIrParaPagina={onIrParaPagina} />
  );
  const controlesZoom = <ControlesZoom zoom={zoom} modoLeitura={modoLeitura} onZoom={onZoom} />;
  const botaoModo = (compacto: boolean) => (
    <BotaoIcone
      titulo={
        modoLeitura
          ? "Voltar para o PDF original, com o layout da página (T)"
          : "Modo leitura: só o texto, com fonte e espaçamento ajustáveis (T)"
      }
      rotulo={compacto ? undefined : modoLeitura ? "PDF original" : "Somente texto"}
      ativo={compacto && modoLeitura}
      onClick={() => onAtualizar({ modo: modoLeitura ? "original" : "leitura" }, { manterPredefinicao: true })}
    >
      {modoLeitura ? <FileText className="h-5 w-5" strokeWidth={1.7} /> : <Type className="h-5 w-5" strokeWidth={1.7} />}
    </BotaoIcone>
  );
  const botaoPainel = (
    <BotaoIcone titulo="Aparência (H)" ativo={painelAberto} onClick={onAlternarPainel}>
      <Settings2 className="h-5 w-5" strokeWidth={1.7} />
    </BotaoIcone>
  );
  const umaPorVez = estado.layout === "pagina";
  const botaoLayout = (
    <BotaoIcone
      titulo={umaPorVez ? "Rolagem contínua" : "Uma página por vez"}
      onClick={() => onAtualizar({ layout: umaPorVez ? "continuo" : "pagina" }, { manterPredefinicao: true })}
    >
      {umaPorVez ? <Rows3 className="h-5 w-5" strokeWidth={1.7} /> : <BookOpen className="h-5 w-5" strokeWidth={1.7} />}
    </BotaoIcone>
  );
  // Esconde deslizando para fora da tela, sem receber toques.
  const ocultar = barrasOcultas ? "pointer-events-none opacity-0" : "opacity-100";
  const botaoAbrir = (
    <BotaoIcone titulo="Abrir outro PDF" onClick={onAbrirOutro}>
      <FolderOpen className="h-5 w-5" strokeWidth={1.7} />
    </BotaoIcone>
  );

  return (
    <>
      {/* Desktop: uma barra flutuante com tudo. */}
      <header
        aria-hidden={barrasOcultas}
        className={`pointer-events-none fixed inset-x-0 top-0 z-20 hidden justify-center p-3 transition-opacity duration-200 md:flex ${barrasOcultas ? "opacity-0" : ""}`}
      >
        <div className={`${barrasOcultas ? "pointer-events-none" : "pointer-events-auto"} flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-2xl border border-current/10 bg-current/5 px-2 py-1.5 shadow-lg shadow-black/10 backdrop-blur-md`}>
          {botaoAbrir}
          <span className="mx-1 max-w-40 shrink-0 truncate text-xs opacity-60">{nomeArquivo}</span>
          <Separador />
          {controlesPagina}
          <Separador />
          {controlesZoom}
          <Separador />
          {botaoModo(false)}
          {botaoLayout}
          <BotaoIcone titulo={telaCheia ? "Sair da tela cheia (F)" : "Tela cheia (F)"} onClick={onAlternarTelaCheia}>
            {telaCheia ? <Minimize2 className="h-5 w-5" strokeWidth={1.7} /> : <Maximize2 className="h-5 w-5" strokeWidth={1.7} />}
          </BotaoIcone>
          {botaoPainel}
        </div>
      </header>

      {/* Celular: barra de cima com as ações do documento... */}
      <header
        aria-hidden={barrasOcultas}
        className={`fixed inset-x-0 top-0 z-20 flex items-center gap-1 border-b border-current/10 px-2 pb-1 shadow-sm transition-opacity duration-200 md:hidden ${ocultar}`}
        style={{ background: fundoBarra, paddingTop: "calc(env(safe-area-inset-top) + 0.25rem)" }}
      >
        {botaoAbrir}
        <span className="min-w-0 flex-1 truncate px-1 text-sm opacity-70">{nomeArquivo}</span>
        {botaoLayout}
        {botaoModo(true)}
        {botaoPainel}
      </header>

      {/* ...e a de baixo, ao alcance do polegar, com página e zoom. */}
      <nav
        aria-hidden={barrasOcultas}
        className={`fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-current/10 px-2 pt-1 transition-opacity duration-200 md:hidden ${ocultar}`}
        style={{ background: fundoBarra, paddingBottom: "calc(env(safe-area-inset-bottom) + 0.25rem)" }}
      >
        <div className="flex items-center">{controlesPagina}</div>
        <div className="flex items-center">{controlesZoom}</div>
      </nav>

      {painelAberto && (
        <button
          type="button"
          aria-label="Fechar painel"
          onClick={onAlternarPainel}
          className="fixed inset-0 z-25 cursor-default bg-black/30 md:hidden"
        />
      )}

      {/* Celular: gaveta que sobe de baixo. Desktop: coluna à direita. */}
      <aside
        aria-hidden={!painelAberto}
        className={`fixed inset-x-0 bottom-0 z-30 max-h-[78vh] overflow-y-auto rounded-t-2xl border-t border-current/10 p-4 shadow-xl shadow-black/30 transition-transform duration-200 md:inset-x-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-72 md:rounded-none md:border-l md:border-t-0 ${
          painelAberto ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"
        }`}
        style={{ background: fundoBarra, paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-current/25 md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Aparência</h2>
          <BotaoIcone titulo="Restaurar padrões" onClick={onResetar}>
            <RotateCcw className="h-4 w-4" strokeWidth={1.7} />
          </BotaoIcone>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-1.5">
          {Object.keys(predefinicoes).map((nome) => (
            <button
              key={nome}
              type="button"
              onClick={() => onPredefinicao(nome)}
              className={`cursor-pointer rounded-lg border px-1 py-2 text-[11px] transition-colors ${
                estado.predefinicao === nome
                  ? "border-current/60 bg-current/15"
                  : "border-current/15 hover:bg-current/10"
              }`}
            >
              <span
                className="mx-auto mb-1 block h-4 w-4 rounded-full border border-black/20"
                style={{ background: predefinicoes[nome].fundo }}
              />
              {rotulosPredefinicoes[nome]}
            </button>
          ))}
        </div>

        <Secao titulo="Cores">
          <Campo rotulo="Fundo">
            <input
              type="color"
              value={estado.fundo}
              onChange={(e) => onAtualizar({ fundo: e.target.value })}
              className="h-8 w-full cursor-pointer rounded-lg border border-current/20 bg-transparent"
            />
          </Campo>

          {!modoLeitura && (
            <>
              <Deslizante
                rotulo="Inverter"
                valor={estado.inverter}
                min={0}
                max={1}
                passo={0.05}
                onChange={(inverter) => onAtualizar({ inverter })}
              />
              <Deslizante
                rotulo="Matiz"
                valor={estado.matiz}
                min={0}
                max={360}
                passo={5}
                sufixo="°"
                onChange={(matiz) => onAtualizar({ matiz })}
              />
              <Deslizante
                rotulo="Contraste"
                valor={estado.contraste}
                min={50}
                max={180}
                passo={5}
                sufixo="%"
                onChange={(contraste) => onAtualizar({ contraste })}
              />
              <Deslizante
                rotulo="Brilho"
                valor={estado.brilho}
                min={50}
                max={150}
                passo={5}
                sufixo="%"
                onChange={(brilho) => onAtualizar({ brilho })}
              />
              <Deslizante
                rotulo="Sépia"
                valor={estado.sepia}
                min={0}
                max={100}
                passo={5}
                sufixo="%"
                onChange={(sepia) => onAtualizar({ sepia })}
              />
            </>
          )}
        </Secao>

        {modoLeitura && (
          <Secao titulo="Texto">
            <Campo rotulo="Fonte">
              <select
                value={estado.fonteLeitura}
                onChange={(e) =>
                  onAtualizar(
                    { fonteLeitura: e.target.value },
                    { manterPredefinicao: true },
                  )
                }
                className={classesSelect}
              >
                {opcoesFonteLeitura.map((o) => (
                  <option key={o.value} value={o.value} className="text-black">
                    {o.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Deslizante
              rotulo="Tamanho"
              valor={estado.tamanhoLeitura}
              min={12}
              max={40}
              passo={1}
              sufixo="px"
              onChange={(tamanhoLeitura) =>
                onAtualizar({ tamanhoLeitura }, { manterPredefinicao: true })
              }
            />
            <Deslizante
              rotulo="Altura da linha"
              valor={estado.linhaLeitura}
              min={1.1}
              max={2.6}
              passo={0.1}
              onChange={(linhaLeitura) =>
                onAtualizar({ linhaLeitura }, { manterPredefinicao: true })
              }
            />
            <Deslizante
              rotulo="Largura do texto"
              valor={estado.larguraLeitura}
              min={400}
              max={1100}
              passo={20}
              sufixo="px"
              onChange={(larguraLeitura) =>
                onAtualizar({ larguraLeitura }, { manterPredefinicao: true })
              }
            />
            <Deslizante
              rotulo="Espaçamento"
              valor={estado.espacamentoLeitura}
              min={0}
              max={0.15}
              passo={0.01}
              sufixo="em"
              onChange={(espacamentoLeitura) =>
                onAtualizar(
                  { espacamentoLeitura },
                  { manterPredefinicao: true },
                )
              }
            />
            <Campo rotulo="Cor do texto">
              <div className="flex gap-1.5">
                <input
                  type="color"
                  value={estado.corTexto || "#3b3a36"}
                  onChange={(e) => onAtualizar({ corTexto: e.target.value })}
                  className="h-8 flex-1 cursor-pointer rounded-lg border border-current/20 bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => onAtualizar({ corTexto: "" })}
                  className="cursor-pointer rounded-lg border border-current/20 px-2 text-[11px] hover:bg-current/10"
                >
                  Auto
                </button>
              </div>
            </Campo>
          </Secao>
        )}

        {painelConta}

        <p className="mt-6 text-[11px] leading-relaxed opacity-50 pointer-coarse:hidden">
          Atalhos: setas mudam de página, + e - dão zoom, T alterna o modo
          leitura, F a tela cheia e H este painel.
        </p>
        {motor && (
          <p className="mt-5 text-[11px] opacity-60">
            Motor de PDF: {motor}
            {motivoReserva && <span className="block break-words">Motivo: {motivoReserva}</span>}
          </p>
        )}
      </aside>
    </>
  );
}

function ControlesPagina({
  paginaAtual,
  totalPaginas,
  onIrParaPagina,
}: {
  paginaAtual: number;
  totalPaginas: number;
  onIrParaPagina: (pagina: number) => void;
}) {
  return (
    <>
      <BotaoIcone
        titulo="Página anterior (seta esquerda)"
        onClick={() => onIrParaPagina(paginaAtual - 1)}
        desabilitado={paginaAtual <= 1}
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.7} />
      </BotaoIcone>
      <form
        className="flex shrink-0 items-center gap-1 text-sm tabular-nums md:text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          const campo = e.currentTarget.elements.namedItem("pagina") as HTMLInputElement;
          onIrParaPagina(Number(campo.value));
          campo.blur();
        }}
      >
        <input
          name="pagina"
          aria-label="Página atual"
          key={paginaAtual}
          defaultValue={paginaAtual}
          inputMode="numeric"
          className="w-11 rounded-md border border-current/20 bg-transparent px-1 py-1 text-center outline-none focus:border-current/50 md:w-10 md:py-0.5"
        />
        <span className="opacity-50">/ {totalPaginas}</span>
      </form>
      <BotaoIcone
        titulo="Próxima página (seta direita)"
        onClick={() => onIrParaPagina(paginaAtual + 1)}
        desabilitado={paginaAtual >= totalPaginas}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.7} />
      </BotaoIcone>
    </>
  );
}

function ControlesZoom({
  zoom,
  modoLeitura,
  onZoom,
}: {
  zoom: number;
  modoLeitura: boolean;
  onZoom: (delta: number) => void;
}) {
  return (
    <>
      <BotaoIcone titulo={modoLeitura ? "Diminuir o texto (-)" : "Diminuir zoom (-)"} onClick={() => onZoom(-0.15)}>
        <ZoomOut className="h-5 w-5" strokeWidth={1.7} />
      </BotaoIcone>
      <span className="w-11 shrink-0 text-center text-xs tabular-nums opacity-60">{Math.round(zoom * 100)}%</span>
      <BotaoIcone titulo={modoLeitura ? "Aumentar o texto (+)" : "Aumentar zoom (+)"} onClick={() => onZoom(0.15)}>
        <ZoomIn className="h-5 w-5" strokeWidth={1.7} />
      </BotaoIcone>
    </>
  );
}

function Separador() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-current/15" />;
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-5 flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide opacity-50">
        {titulo}
      </h3>
      {children}
    </section>
  );
}
