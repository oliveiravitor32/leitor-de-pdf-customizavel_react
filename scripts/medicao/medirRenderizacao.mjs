// Tempo de cada etapa da renderização no celular: PDFium + ponte Rust↔JS, e a
// montagem do ImageBitmap no JS. Também mostra em que formato a imagem chega
// (ArrayBuffer = bytes de verdade; Array = convertida em JSON).
//
// Uso: node scripts/medicao/medirRenderizacao.mjs teste100.pdf

import { readFileSync } from "node:fs";
import { conectar, encaminharWebView } from "./devtools.mjs";

encaminharWebView();
const devtools = await conectar();
const base64 = readFileSync(process.argv[2]).toString("base64");

const resultado = await devtools.avaliar(`(async () => {
  const invoke = window.__TAURI_INTERNALS__.invoke;
  const bin = atob("${base64}");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const { id } = await invoke("pdf_abrir", bytes);

  // Escala da nítida no celular: largura da tela em pontos × densidade limitada a 1,5.
  const nitida = 1.5 * (screen.width / 612);
  const casos = [["minúscula (custo fixo da ponte)", 0.001], ["miniatura", 0.3], ["nítida", nitida], ["nítida 2x", nitida * 2]];
  const linhas = [];
  for (const [nome, escala] of casos) {
    for (let pagina = 1; pagina <= 5; pagina++) {
      let t = performance.now();
      const resposta = await invoke("pdf_renderizar", { id, pagina, escala });
      const ponte = performance.now() - t;
      const buffer = Array.isArray(resposta) ? new Uint8Array(resposta).buffer : resposta;
      const v = new DataView(buffer);
      const [largura, altura] = [v.getUint32(0, true), v.getUint32(4, true)];
      t = performance.now();
      const bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(buffer, 8, largura * altura * 4), largura, altura));
      const montar = performance.now() - t;
      bitmap.close();
      linhas.push({ nome, pagina, formato: Array.isArray(resposta) ? "Array (JSON)" : "ArrayBuffer", largura, altura, ponte, montar });
    }
  }
  await invoke("pdf_fechar", { id });
  return linhas;
})()`);

const medias = new Map();
for (const l of resultado) {
  const m = medias.get(l.nome) ?? { ...l, ponte: 0, montar: 0, n: 0 };
  // A primeira página de cada caso aquece caches; fica fora da média.
  if (l.pagina > 1) Object.assign(m, { ponte: m.ponte + l.ponte, montar: m.montar + l.montar, n: m.n + 1 });
  medias.set(l.nome, m);
}
console.table(
  [...medias.values()].map((m) => ({
    tipo: m.nome,
    tamanho: `${m.largura}×${m.altura}`,
    KB: Math.round((m.largura * m.altura * 4) / 1024),
    formato: m.formato,
    "Rust + ponte (ms)": Math.round(m.ponte / m.n),
    "montar no JS (ms)": Math.round(m.montar / m.n),
  })),
);
devtools.fechar();
