import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BarraFerramentas } from "./BarraFerramentas";
import { preferenciasPadrao } from "../services/settings";

function montar(props: Partial<Parameters<typeof BarraFerramentas>[0]> = {}) {
  const base = {
    estado: preferenciasPadrao,
    nomeArquivo: "a.pdf",
    paginaAtual: 2,
    totalPaginas: 5,
    zoom: 1,
    painelAberto: false,
    onAlternarPainel: vi.fn(),
    onIrParaPagina: vi.fn(),
    onZoom: vi.fn(),
    onAtualizar: vi.fn(),
    onPredefinicao: vi.fn(),
    onResetar: vi.fn(),
    onAbrirOutro: vi.fn(),
    telaCheia: false,
    onAlternarTelaCheia: vi.fn(),
  };
  const todas = { ...base, ...props };
  render(<BarraFerramentas {...todas} />);
  return todas;
}

describe("BarraFerramentas", () => {
  it("tocar fora do painel aberto fecha o painel", () => {
    const p = montar({ painelAberto: true });
    fireEvent.click(screen.getByRole("button", { name: /fechar painel/i }));
    expect(p.onAlternarPainel).toHaveBeenCalled();
  });

  it("sem painel aberto não há camada por cima do PDF", () => {
    montar();
    expect(screen.queryByRole("button", { name: /fechar painel/i })).toBeNull();
  });

  it("navegação de página e zoom funcionam a partir da barra", () => {
    const p = montar();
    fireEvent.click(screen.getAllByRole("button", { name: /próxima página/i })[0]);
    expect(p.onIrParaPagina).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getAllByRole("button", { name: /aumentar zoom/i })[0]);
    expect(p.onZoom).toHaveBeenCalledWith(0.15);
  });
});
