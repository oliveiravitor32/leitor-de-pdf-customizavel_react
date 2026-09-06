import { useEffect, useRef, useState } from "react";
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
};

export function VisualizadorPdf({
  documento,
  estado,
  corTexto,
  zoom,
  obterTextoPagina,
  onMudarPagina,
  registrarNavegacao,
}: PropsVisualizador) {
  const containerRef = useRef<HTMLDivElement>(null);
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
      className="h-full w-full overflow-y-auto overflow-x-hidden px-4 pb-24 pt-24"
    >
      <div className="mx-auto flex w-fit flex-col items-center gap-6">
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
  const [dimensoes, setDimensoes] = useState<{ largura: number; altura: number } | null>(null);
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
      setDimensoes({
        largura: viewport.width / (escala / zoom),
        altura: viewport.height / (escala / zoom),
      });
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
        width: dimensoes?.largura ?? 612 * zoom,
        height: dimensoes?.altura ?? 792 * zoom,
        maxWidth: "100%",
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
      className="w-full border-b border-dashed border-neutral-500/25 px-2 py-8 last:border-b-0"
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
