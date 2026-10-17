import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CacheMiniaturas,
  FilaRenderizacao,
  escalaRender,
  planejarMiniaturas,
  planejarPaginas,
  type TarefaRenderizacao,
} from "../lib/renderizacao";
import type { DocumentoMotor } from "../types";

export type ImagemPagina = { bitmap: ImageBitmap; escala: number };

type OpcoesMiniaturas = {
  /** Páginas visíveis agora (sem esperar a rolagem parar). */
  visiveis: readonly number[];
  /** Escala fixa da miniatura (pixels por ponto PDF). */
  escala: number;
  /** Quantas páginas preparar no sentido da rolagem e no oposto. */
  frente: number;
  tras: number;
  /** Limite de memória das miniaturas. */
  bytesMaximos: number;
};

type Opcoes = {
  /** Densidade de pixels da tela (padrão: a do navegador). */
  dpr?: number;
  /** Páginas nítidas preparadas além das visíveis, de cada lado. */
  margem?: number;
  /** Distância a partir da qual a nítida é liberada (folga para ir e voltar). Padrão: a margem. */
  margemLiberar?: number;
  /** Escala do rascunho rápido em relação à final. */
  fracaoRascunho?: number;
  dprMaximo?: number;
  pixelsMaximos?: number;
  /** Segundo nível: miniaturas baratas mostradas enquanto a nítida não chega. */
  miniaturas?: OpcoesMiniaturas;
};

/**
 * Decide o que desenhar a cada mudança de zoom ou rolagem, em dois níveis:
 * - nítidas: só as visíveis ± margem, uma por vez, com rascunho antes;
 * - miniaturas (opcional): muitas páginas em baixa resolução, desenhadas já
 *   durante a rolagem, para a página nunca aparecer vazia.
 * Devolve, por página, a nítida se houver, senão a miniatura.
 */
