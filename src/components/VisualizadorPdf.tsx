import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PaginaCanvas } from "./PaginaCanvas";
import { usePinca } from "../hooks/usePinca";
import { useRenderizador } from "../hooks/useRenderizador";
import { useValorEstavel } from "../hooks/useValorEstavel";
import { ehToque } from "../lib/dispositivo";
import { filtroCss } from "../lib/predefinicoes";
import type { DocumentoMotor, EstadoLeitor } from "../types";

/** Telas de toque usam resolução menor: mais fluidez, sem diferença visível. */
const LIMITES_TOQUE = { dprMaximo: 1.5, pixelsMaximos: 4_000_000, bytesMiniaturas: 40_000_000 };
const LIMITES_DESKTOP = { dprMaximo: 2, pixelsMaximos: 16_000_000, bytesMiniaturas: 48_000_000 };
/**
 * Miniaturas: 30% da escala do PDF (~180 KB por página A4/carta). Até 200 páginas
 * (~36 MB), com teto de memória para PDFs de páginas gigantes.
 */
const MINIATURAS = { escala: 0.3, frente: 12, tras: 8, itensMaximos: 200 };
/** A nítida só é liberada a 4 páginas de distância: ir e voltar um pouco não apaga nada. */
const MARGEM_LIBERAR = 4;

type PropsVisualizador = {
  documento: DocumentoMotor;
  estado: EstadoLeitor;
  corTexto: string;
  zoom: number;
  obterTextoPagina: (numeroPagina: number) => Promise<string>;
  onMudarPagina: (pagina: number) => void;
  registrarNavegacao: (ir: (pagina: number) => void) => void;
  /** Aplica a escala da pinça e devolve a escala que de fato entrou (após os limites). */
  onPinca: (escala: number) => number;
};

