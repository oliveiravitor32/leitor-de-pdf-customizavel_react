// Tempo desde a abertura do PDF até todas as páginas terem imagem no canvas,
// e quantos drawImage aconteceram nesse período (foi o que revelou o ADR-005).
//
// Uso: node scripts/medicao/medirMiniaturas.mjs teste100.pdf

import { codigoAbrirPdf, conectar, encaminharWebView, recarregarNoModoContinuo } from "./devtools.mjs";

const instrumentacao = `(() => {
  const m = (window.__medicao = { drawImage: 0, drawImageMs: 0 });
  const original = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    const t = performance.now();
    const r = original.apply(this, args);
    m.drawImage++;
    m.drawImageMs += performance.now() - t;
    return r;
  };
})()`;

encaminharWebView();
const devtools = await conectar();
await recarregarNoModoContinuo(devtools, instrumentacao);
await devtools.avaliar(`window.__inicio = performance.now()`);
await devtools.avaliar(codigoAbrirPdf(process.argv[2]));

const resultado = await devtools.avaliar(`(async () => {
  const marcos = [];
  while (performance.now() - window.__inicio < 60000) {
    await new Promise((r) => setTimeout(r, 250));
    const canvases = [...document.querySelectorAll("[data-pagina] canvas")];
    const comImagem = canvases.filter((c) => c.width > 0).length;
    if (marcos.at(-1)?.[1] !== comImagem) marcos.push([Math.round(performance.now() - window.__inicio), comImagem]);
    if (canvases.length && comImagem === canvases.length) break;
  }
  return { marcos, ...window.__medicao };
})()`);

console.log("tempo (ms) → páginas com imagem");
for (const [ms, n] of resultado.marcos) console.log(`${String(ms).padStart(6)} → ${n}`);
console.log(`drawImage: ${resultado.drawImage} chamadas, ${Math.round(resultado.drawImageMs)} ms no total`);
devtools.fechar();
