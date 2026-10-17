import { memo, useEffect, useRef } from "react";
import type { ImagemPagina } from "../hooks/useRenderizador";
import type { TamanhoPagina } from "../types";

type Props = {
  numero: number;
  tamanho: TamanhoPagina;
  zoom: number;
  /** Filtro CSS das cores (ex.: "invert(1) sepia(20%)"), aplicado uma vez no desenho. */
  filtro: string;
  /** Imagem pronta; pode estar em outra escala (rascunho ou zoom antigo) e é esticada até a nítida chegar. */
  imagem?: ImagemPagina;
  /** Sombra em volta da página (o modo contínuo fica sem). */
  sombra?: boolean;
};

/**
 * Uma página do modo original. O tamanho na tela vem do tamanho do PDF × zoom,
 * então a rolagem não "pula" enquanto a imagem é desenhada.
 */
export const PaginaCanvas = memo(function PaginaCanvas({ numero, tamanho, zoom, filtro, imagem, sombra = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!imagem) {
      // Zerar o tamanho libera os pixels do canvas (que senão ficariam na memória).
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    const { bitmap } = imagem;
    // Imagem já liberada (close) tem largura 0: mantém o desenho atual até chegar a nova.
    if (!bitmap.width || !bitmap.height) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Filtro aplicado nos pixels uma vez só; o filtro CSS seria recalculado pela GPU a cada quadro da rolagem.
    if (typeof ctx.filter === "string") {
      ctx.filter = filtro;
      canvas.style.filter = "";
    } else {
      canvas.style.filter = filtro; // navegadores sem ctx.filter
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
      ctx.drawImage(bitmap, 0, 0);
    } catch {
      // Liberada entre a checagem e o desenho: a próxima imagem redesenha.
    }
  }, [imagem, filtro]);

  return (
    <div
      data-pagina={numero}
      className={`relative shrink-0 overflow-hidden rounded-sm bg-white/5 ${sombra ? "shadow-lg shadow-black/20" : ""}`}
      style={{ width: `${tamanho.largura * zoom}px`, height: `${tamanho.altura * zoom}px` }}
    >
      <canvas ref={canvasRef} width={0} height={0} className="block h-full w-full" />
      <span className="pointer-events-none absolute bottom-1 right-2 text-[11px] opacity-30 mix-blend-difference">
        {numero}
      </span>
    </div>
  );
});
