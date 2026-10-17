import { describe, expect, it, vi } from "vitest";
import { FilaRenderizacao, escalaRender, CacheMiniaturas, planejarMiniaturas, planejarPaginas } from "./renderizacao";

const A4 = { largura: 612, altura: 792 };

describe("escalaRender", () => {
  it("multiplica o zoom pela densidade de pixels da tela", () => {
    expect(escalaRender(1, 1.5, A4)).toBe(1.5);
  });

  it("limita a densidade de pixels (celular com tela 3x não precisa de 3x)", () => {
    expect(escalaRender(1, 3, A4, { dprMaximo: 1.5 })).toBe(1.5);
  });

  it("reduz a escala para a página não passar do teto de pixels", () => {
    const escala = escalaRender(3, 2, A4, { pixelsMaximos: 4_000_000 });
    expect(A4.largura * escala * A4.altura * escala).toBeLessThanOrEqual(4_000_000);
    expect(A4.largura * escala * A4.altura * escala).toBeGreaterThan(3_900_000);
  });
});

describe("planejarPaginas", () => {
  it("mantém as visíveis e mais N de cada lado, sem sair do documento", () => {
    expect([...planejarPaginas([5, 6], 10, 2).manter].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8]);
    expect([...planejarPaginas([1], 10, 2).manter].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect([...planejarPaginas([10], 10, 2).manter].sort((a, b) => a - b)).toEqual([8, 9, 10]);
  });

  it("ordena: visíveis primeiro, depois a próxima, a anterior, e assim por diante", () => {
    expect(planejarPaginas([5, 6], 10, 2).ordem).toEqual([5, 6, 7, 4, 8, 3]);
  });

  it("sem página visível não planeja nada", () => {
    expect(planejarPaginas([], 10, 2).ordem).toEqual([]);
  });
});

function tarefaControlada(chave: string) {
  let concluir!: () => void;
  const executar = vi.fn(
    (sinal: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        concluir = resolve;
        sinal.addEventListener("abort", () => reject(new DOMException("cancelada", "AbortError")));
      }),
  );
  return { tarefa: { chave, executar }, concluir: () => concluir() };
}

describe("FilaRenderizacao", () => {
  it("executa uma tarefa por vez, na ordem dada", async () => {
    const fila = new FilaRenderizacao();
    const a = tarefaControlada("a");
    const b = tarefaControlada("b");
    fila.definir([a.tarefa, b.tarefa]);

    expect(a.tarefa.executar).toHaveBeenCalledTimes(1);
    expect(b.tarefa.executar).not.toHaveBeenCalled();

    a.concluir();
    await vi.waitFor(() => expect(b.tarefa.executar).toHaveBeenCalledTimes(1));
  });

  it("cancela a tarefa em andamento se ela não está mais na lista", async () => {
    const fila = new FilaRenderizacao();
    const a = tarefaControlada("a");
    const c = tarefaControlada("c");
    fila.definir([a.tarefa]);
    const sinal = a.tarefa.executar.mock.calls[0][0];

    fila.definir([c.tarefa]);

    expect(sinal.aborted).toBe(true);
    await vi.waitFor(() => expect(c.tarefa.executar).toHaveBeenCalledTimes(1));
  });

  it("não reinicia a tarefa em andamento se ela continua na lista", () => {
    const fila = new FilaRenderizacao();
    const a = tarefaControlada("a");
    fila.definir([a.tarefa]);
    const sinal = a.tarefa.executar.mock.calls[0][0];

    fila.definir([a.tarefa, tarefaControlada("b").tarefa]);

    expect(sinal.aborted).toBe(false);
    expect(a.tarefa.executar).toHaveBeenCalledTimes(1);
  });

  it("um erro numa tarefa não trava a fila", async () => {
    const fila = new FilaRenderizacao();
    const falha = { chave: "x", executar: vi.fn(async () => Promise.reject(new Error("pdf quebrado"))) };
    const b = tarefaControlada("b");
    fila.definir([falha, b.tarefa]);
    await vi.waitFor(() => expect(b.tarefa.executar).toHaveBeenCalled());
  });

  it("parar cancela tudo", () => {
    const fila = new FilaRenderizacao();
    const a = tarefaControlada("a");
    fila.definir([a.tarefa, tarefaControlada("b").tarefa]);
    const sinal = a.tarefa.executar.mock.calls[0][0];
    fila.parar();
    expect(sinal.aborted).toBe(true);
  });
});

describe("planejarMiniaturas", () => {
  it("visíveis primeiro e depois alternando, com mais páginas no sentido da rolagem", () => {
    expect(planejarMiniaturas([10], 100, { frente: 3, tras: 1, direcao: 1 })).toEqual([10, 11, 9, 12, 13]);
  });

  it("rolando para cima, a frente são as páginas anteriores", () => {
    expect(planejarMiniaturas([10], 100, { frente: 3, tras: 1, direcao: -1 })).toEqual([10, 9, 11, 8, 7]);
  });

  it("não sai do documento", () => {
    expect(planejarMiniaturas([2], 3, { frente: 5, tras: 5, direcao: 1 })).toEqual([2, 3, 1]);
  });

  it("sem página visível não planeja nada", () => {
    expect(planejarMiniaturas([], 10, { frente: 3, tras: 3, direcao: 1 })).toEqual([]);
  });
});

describe("CacheMiniaturas", () => {
  const bitmap = (lado: number) => ({ width: lado, height: lado, close: vi.fn() }) as unknown as ImageBitmap;

  it("guarda e devolve a miniatura da página", () => {
    const cache = new CacheMiniaturas(1_000_000);
    const b = bitmap(10);
    cache.guardar(1, b, new Set());
    expect(cache.obter(1)).toBe(b);
    expect(cache.tem(2)).toBe(false);
  });

  it("passando do limite de memória, libera a usada há mais tempo", () => {
    const cache = new CacheMiniaturas(10 * 10 * 4 * 2); // cabem duas de 10x10
    const [a, b, c] = [bitmap(10), bitmap(10), bitmap(10)];
    cache.guardar(1, a, new Set());
    cache.guardar(2, b, new Set());
    cache.obter(1); // a 1 foi usada agora: a 2 vira a mais antiga
    cache.guardar(3, c, new Set());
    expect(cache.tem(2)).toBe(false);
    expect(b.close).toHaveBeenCalled();
    expect([cache.tem(1), cache.tem(3)]).toEqual([true, true]);
  });

  it("não libera páginas protegidas (as que estão na tela)", () => {
    const cache = new CacheMiniaturas(10 * 10 * 4);
    const [a, b] = [bitmap(10), bitmap(10)];
    cache.guardar(1, a, new Set());
    cache.guardar(2, b, new Set([1, 2]));
    expect([cache.tem(1), cache.tem(2)]).toEqual([true, true]);
    expect(a.close).not.toHaveBeenCalled();
  });

  it("limpar libera todas", () => {
    const cache = new CacheMiniaturas(1_000_000);
    const a = bitmap(10);
    cache.guardar(1, a, new Set());
    cache.limpar();
    expect(cache.tem(1)).toBe(false);
    expect(a.close).toHaveBeenCalled();
  });
});
