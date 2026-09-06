import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { BotaoIcone, Campo, Deslizante, classesSelect } from "./Controle";
import { opcoesFonteLeitura, predefinicoes, rotulosPredefinicoes } from "../lib/predefinicoes";
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
  onAtualizar: (patch: Partial<EstadoLeitor>, opcoes?: { manterPredefinicao?: boolean }) => void;
  onPredefinicao: (nome: string) => void;
  onResetar: () => void;
  onAbrirOutro: () => void;
  telaCheia: boolean;
  onAlternarTelaCheia: () => void;
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
  onAbrirOutro,
  telaCheia,
  onAlternarTelaCheia,
}: PropsBarra) {
  const modoLeitura = estado.modo === "leitura";

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center p-3">
        <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-2xl border border-current/10 bg-current/5 px-2 py-1.5 shadow-lg shadow-black/10 backdrop-blur-md">
          <BotaoIcone titulo="Abrir outro PDF" onClick={onAbrirOutro}>
            <FolderOpen className="h-4.5 w-4.5" strokeWidth={1.7} />
          </BotaoIcone>

          <span className="mx-1 hidden max-w-40 shrink-0 truncate text-xs opacity-60 sm:block">
            {nomeArquivo}
          </span>

          <Separador />

          <BotaoIcone
            titulo="Página anterior (seta esquerda)"
            onClick={() => onIrParaPagina(paginaAtual - 1)}
            desabilitado={paginaAtual <= 1}
          >
            <ChevronLeft className="h-4.5 w-4.5" strokeWidth={1.7} />
          </BotaoIcone>

          <form
            className="flex shrink-0 items-center gap-1 text-xs tabular-nums"
            onSubmit={(e) => {
              e.preventDefault();
              const campo = e.currentTarget.elements.namedItem("pagina") as HTMLInputElement;
              onIrParaPagina(Number(campo.value));
              campo.blur();
            }}
          >
            <input
              name="pagina"
              key={paginaAtual}
              defaultValue={paginaAtual}
              inputMode="numeric"
              className="w-10 rounded-md border border-current/20 bg-transparent px-1 py-0.5 text-center outline-none focus:border-current/50"
            />
            <span className="opacity-50">/ {totalPaginas}</span>
          </form>

          <BotaoIcone
            titulo="Próxima página (seta direita)"
            onClick={() => onIrParaPagina(paginaAtual + 1)}
            desabilitado={paginaAtual >= totalPaginas}
          >
            <ChevronRight className="h-4.5 w-4.5" strokeWidth={1.7} />
          </BotaoIcone>

          <Separador />

          <BotaoIcone titulo="Diminuir zoom (-)" onClick={() => onZoom(-0.15)} desabilitado={modoLeitura}>
            <ZoomOut className="h-4.5 w-4.5" strokeWidth={1.7} />
          </BotaoIcone>
          <span className="w-11 shrink-0 text-center text-xs tabular-nums opacity-60">
            {Math.round(zoom * 100)}%
          </span>
          <BotaoIcone titulo="Aumentar zoom (+)" onClick={() => onZoom(0.15)} desabilitado={modoLeitura}>
            <ZoomIn className="h-4.5 w-4.5" strokeWidth={1.7} />
          </BotaoIcone>

          <Separador />

          <BotaoIcone
            titulo={modoLeitura ? "Ver o PDF original (T)" : "Modo leitura: só o texto (T)"}
            ativo={modoLeitura}
            onClick={() =>
              onAtualizar({ modo: modoLeitura ? "original" : "leitura" }, { manterPredefinicao: true })
            }
          >
            {modoLeitura ? (
              <FileText className="h-4.5 w-4.5" strokeWidth={1.7} />
            ) : (
              <Type className="h-4.5 w-4.5" strokeWidth={1.7} />
            )}
          </BotaoIcone>

          <BotaoIcone
            titulo={telaCheia ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
            onClick={onAlternarTelaCheia}
          >
            {telaCheia ? (
              <Minimize2 className="h-4.5 w-4.5" strokeWidth={1.7} />
            ) : (
              <Maximize2 className="h-4.5 w-4.5" strokeWidth={1.7} />
            )}
          </BotaoIcone>

          <BotaoIcone titulo="Aparência (H)" ativo={painelAberto} onClick={onAlternarPainel}>
            <Settings2 className="h-4.5 w-4.5" strokeWidth={1.7} />
          </BotaoIcone>
        </div>
      </header>

      <aside
        aria-hidden={!painelAberto}
        className={`fixed right-0 top-0 z-30 h-full w-72 overflow-y-auto border-l border-current/10 bg-current/5 p-4 shadow-xl shadow-black/20 backdrop-blur-md transition-transform duration-200 ${
          painelAberto ? "translate-x-0" : "translate-x-full"
        }`}
      >
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
              className={`rounded-lg border px-1 py-2 text-[11px] transition-colors ${
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
                  onAtualizar({ fonteLeitura: e.target.value }, { manterPredefinicao: true })
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
              onChange={(linhaLeitura) => onAtualizar({ linhaLeitura }, { manterPredefinicao: true })}
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
                onAtualizar({ espacamentoLeitura }, { manterPredefinicao: true })
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
                  className="rounded-lg border border-current/20 px-2 text-[11px] hover:bg-current/10"
                >
                  Auto
                </button>
              </div>
            </Campo>
          </Secao>
        )}

        <p className="mt-6 text-[11px] leading-relaxed opacity-50">
          Atalhos: setas mudam de página, + e - dão zoom, T alterna o modo leitura, F a tela cheia e
          H este painel.
        </p>
      </aside>
    </>
  );
}

function Separador() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-current/15" />;
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-5 flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide opacity-50">{titulo}</h3>
      {children}
    </section>
  );
}
