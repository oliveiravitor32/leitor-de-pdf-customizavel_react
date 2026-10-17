import { useEffect, useMemo, useRef, useState } from "react";
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
  const inicioRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const dedosRef = useRef(0);
  const pincaRef = useRef(false);

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
      inicioRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    }
  };

  const aoSoltar = (e: React.PointerEvent) => {
    dedosRef.current = Math.max(0, dedosRef.current - 1);
    const inicio = inicioRef.current;
    if (dedosRef.current > 0 || !inicio) return;
    inicioRef.current = null;
    if (pincaRef.current) return;

    const acao = classificarGesto({
      dx: e.clientX - inicio.x,
      dy: e.clientY - inicio.y,
      duracao: performance.now() - inicio.t,
      x: e.clientX - (areaRef.current?.getBoundingClientRect().left ?? 0),
      largura: areaRef.current?.clientWidth || window.innerWidth,
    });
    if (acao === "menu") onAlternarBarras();
    // Com a página ampliada o dedo serve para arrastar, não para virar.
    else if (acao && zoomRelativo <= 1) onIrPara(pagina + (acao === "proxima" ? 1 : -1));
  };

  return (
    <div
      ref={areaRef}
      onPointerDown={aoTocar}
      onPointerUp={aoSoltar}
      onPointerCancel={() => {
        dedosRef.current = 0;
        inicioRef.current = null;
      }}
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
