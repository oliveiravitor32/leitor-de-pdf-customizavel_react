import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PaginaCanvas } from "./PaginaCanvas";
import { estiloTextoLeitura } from "./estiloTexto";
import { usePinca } from "../hooks/usePinca";
import { useRenderizador } from "../hooks/useRenderizador";
import { ehToque } from "../lib/dispositivo";
import { classificarGesto, zoomParaCaber } from "../lib/paginacao";
import { filtroCss } from "../lib/predefinicoes";
import type { DocumentoMotor, EstadoLeitor } from "../types";

type Props = {
  documento: DocumentoMotor;
  estado: EstadoLeitor;
  corTexto: string;
  pagina: number;
  /** Zoom em relação a "página inteira cabendo na tela" (1 = cabe). */
  zoomRelativo: number;
  onIrPara: (pagina: number) => void;
  onAlternarBarras: () => void;
  /** Aplica a escala da pinça e devolve a escala que de fato entrou. */
  onPinca: (escala: number) => number;
  obterTextoPagina: (pagina: number) => Promise<string>;
};

const LIMITES_TOQUE = { dprMaximo: 1.5, pixelsMaximos: 4_000_000, margem: 1 };
const LIMITES_DESKTOP = { dprMaximo: 2, pixelsMaximos: 16_000_000, margem: 1 };
/** Folga em volta da página para ela não encostar nas bordas da tela. */
const RESPIRO = 8;

/** Uma página por vez, estilo Kindle: desliza ou toca nas bordas para virar. */
export function VisualizadorPaginado({
  documento,
  estado,
  corTexto,
  pagina,
  zoomRelativo,
  onIrPara,
  onAlternarBarras,
  onPinca,
  obterTextoPagina,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ largura: window.innerWidth, altura: window.innerHeight });
  const opcoes = useMemo(() => (ehToque() ? LIMITES_TOQUE : LIMITES_DESKTOP), []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => {
      if (el.clientWidth && el.clientHeight) setArea({ largura: el.clientWidth, altura: el.clientHeight });
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const tamanho = documento.tamanhos[pagina - 1];
  const caber = zoomParaCaber(tamanho, { largura: area.largura - RESPIRO * 2, altura: area.altura - RESPIRO * 2 });
  const zoom = caber * zoomRelativo;
  const original = estado.modo === "original";
  const imagens = useRenderizador(documento, zoom, original ? [pagina] : [], opcoes);

  // Gestos: um dedo vira a página; dois dedos são pinça (e não viram nada).
  const inicioRef = useRef<{ x: number; y: number; t: number; rolagem: number } | null>(null);
  const dedosRef = useRef(0);
  const pincaRef = useRef(false);
  /** O navegador assumiu o gesto como rolagem (pointercancel); o fim vem pelo touchend. */
  const assumidoRef = useRef(false);

  // Página nova começa no canto superior esquerdo, mantendo o zoom.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    el.scrollTop = 0;
  }, [pagina]);

  usePinca(areaRef, {
    aoMover(escala) {
      pincaRef.current = true;
      if (conteudoRef.current) conteudoRef.current.style.transform = `scale(${escala})`;
    },
    aoTerminar(escala) {
      if (conteudoRef.current) conteudoRef.current.style.transform = "";
      onPinca(escala);
    },
  });

  const aoTocar = (e: React.PointerEvent) => {
    dedosRef.current += 1;
    if (dedosRef.current === 1) {
      pincaRef.current = false;
      assumidoRef.current = false;
      inicioRef.current = { x: e.clientX, y: e.clientY, t: performance.now(), rolagem: areaRef.current?.scrollLeft ?? 0 };
    }
  };

  const finalizar = (x: number, y: number) => {
    const inicio = inicioRef.current;
    inicioRef.current = null;
    if (!inicio || pincaRef.current) return;
    const el = areaRef.current;
    const largura = el?.clientWidth || window.innerWidth;
    const acao = classificarGesto({
      dx: x - inicio.x,
      dy: y - inicio.y,
      duracao: performance.now() - inicio.t,
      x: x - (el?.getBoundingClientRect().left ?? 0),
      largura,
      rolagem: { inicio: inicio.rolagem, maximo: Math.max(0, (el?.scrollWidth ?? 0) - largura) },
    });
    if (acao === "menu") onAlternarBarras();
    else if (acao) onIrPara(pagina + (acao === "proxima" ? 1 : -1));
  };

  const aoSoltar = (e: React.PointerEvent) => {
    dedosRef.current = Math.max(0, dedosRef.current - 1);
    if (dedosRef.current > 0) return;
    finalizar(e.clientX, e.clientY);
  };

  const aoTerminarToque = (e: React.TouchEvent) => {
    if (!assumidoRef.current || e.touches.length > 0) return;
    assumidoRef.current = false;
    const toque = e.changedTouches[0];
    if (toque) finalizar(toque.clientX, toque.clientY);
  };

  return (
    <div
      ref={areaRef}
      onPointerDown={aoTocar}
      onPointerUp={aoSoltar}
      onPointerCancel={() => {
        // Com a página ampliada o navegador rola sozinho e cancela o ponteiro; o gesto termina no touchend.
        dedosRef.current = 0;
        assumidoRef.current = inicioRef.current !== null;
      }}
      onTouchEnd={aoTerminarToque}
      className="h-full w-full touch-pan-x touch-pan-y overflow-auto select-none"
    >
      {/* PDF: centralizado e podendo crescer além da tela (zoom). Texto: largura da tela. */}
      <div
        className={original ? "flex min-h-full min-w-full w-fit items-center justify-center" : "min-h-full w-full"}
        style={{ padding: original ? RESPIRO : 0 }}
      >
        <div ref={conteudoRef} className={original ? "origin-center" : "origin-top w-full"}>
          {original ? (
            <PaginaCanvas
              key={pagina}
              numero={pagina}
              tamanho={tamanho}
              zoom={zoom}
              filtro={filtroCss(estado)}
              imagem={imagens.get(pagina)}
            />
          ) : (
            <TextoDaPagina
              key={pagina}
              pagina={pagina}
              estado={estado}
              corTexto={corTexto}
              obterTextoPagina={obterTextoPagina}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TextoDaPagina({
  pagina,
  estado,
  corTexto,
  obterTextoPagina,
}: {
  pagina: number;
  estado: EstadoLeitor;
  corTexto: string;
  obterTextoPagina: (pagina: number) => Promise<string>;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    obterTextoPagina(pagina).then((t) => !cancelado && setTexto(t));
    return () => {
      cancelado = true;
    };
  }, [pagina, obterTextoPagina]);

  return (
    <div data-pagina={pagina} className="mx-auto w-full px-5 py-16" style={estiloTextoLeitura(estado, corTexto)}>
      {texto ?? <span className="opacity-40">Extraindo texto…</span>}
      <span className="mt-6 block text-center text-[0.72em] opacity-40">— pág. {pagina} —</span>
    </div>
  );
}
