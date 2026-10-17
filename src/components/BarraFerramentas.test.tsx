import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BarraFerramentas } from "./BarraFerramentas";
import { preferenciasPadrao } from "../services/settings";

function montarProps(props: Partial<Parameters<typeof BarraFerramentas>[0]> = {}) {
  return {
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
    ...props,
  };
}

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

  it("mostra no painel qual motor de PDF está em uso", () => {
    montar({ painelAberto: true, motor: "PDFium" });
    expect(screen.getByText(/motor de pdf: pdfium/i)).toBeTruthy();
  });

  it("mostra o motivo quando caiu para o motor reserva", () => {
    montar({ painelAberto: true, motor: "pdf.js", motivoReserva: "dlopen falhou" });
    expect(screen.getByText(/motor de pdf: pdf\.js/i)).toBeTruthy();
    expect(screen.getByText(/dlopen falhou/)).toBeTruthy();
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

  it("alterna entre uma página por vez e rolagem contínua", () => {
    const p = montar();
    fireEvent.click(screen.getAllByRole("button", { name: /rolagem contínua/i })[0]);
    expect(p.onAtualizar).toHaveBeenCalledWith({ layout: "continuo" }, { manterPredefinicao: true });
  });

  it("no layout contínuo o botão volta para uma página por vez", () => {
    const p = montar({ estado: { ...preferenciasPadrao, layout: "continuo" } });
    fireEvent.click(screen.getAllByRole("button", { name: /uma página por vez/i })[0]);
    expect(p.onAtualizar).toHaveBeenCalledWith({ layout: "pagina" }, { manterPredefinicao: true });
  });

  it("barras ocultas saem da tela e não recebem toque", () => {
    const { container } = render(
      <BarraFerramentas {...(montarProps() as Parameters<typeof BarraFerramentas>[0])} barrasOcultas />,
    );
    const barras = container.querySelectorAll("header, nav");
    barras.forEach((b) => expect(b.getAttribute("aria-hidden")).toBe("true"));
  });
});
