// Gera um PDF de teste (só texto e linhas, tamanho carta), sem depender de
// arquivos pessoais. Usado nas medições de desempenho (ver README.md).
//
// Uso: node scripts/medicao/pdfTeste.mjs [paginas=100] [saida=teste100.pdf]

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Monta o PDF em memória e devolve os bytes. */
export function gerarPdfTeste(paginas = 100) {
  const objetos = [];
  const adicionar = (conteudo) => objetos.push(conteudo) && objetos.length;

  const fonte = adicionar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const conteudos = [];
  for (let i = 0; i < paginas; i++) {
    const linhas = [`BT /F1 18 Tf 72 740 Td (Pagina ${i + 1}) Tj ET`];
    for (let j = 0; j < 40; j++) {
      linhas.push(
        `BT /F1 10 Tf 72 ${700 - j * 15} Td (Linha ${j} de texto de teste para medir a renderizacao do PDFium no celular.) Tj ET`,
      );
    }
    for (let j = 0; j < 20; j++) linhas.push(`72 ${100 + j * 5} m 540 ${120 + j * 7} l S`);
    const dados = linhas.join("\n");
    conteudos.push(adicionar(`<< /Length ${dados.length} >>\nstream\n${dados}\nendstream`));
  }

  const idPaginas = objetos.length + paginas + 1;
  const filhas = conteudos.map((conteudo) =>
    adicionar(
      `<< /Type /Page /Parent ${idPaginas} 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 ${fonte} 0 R >> >> /Contents ${conteudo} 0 R >>`,
    ),
  );
  adicionar(`<< /Type /Pages /Kids [${filhas.map((f) => `${f} 0 R`).join(" ")}] /Count ${paginas} >>`);
  const catalogo = adicionar(`<< /Type /Catalog /Pages ${idPaginas} 0 R >>`);

  let saida = "%PDF-1.4\n";
  const deslocamentos = objetos.map((conteudo, i) => {
    const pos = saida.length;
    saida += `${i + 1} 0 obj\n${conteudo}\nendobj\n`;
    return pos;
  });
  const inicioXref = saida.length;
  saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  saida += deslocamentos.map((pos) => `${String(pos).padStart(10, "0")} 00000 n \n`).join("");
  saida += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  // Só ASCII: cada caractere é um byte, então os deslocamentos batem.
  return new TextEncoder().encode(saida);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paginas = Number(process.argv[2] ?? 100);
  const destino = process.argv[3] ?? `teste${paginas}.pdf`;
  writeFileSync(destino, gerarPdfTeste(paginas));
  console.log(`${destino}: ${paginas} páginas`);
}
