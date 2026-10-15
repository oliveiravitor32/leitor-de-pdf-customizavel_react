import { describe, expect, it, vi } from "vitest";
import { FilaRenderizacao, escalaRender, planejarPaginas } from "./renderizacao";

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
