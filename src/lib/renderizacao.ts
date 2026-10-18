import type { TamanhoPagina } from "../types";

type LimitesEscala = {
  /** Densidade de pixels máxima usada (telas 3x não ganham nitidez visível acima disso num PDF). */
  dprMaximo?: number;
  /** Teto de pixels por página: canvases gigantes estouram a memória da GPU no celular. */
  pixelsMaximos?: number;
};

/** Escala (pixels por ponto PDF) para renderizar uma página com o zoom dado. */
export function escalaRender(
  zoom: number,
  dpr: number,
  tamanho: TamanhoPagina,
  { dprMaximo = 2, pixelsMaximos = 16_000_000 }: LimitesEscala = {},
): number {
  const escala = zoom * Math.min(dpr, dprMaximo);
  const pixels = tamanho.largura * tamanho.altura * escala * escala;
  return pixels > pixelsMaximos ? Math.sqrt(pixelsMaximos / (tamanho.largura * tamanho.altura)) : escala;
}

/**
 * Quais páginas manter desenhadas (as visíveis ± margem) e em que ordem
 * desenhá-las: visíveis primeiro, depois alternando próxima e anterior.
 */
export function planejarPaginas(
  visiveis: readonly number[],
  total: number,
  margem: number,
): { manter: Set<number>; ordem: number[] } {
  if (visiveis.length === 0) return { manter: new Set(), ordem: [] };
  const primeira = Math.min(...visiveis);
  const ultima = Math.max(...visiveis);
  const ordem = [...visiveis];
  for (let d = 1; d <= margem; d++) {
    if (ultima + d <= total) ordem.push(ultima + d);
    if (primeira - d >= 1) ordem.push(primeira - d);
  }
  return { manter: new Set(ordem), ordem };
}

export type TarefaRenderizacao = {
  /** Identifica a tarefa entre chamadas de `definir` (ex.: "pagina:escala"). */
  chave: string;
  executar: (sinal: AbortSignal) => Promise<void>;
};

/**
 * Executa uma renderização por vez. A cada `definir`, a lista de pendentes é
 * trocada; a tarefa em andamento continua se ainda estiver na lista nova e é
 * cancelada se não estiver.
 */
export class FilaRenderizacao {
  private pendentes: TarefaRenderizacao[] = [];
  private atual: { chave: string; controle: AbortController } | null = null;

  definir(tarefas: TarefaRenderizacao[]) {
    if (this.atual && !tarefas.some((t) => t.chave === this.atual!.chave)) {
      this.atual.controle.abort();
      this.atual = null;
    }
    this.pendentes = tarefas.filter((t) => t.chave !== this.atual?.chave);
    this.proxima();
  }

  parar() {
    this.pendentes = [];
    this.atual?.controle.abort();
    this.atual = null;
  }

  private proxima() {
    if (this.atual) return;
    const tarefa = this.pendentes.shift();
    if (!tarefa) return;
    const controle = new AbortController();
    const atual = { chave: tarefa.chave, controle };
    this.atual = atual;
    tarefa
      .executar(controle.signal)
      .catch(() => {
        // Cancelamento ou falha de uma página não pode travar as outras.
      })
      .finally(() => {
        if (this.atual === atual) this.atual = null;
        this.proxima();
      });
  }
}

/**
 * Ordem das miniaturas: visíveis primeiro e depois alternando os dois lados,
 * com `frente` páginas no sentido da rolagem e `tras` no sentido oposto.
 */
export function planejarMiniaturas(
  visiveis: readonly number[],
  total: number,
  { frente, tras, direcao }: { frente: number; tras: number; direcao: 1 | -1 },
): number[] {
  if (visiveis.length === 0) return [];
  const primeira = Math.min(...visiveis);
  const ultima = Math.max(...visiveis);
  // "Frente" parte da última visível rolando para baixo e da primeira rolando para cima.
  const [inicioFrente, inicioTras] = direcao === 1 ? [ultima, primeira] : [primeira, ultima];
  const ordem = [...visiveis];
  for (let d = 1; d <= Math.max(frente, tras); d++) {
    const naFrente = inicioFrente + d * direcao;
    const atras = inicioTras - d * direcao;
    if (d <= frente && naFrente >= 1 && naFrente <= total) ordem.push(naFrente);
    if (d <= tras && atras >= 1 && atras <= total) ordem.push(atras);
  }
  return ordem;
}

/**
 * Miniaturas em baixa resolução com limite de memória e de quantidade
 * (vale o que chegar primeiro): passando do limite,
 * libera as usadas há mais tempo, nunca as protegidas (as que estão na tela).
 */
export class CacheMiniaturas {
  // Map mantém a ordem de inserção: o primeiro é o usado há mais tempo.
  private itens = new Map<number, ImageBitmap>();
  private bytes = 0;

  constructor(
    private readonly bytesMaximos: number,
    private readonly itensMaximos = Infinity,
  ) {}

  tem(pagina: number): boolean {
    return this.itens.has(pagina);
  }

  /** Lê sem mexer na ordem de uso. */
  espiar(pagina: number): ImageBitmap | undefined {
    return this.itens.get(pagina);
  }

  obter(pagina: number): ImageBitmap | undefined {
    const bitmap = this.itens.get(pagina);
    if (bitmap) {
      this.itens.delete(pagina);
      this.itens.set(pagina, bitmap);
    }
    return bitmap;
  }

  guardar(pagina: number, bitmap: ImageBitmap, protegidas: ReadonlySet<number>) {
    this.remover(pagina);
    this.itens.set(pagina, bitmap);
    this.bytes += tamanhoBytes(bitmap);
    for (const [p] of this.itens) {
      if (this.bytes <= this.bytesMaximos && this.itens.size <= this.itensMaximos) break;
      if (p === pagina || protegidas.has(p)) continue;
      this.remover(p);
    }
  }

  limpar() {
    for (const p of [...this.itens.keys()]) this.remover(p);
  }

  private remover(pagina: number) {
    const bitmap = this.itens.get(pagina);
    if (!bitmap) return;
    this.bytes -= tamanhoBytes(bitmap);
    this.itens.delete(pagina);
    bitmap.close();
  }
}

const tamanhoBytes = (bitmap: ImageBitmap) => bitmap.width * bitmap.height * 4;
