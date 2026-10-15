import { useCallback, useEffect, useRef, useState } from "react";
import { FilaRenderizacao, escalaRender, planejarPaginas, type TarefaRenderizacao } from "../lib/renderizacao";
import type { DocumentoMotor } from "../types";

export type ImagemPagina = { bitmap: ImageBitmap; escala: number };

type Opcoes = {
  /** Densidade de pixels da tela (padrão: a do navegador). */
  dpr?: number;
  /** Páginas mantidas além das visíveis, de cada lado. */
  margem?: number;
  /** Escala do rascunho rápido em relação à final. */
  fracaoRascunho?: number;
  dprMaximo?: number;
  pixelsMaximos?: number;
};

/**
 * Decide o que desenhar a cada mudança de zoom ou rolagem: só as páginas
 * visíveis ± margem ficam na memória, uma renderização por vez, rascunho
 * rápido antes da versão nítida e imagem antiga mantida até a nova chegar.
 */
export function useRenderizador(
  documento: DocumentoMotor,
  zoom: number,
  visiveis: readonly number[],
  {
    dpr = window.devicePixelRatio || 1,
    margem = 2,
    fracaoRascunho = 0.3,
    dprMaximo,
    pixelsMaximos,
  }: Opcoes = {},
): Map<number, ImagemPagina> {
  const [imagens, setImagens] = useState<Map<number, ImagemPagina>>(() => new Map());
  const imagensRef = useRef(imagens);
  const filaRef = useRef<FilaRenderizacao | null>(null);
  filaRef.current ??= new FilaRenderizacao();
  const chaveVisiveis = visiveis.join(",");

  const publicar = useCallback((mapa: Map<number, ImagemPagina>) => {
    imagensRef.current = mapa;
    setImagens(mapa);
  }, []);

  // Documento novo (ou desmontagem): para tudo e libera todas as imagens.
  useEffect(() => {
    const fila = filaRef.current!;
    return () => {
      fila.parar();
      imagensRef.current.forEach((img) => img.bitmap.close());
      imagensRef.current = new Map();
    };
  }, [documento]);

  useEffect(() => {
    const paginasVisiveis = chaveVisiveis ? chaveVisiveis.split(",").map(Number) : [];
    const plano = planejarPaginas(paginasVisiveis, documento.numPaginas, margem);

    let mapa = imagensRef.current;
    const fora = [...mapa.keys()].filter((p) => !plano.manter.has(p));
    if (fora.length > 0) {
      mapa = new Map(mapa);
      for (const p of fora) {
        mapa.get(p)!.bitmap.close();
        mapa.delete(p);
      }
      publicar(mapa);
    }

    const tarefa = (pagina: number, escala: number): TarefaRenderizacao => ({
      chave: `${pagina}@${escala}`,
      async executar(sinal) {
        const bitmap = await documento.renderizar(pagina, escala, sinal);
        if (sinal.aborted) {
          bitmap.close();
          return;
        }
        const atual = imagensRef.current;
        const proximo = new Map(atual);
        atual.get(pagina)?.bitmap.close();
        proximo.set(pagina, { bitmap, escala });
        publicar(proximo);
      },
    });

    const rascunhos: TarefaRenderizacao[] = [];
    const nitidas: TarefaRenderizacao[] = [];
    for (const pagina of plano.ordem) {
      const alvo = escalaRender(zoom, dpr, documento.tamanhos[pagina - 1], { dprMaximo, pixelsMaximos });
      const existente = mapa.get(pagina);
      if (existente && Math.abs(existente.escala - alvo) < 1e-6) continue;
      if (!existente && paginasVisiveis.includes(pagina)) rascunhos.push(tarefa(pagina, alvo * fracaoRascunho));
      nitidas.push(tarefa(pagina, alvo));
    }
    filaRef.current!.definir([...rascunhos, ...nitidas]);
  }, [documento, zoom, chaveVisiveis, dpr, margem, fracaoRascunho, dprMaximo, pixelsMaximos, publicar]);

  return imagens;
}
