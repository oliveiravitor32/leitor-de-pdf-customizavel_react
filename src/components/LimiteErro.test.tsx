import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LimiteErro } from "./LimiteErro";

function Quebra(): never {
  throw new Error("falhou ao desenhar");
}

describe("LimiteErro", () => {
  it("mostra a mensagem do erro em vez de deixar a tela branca", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <LimiteErro>
        <Quebra />
      </LimiteErro>,
    );
    expect(screen.getByText(/algo deu errado/i)).toBeTruthy();
    expect(screen.getByText(/falhou ao desenhar/)).toBeTruthy();
  });

  it("sem erro mostra o conteúdo normalmente", () => {
    render(<LimiteErro>ok</LimiteErro>);
    expect(screen.getByText("ok")).toBeTruthy();
  });
});
