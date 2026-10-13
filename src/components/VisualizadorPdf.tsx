import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePinca } from "../hooks/usePinca";
import { filtroCss } from "../lib/predefinicoes";
import type { DocumentoPdf, EstadoLeitor } from "../types";

type PropsVisualizador = {
  documento: DocumentoPdf;
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
  const paginasRef = useRef<(HTMLDivElement | null)[]>([]);
  const paginas = Array.from({ length: documento.numPages }, (_, i) => i + 1);

  useEffect(() => {
    registrarNavegacao((pagina) => {
      paginasRef.current[pagina - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [registrarNavegacao]);

  // Página "atual" = a primeira que ainda estiver visível na janela.
  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas
          .filter((e) => e.isIntersecting)
          .map((e) => Number((e.target as HTMLElement).dataset.pagina))
          .sort((a, b) => a - b)[0];
        if (visivel) onMudarPagina(visivel);
      },
      { root: containerRef.current, threshold: 0.15 },
    );
    paginasRef.current.forEach((el) => el && observador.observe(el));
    return () => observador.disconnect();
  }, [onMudarPagina, documento, estado.modo]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full touch-pan-x touch-pan-y overflow-auto px-3 md:px-4"
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
        className={`mx-auto flex flex-col items-center gap-4 md:gap-6 ${
          estado.modo === "original" ? "w-fit min-w-full" : "w-full"
        }`}
      >
        {paginas.map((numero) =>
          estado.modo === "original" ? (
            <PaginaCanvas
              key={numero}
              ref={(el) => {
                paginasRef.current[numero - 1] = el;
              }}
              documento={documento}
              numero={numero}
              zoom={zoom}
              filtro={filtroCss(estado)}
              raizRef={containerRef}
            />
          ) : (
            <PaginaTexto
              key={numero}
              ref={(el) => {
                paginasRef.current[numero - 1] = el;
              }}
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

type PropsPaginaCanvas = {
  ref: (el: HTMLDivElement | null) => void;
  documento: DocumentoPdf;
  numero: number;
  zoom: number;
  filtro: string;
  raizRef: React.RefObject<HTMLDivElement | null>;
};

function PaginaCanvas({ ref, documento, numero, zoom, filtro, raizRef }: PropsPaginaCanvas) {
  const hospedeiroRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [base, setBase] = useState<{ largura: number; altura: number } | null>(null);
  const perto = usePertoDaJanela(hospedeiroRef, raizRef);

  useEffect(() => {
    if (!perto) return;
    let cancelado = false;
    let tarefa: { cancel: () => void } | null = null;

    (async () => {
      const pagina = await documento.getPage(numero);
      if (cancelado) return;
      const escala = zoom * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pagina.getViewport({ scale: escala });
      const canvas = canvasRef.current;
      const original = pagina.getViewport({ scale: 1 });
      setBase({ largura: original.width, altura: original.height });
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const render = pagina.render({ canvasContext: ctx, viewport });
      tarefa = render;
      try {
        await render.promise;
      } catch {
        // renderização cancelada por zoom/troca de página — nada a fazer
      }
    })();

    return () => {
      cancelado = true;
      tarefa?.cancel();
    };
  }, [perto, documento, numero, zoom]);

  return (
    <div
      ref={(el) => {
        hospedeiroRef.current = el;
        ref(el);
      }}
      data-pagina={numero}
      className="relative overflow-hidden rounded-sm bg-white/5 shadow-lg shadow-black/20"
      style={{
        width: (base?.largura ?? 612) * zoom,
        height: (base?.altura ?? 792) * zoom,
      }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" style={{ filter: filtro }} />
      <span className="pointer-events-none absolute bottom-1 right-2 text-[11px] opacity-30 mix-blend-difference">
        {numero}
      </span>
    </div>
  );
}

type PropsPaginaTexto = {
  ref: (el: HTMLDivElement | null) => void;
  numero: number;
  estado: EstadoLeitor;
  corTexto: string;
  obterTextoPagina: (numeroPagina: number) => Promise<string>;
  raizRef: React.RefObject<HTMLDivElement | null>;
};

function PaginaTexto({
  ref,
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
      ref={(el) => {
        hospedeiroRef.current = el;
        ref(el);
      }}
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
}
