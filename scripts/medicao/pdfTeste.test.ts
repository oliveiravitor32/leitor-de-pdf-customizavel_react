import { describe, expect, it } from "vitest";
import { gerarPdfTeste } from "./pdfTeste.mjs";

const texto = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

describe("gerarPdfTeste", () => {
  it("gera um PDF com o número de páginas pedido", () => {
    const pdf = texto(gerarPdfTeste(3));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Count 3");
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("a tabela xref aponta para o início de cada objeto", () => {
    const pdf = texto(gerarPdfTeste(2));
    // "\nxref\n", e não só "xref", para não pegar o "startxref" do fim.
    const xref = pdf.slice(pdf.lastIndexOf("\nxref\n"));
    const deslocamentos = [...xref.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(deslocamentos.length).toBeGreaterThan(0);
    deslocamentos.forEach((pos, i) => expect(pdf.startsWith(`${i + 1} 0 obj`, pos)).toBe(true));
  });

  it("startxref aponta para a tabela xref", () => {
    const pdf = texto(gerarPdfTeste(1));
    const inicio = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.startsWith("xref", inicio)).toBe(true);
  });
});