export function useRenderizador(
  documento: DocumentoMotor,
  zoom: number,
  visiveis: readonly number[],
  {
    dpr = window.devicePixelRatio || 1,
    margem = 2,
    margemLiberar,
    fracaoRascunho = 0.3,
    dprMaximo,
    pixelsMaximos,
    miniaturas,
  }: Opcoes = {},
): Map<number, ImagemPagina> {
  const [nitidas, setNitidas] = useState<Map<number, ImagemPagina>>(() => new Map());
  const nitidasRef = useRef(nitidas);
  const filaRef = useRef<FilaRenderizacao | null>(null);
  filaRef.current ??= new FilaRenderizacao();
  const filaMiniRef = useRef<FilaRenderizacao | null>(null);
  filaMiniRef.current ??= new FilaRenderizacao();
  const cacheRef = useRef<CacheMiniaturas | null>(null);
  cacheRef.current ??= new CacheMiniaturas(miniaturas?.bytesMaximos ?? 0);
  const [versaoMini, setVersaoMini] = useState(0);
  const quadroRef = useRef(0);
  const direcaoRef = useRef<{ primeira: number; direcao: 1 | -1 }>({ primeira: 1, direcao: 1 });
  const chaveVisiveis = visiveis.join(",");
  const chaveRapidas = miniaturas ? miniaturas.visiveis.join(",") : "";
  const escalaMini = miniaturas?.escala ?? 0;
  const frenteMini = miniaturas?.frente ?? 0;
  const trasMini = miniaturas?.tras ?? 0;
  const comMiniaturas = Boolean(miniaturas);

  const publicar = useCallback((mapa: Map<number, ImagemPagina>) => {
    nitidasRef.current = mapa;
    setNitidas(mapa);
  }, []);

  // Várias miniaturas prontas no mesmo quadro viram uma só atualização da tela.
  const avisarMiniatura = useCallback(() => {
    if (quadroRef.current) return;
    quadroRef.current = requestAnimationFrame(() => {
      quadroRef.current = 0;
      setVersaoMini((v) => v + 1);
    });
  }, []);

  // Documento novo (ou desmontagem): para tudo e libera todas as imagens.
  useEffect(() => {
    const fila = filaRef.current!;
    const filaMini = filaMiniRef.current!;
    const cache = cacheRef.current!;
    return () => {
      fila.parar();
      filaMini.parar();
      cancelAnimationFrame(quadroRef.current);
      quadroRef.current = 0;
      nitidasRef.current.forEach((img) => img.bitmap.close());
      nitidasRef.current = new Map();
      cache.limpar();
    };
  }, [documento]);

  // Nível 1: miniaturas, a cada página que passa na tela.
  useEffect(() => {
    const rapidas = chaveRapidas ? chaveRapidas.split(",").map(Number) : [];
    if (rapidas.length === 0) return;
    const anterior = direcaoRef.current;
    const primeira = Math.min(...rapidas);
    const direcao = primeira === anterior.primeira ? anterior.direcao : primeira > anterior.primeira ? 1 : -1;
    direcaoRef.current = { primeira, direcao };

    const plano = planejarMiniaturas(rapidas, documento.numPaginas, { frente: frenteMini, tras: trasMini, direcao });
    const protegidas = new Set(plano);
    const cache = cacheRef.current!;
    const tarefas: TarefaRenderizacao[] = [];
    for (const pagina of plano) {
      if (cache.obter(pagina)) continue; // já existe: só marca como usada agora
      tarefas.push({
        chave: `mini:${pagina}`,
        async executar(sinal) {
          const bitmap = await documento.renderizar(pagina, escalaMini, sinal);
          if (sinal.aborted) {
            bitmap.close();
            return;
          }
          cache.guardar(pagina, bitmap, protegidas);
          avisarMiniatura();
        },
      });
    }
    filaMiniRef.current!.definir(tarefas);
  }, [documento, chaveRapidas, escalaMini, frenteMini, trasMini, avisarMiniatura]);

  // Nível 2: nítidas, onde a rolagem parou.
  useEffect(() => {
    const paginasVisiveis = chaveVisiveis ? chaveVisiveis.split(",").map(Number) : [];
    const plano = planejarPaginas(paginasVisiveis, documento.numPaginas, margem);
    const folga = planejarPaginas(paginasVisiveis, documento.numPaginas, Math.max(margem, margemLiberar ?? margem));

    let mapa = nitidasRef.current;
    const fora = [...mapa.keys()].filter((p) => !folga.manter.has(p));
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
        const atual = nitidasRef.current;
        const proximo = new Map(atual);
        atual.get(pagina)?.bitmap.close();
        proximo.set(pagina, { bitmap, escala });
        publicar(proximo);
      },
    });

    const rascunhos: TarefaRenderizacao[] = [];
    const finais: TarefaRenderizacao[] = [];
    for (const pagina of plano.ordem) {
      const alvo = escalaRender(zoom, dpr, documento.tamanhos[pagina - 1], { dprMaximo, pixelsMaximos });
      const existente = mapa.get(pagina);
      if (existente && Math.abs(existente.escala - alvo) < 1e-6) continue;
      // Com miniatura já pronta, o rascunho não acrescenta nada.
      const semNada = !existente && !cacheRef.current!.tem(pagina);
      if (semNada && paginasVisiveis.includes(pagina)) rascunhos.push(tarefa(pagina, alvo * fracaoRascunho));
      finais.push(tarefa(pagina, alvo));
    }
    filaRef.current!.definir([...rascunhos, ...finais]);
  }, [documento, zoom, chaveVisiveis, dpr, margem, margemLiberar, fracaoRascunho, dprMaximo, pixelsMaximos, publicar]);

  return useMemo(() => {
    if (!comMiniaturas) return nitidas;
    const combinadas = new Map(nitidas);
    for (let pagina = 1; pagina <= documento.numPaginas; pagina++) {
      if (combinadas.has(pagina)) continue;
      const mini = cacheRef.current!.espiar(pagina);
      if (mini) combinadas.set(pagina, { bitmap: mini, escala: escalaMini });
    }
    return combinadas;
    // versaoMini avisa que o cache de miniaturas mudou.
  }, [nitidas, versaoMini, escalaMini, comMiniaturas, documento]);
}
