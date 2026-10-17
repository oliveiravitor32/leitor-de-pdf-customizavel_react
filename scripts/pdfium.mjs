// Baixa os binários do PDFium (bblanchon/pdfium-binaries) numa versão fixa,
// confere o SHA-256 e copia para onde o Tauri espera. Os binários ficam fora do git.
//
// Uso: npm run pdfium:baixar [-- alvo ...]   (sem alvos = todos)

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VERSAO_PDFIUM = "chromium/8066";

const JNI = "src-tauri/gen/android/app/src/main/jniLibs";

export const ALVOS = {
  "win-x64": {
    arquivo: "pdfium-win-x64.tgz",
    sha256: "739a57d597d864297909cc40a2411eba728490c76a0fa25e3ea299c7f6b07020",
    dentroDoPacote: "bin/pdfium.dll",
    destino: "src-tauri/pdfium/pdfium.dll",
  },
  "android-arm64": {
    arquivo: "pdfium-android-arm64.tgz",
    sha256: "a665e3a9d40fb0024e3959261a400a722a13f7aa6602c59a82c93d44a362c055",
    dentroDoPacote: "lib/libpdfium.so",
    destino: `${JNI}/arm64-v8a/libpdfium.so`,
  },
  "android-arm": {
    arquivo: "pdfium-android-arm.tgz",
    sha256: "0812590de0a652f3c6620263316374a97134d8c0157ad1867005e53cf87e30c5",
    dentroDoPacote: "lib/libpdfium.so",
    destino: `${JNI}/armeabi-v7a/libpdfium.so`,
  },
  "android-x64": {
    arquivo: "pdfium-android-x64.tgz",
    sha256: "44b9444d58f055ab892019aea27423bab74d671a37b5bad84647a91abec82a1d",
    dentroDoPacote: "lib/libpdfium.so",
    destino: `${JNI}/x86_64/libpdfium.so`,
  },
};

export function conferirHash(dados, esperado) {
  const obtido = createHash("sha256").update(dados).digest("hex");
  if (obtido !== esperado) {
    throw new Error(`Hash não confere (esperado ${esperado}, obtido ${obtido}). Arquivo recusado.`);
  }
}

async function baixar(nome, alvo, raiz) {
  const url = `https://github.com/bblanchon/pdfium-binaries/releases/download/${VERSAO_PDFIUM}/${alvo.arquivo}`;
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`${nome}: download falhou (${resposta.status})`);
  const dados = new Uint8Array(await resposta.arrayBuffer());
  conferirHash(dados, alvo.sha256);

  const temp = mkdtempSync(join(tmpdir(), "pdfium-"));
  try {
    const pacote = join(temp, alvo.arquivo);
    writeFileSync(pacote, dados);
    // Caminho relativo: o tar do Git Bash confunde "C:" com um host remoto.
    execFileSync("tar", ["-xzf", alvo.arquivo], { cwd: temp });
    const destino = join(raiz, alvo.destino);
    mkdirSync(dirname(destino), { recursive: true });
    copyFileSync(join(temp, alvo.dentroDoPacote), destino);
    console.log(`${nome}: ok -> ${alvo.destino}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

const executadoDireto = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const pedidos = process.argv.slice(2);
  const nomes = pedidos.length > 0 ? pedidos : Object.keys(ALVOS);
  for (const nome of nomes) {
    if (!ALVOS[nome]) throw new Error(`Alvo desconhecido: ${nome}. Use: ${Object.keys(ALVOS).join(", ")}`);
    if (existsSync(join(raiz, ALVOS[nome].destino)) && !process.env.PDFIUM_FORCAR) {
      console.log(`${nome}: já existe, pulando (PDFIUM_FORCAR=1 para baixar de novo)`);
      continue;
    }
    await baixar(nome, ALVOS[nome], raiz);
  }
}
