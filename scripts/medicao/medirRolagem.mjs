// Abre o PDF, espera as miniaturas e faz arremessos de verdade na tela,
// medindo os quadros pelo próprio Android (dumpsys gfxinfo) e capturando a
// tela no meio do arremesso para ver se há páginas vazias.
//
// Uso: node scripts/medicao/medirRolagem.mjs teste100.pdf [espera_ms=5000] [pasta_capturas=.]
//
// Atenção: contar quadros pelo JS (requestAnimationFrame) não funciona na
// WebView do Android, porque dá 7 a 9 por segundo até com a tela vazia. Use o gfxinfo.

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  PACOTE,
  adb,
  arremessar,
  arremessarSemEsperar,
  codigoAbrirPdf,
  conectar,
  dormir,
  encaminharWebView,
  recarregarNoModoContinuo,
} from "./devtools.mjs";

const [, , pdf, espera = "5000", pasta = "."] = process.argv;

encaminharWebView();
const devtools = await conectar();
await recarregarNoModoContinuo(devtools);
await devtools.avaliar(codigoAbrirPdf(pdf));
await dormir(Number(espera));

adb("shell", "dumpsys", "gfxinfo", PACOTE, "reset");
const arremessos = [[1900, 500], [1900, 500], [1900, 500], [500, 1900], [500, 1900], [1900, 500], [1900, 500]];
for (const [de, ate] of arremessos) {
  arremessar(de, ate);
  await dormir(350);
}
await dormir(800);
const linhas = adb("shell", "dumpsys", "gfxinfo", PACOTE).split("\n");
console.log(
  linhas
    .filter((l) => /Total frames|Janky frames:|percentile|Number Slow UI thread|Number Frame deadline/.test(l))
    .slice(0, 9)
    .join("\n"),
);

// Capturas ~300 ms depois de começar cada arremesso.
for (let i = 1; i <= 3; i++) {
  const arremesso = arremessarSemEsperar(1900, 400, 50);
  await dormir(300);
  const captura = join(pasta, `arremesso${i}.png`);
  writeFileSync(captura, execFileSync("adb", ["exec-out", "screencap", "-p"], { maxBuffer: 64 * 1024 * 1024 }));
  console.log(`captura: ${captura}`);
  await arremesso;
  await dormir(1200);
}
devtools.fechar();
