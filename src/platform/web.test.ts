import { describe, expect, it, vi } from "vitest";
import { lerArquivo, plataformaWeb } from "./web";

function capturarInput() {
  const criar = document.createElement.bind(document);
  let input: HTMLInputElement | undefined;
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = criar(tag);
    if (tag === "input") {
      input = el as HTMLInputElement;
      vi.spyOn(input, "click").mockImplementation(() => {});
    }
    return el;
  });
  return () => input!;
}

describe("lerArquivo", () => {
  it("converte File em ArquivoPdf", async () => {
    const arquivo = new File([new Uint8Array([1, 2, 3])], "a.pdf", { type: "application/pdf" });
    const lido = await lerArquivo(arquivo);
    expect(lido.nome).toBe("a.pdf");
    expect(new Uint8Array(lido.dados!)).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("plataformaWeb.escolherPdf", () => {
  it("abre um seletor de PDF e devolve o arquivo escolhido", async () => {
    const input = capturarInput();
    const promessa = plataformaWeb.escolherPdf();
    const el = input();
    expect(el.type).toBe("file");
    expect(el.accept).toBe("application/pdf");
    expect(el.click).toHaveBeenCalled();

    const arquivo = new File([new Uint8Array([9])], "doc.pdf", { type: "application/pdf" });
    Object.defineProperty(el, "files", { value: [arquivo] });
    el.dispatchEvent(new Event("change"));

    const resultado = await promessa;
    expect(resultado?.nome).toBe("doc.pdf");
  });

  it("devolve null quando o usuário cancela", async () => {
    const input = capturarInput();
    const promessa = plataformaWeb.escolherPdf();
    input().dispatchEvent(new Event("cancel"));
    expect(await promessa).toBeNull();
  });
});
