import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PainelSincronizacao } from "./PainelSincronizacao";
import { todasAtivas } from "../lib/sincronizacao";

const base = {
  disponivel: true,
  conta: null,
  ativas: todasAtivas,
  erro: "",
  onEntrar: vi.fn(),
  onSair: vi.fn(),
  onAlternar: vi.fn(),
  onApagar: vi.fn(),
};

describe("PainelSincronizacao", () => {
  it("não aparece sem Firebase configurado", () => {
    const { container } = render(<PainelSincronizacao {...base} disponivel={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("deslogado mostra o botão de entrar, opcional", () => {
    const onEntrar = vi.fn();
    render(<PainelSincronizacao {...base} onEntrar={onEntrar} />);
    fireEvent.click(screen.getByRole("button", { name: /entrar com google/i }));
    expect(onEntrar).toHaveBeenCalled();
  });

  it("logado mostra um interruptor por categoria", () => {
    const onAlternar = vi.fn();
    render(
      <PainelSincronizacao {...base} conta={{ uid: "u1" }} ativas={{ ...todasAtivas, fonte: false }} onAlternar={onAlternar} />,
    );
    const cores = screen.getByRole("switch", { name: /esquema de cores/i });
    const fonte = screen.getByRole("switch", { name: /fonte e tamanho/i });
    expect(cores).toBeChecked();
    expect(fonte).not.toBeChecked();
    fireEvent.click(fonte);
    expect(onAlternar).toHaveBeenCalledWith("fonte");
  });

  it("apagar dados pede confirmação", () => {
    const onApagar = vi.fn();
    const confirmar = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<PainelSincronizacao {...base} conta={{ uid: "u1" }} onApagar={onApagar} />);
    const botao = screen.getByRole("button", { name: /apagar meus dados/i });
    fireEvent.click(botao);
    expect(onApagar).not.toHaveBeenCalled();
    fireEvent.click(botao);
    expect(onApagar).toHaveBeenCalled();
    expect(confirmar).toHaveBeenCalledTimes(2);
  });

  it("mostra o erro de sincronização", () => {
    render(<PainelSincronizacao {...base} conta={{ uid: "u1" }} erro="Falhou" />);
    expect(screen.getByText("Falhou")).toBeInTheDocument();
  });
});