export function VisualizadorPdf({
  documento,
  estado,
  corTexto,
  zoom,
  obterTextoPagina,
  onMudarPagina,
  registrarNavegacao,
  onPinca,
}: PropsVisualizador) {
  const containerRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const origemRef = useRef({ x: 0, y: 0 });
  const ajustePendenteRef = useRef<{ x: number; y: number } | null>(null);

  // Durante a pinça só amplia visualmente (barato); ao soltar, aplica o zoom
  // de verdade e rola para o ponto entre os dedos continuar no lugar.
  usePinca(containerRef, {
    aoMover(escala, centro) {
      const conteudo = conteudoRef.current;
      if (!conteudo) return;
      if (!conteudo.style.transform) {
        const caixa = conteudo.getBoundingClientRect();
        origemRef.current = { x: centro.x - caixa.left, y: centro.y - caixa.top };
        conteudo.style.transformOrigin = `${origemRef.current.x}px ${origemRef.current.y}px`;
      }
      conteudo.style.transform = `scale(${escala})`;
    },
    aoTerminar(escala) {
      const conteudo = conteudoRef.current;
      const container = containerRef.current;
      if (!conteudo || !container) return;
      conteudo.style.transform = "";
      conteudo.style.transformOrigin = "";
      const aplicada = onPinca(escala);
      const { x, y } = origemRef.current;
      // A rolagem só pode ser ajustada depois que o React aplicar o novo tamanho.
      if (aplicada !== 1) ajustePendenteRef.current = { x: x * (aplicada - 1), y: y * (aplicada - 1) };
    },
  });

  useLayoutEffect(() => {
    const ajuste = ajustePendenteRef.current;
    const container = containerRef.current;
    if (!ajuste || !container) return;
    ajustePendenteRef.current = null;
    container.scrollLeft += ajuste.x;
    container.scrollTop += ajuste.y;
  }, [zoom, estado.tamanhoLeitura]);
  const paginas = useMemo(() => Array.from({ length: documento.numPaginas }, (_, i) => i + 1), [documento]);
  const [visiveis, setVisiveis] = useState<number[]>([1]);
  const limites = useMemo(() => (ehToque() ? LIMITES_TOQUE : LIMITES_DESKTOP), []);
  // Numa rolagem rápida as páginas passam voando: só renderiza onde a tela parou.
  const visiveisEstaveis = useValorEstavel(visiveis, 120);
  const original = estado.modo === "original";
  const { bytesMiniaturas, ...limitesNitidas } = limites;
  const imagens = useRenderizador(documento, zoom, original ? visiveisEstaveis : [], {
    ...limitesNitidas,
    margemLiberar: MARGEM_LIBERAR,
    // As miniaturas seguem a rolagem na hora; as nítidas esperam ela parar.
    miniaturas: { ...MINIATURAS, visiveis: original ? visiveis : [], bytesMaximos: bytesMiniaturas },
  });
  const filtro = filtroCss(estado);

  useEffect(() => {
    registrarNavegacao((pagina) => {
      containerRef.current
        ?.querySelector(`[data-pagina="${pagina}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [registrarNavegacao]);

  // Páginas visíveis (alimentam o renderizador); a "atual" é a primeira delas.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const naTela = new Set<number>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const pagina = Number((e.target as HTMLElement).dataset.pagina);
          if (e.isIntersecting) naTela.add(pagina);
          else naTela.delete(pagina);
        }
        const ordenadas = [...naTela].sort((a, b) => a - b);
        if (ordenadas.length === 0) return;
        setVisiveis((anteriores) => (anteriores.join() === ordenadas.join() ? anteriores : ordenadas));
        onMudarPagina(ordenadas[0]);
      },
      { root: container, threshold: 0 },
    );
    container.querySelectorAll("[data-pagina]").forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [onMudarPagina, documento, estado.modo]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full touch-pan-x touch-pan-y overflow-auto md:px-4"
      style={{
        // Espaço para as barras (no celular há uma em cima e outra embaixo).
        paddingTop: "calc(env(safe-area-inset-top) + 5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)",
      }}
    >
      {/* No modo original a coluna cresce com o zoom (rolagem lateral);
          no modo texto ela acompanha a largura da tela. */}
      <div
        ref={conteudoRef}
        className={`mx-auto flex flex-col items-center gap-3 md:gap-5 ${
          estado.modo === "original" ? "w-fit min-w-full" : "w-full"
        }`}
      >
        {paginas.map((numero) =>
          estado.modo === "original" ? (
            <PaginaCanvas
              key={numero}
              numero={numero}
              tamanho={documento.tamanhos[numero - 1]}
              zoom={zoom}
              filtro={filtro}
              imagem={imagens.get(numero)}
              sombra={false}
            />
          ) : (
            <PaginaTexto
              key={numero}
              numero={numero}
              estado={estado}
              corTexto={corTexto}
              obterTextoPagina={obterTextoPagina}
              raizRef={containerRef}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** Marca a página como "perto da janela", para só então renderizá-la. */
function usePertoDaJanela(
  alvo: React.RefObject<HTMLElement | null>,
  raiz: React.RefObject<HTMLElement | null>,
) {
  const [perto, setPerto] = useState(false);
  useEffect(() => {
    const el = alvo.current;
    if (!el || perto) return;
    const observador = new IntersectionObserver(
      ([entrada]) => entrada.isIntersecting && setPerto(true),
      { root: raiz.current, rootMargin: "1200px 0px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [alvo, raiz, perto]);
  return perto;
}

type PropsPaginaTexto = {
  numero: number;
  estado: EstadoLeitor;
  corTexto: string;
  obterTextoPagina: (numeroPagina: number) => Promise<string>;
  raizRef: React.RefObject<HTMLDivElement | null>;
};

const PaginaTexto = memo(function PaginaTexto({
  numero,
  estado,
  corTexto,
  obterTextoPagina,
  raizRef,
}: PropsPaginaTexto) {
  const hospedeiroRef = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const perto = usePertoDaJanela(hospedeiroRef, raizRef);

  useEffect(() => {
    if (!perto) return;
    let cancelado = false;
    obterTextoPagina(numero).then((t) => !cancelado && setTexto(t));
    return () => {
      cancelado = true;
    };
  }, [perto, numero, obterTextoPagina]);

  return (
    <div
      ref={hospedeiroRef}
      data-pagina={numero}
      className="w-full border-b border-dashed border-neutral-500/25 px-1 py-6 last:border-b-0 md:px-2 md:py-8"
      style={{
        color: corTexto,
        fontFamily: estado.fonteLeitura,
        fontSize: `${estado.tamanhoLeitura}px`,
        lineHeight: estado.linhaLeitura,
        letterSpacing: `${estado.espacamentoLeitura}em`,
        maxWidth: estado.larguraLeitura,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <span className="mb-5 block text-center text-[0.72em] opacity-40">— pág. {numero} —</span>
      {texto ?? <span className="opacity-40">Extraindo texto…</span>}
    </div>
  );
});
