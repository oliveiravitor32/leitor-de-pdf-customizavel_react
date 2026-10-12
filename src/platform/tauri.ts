import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ArquivoPdf, Plataforma } from "./types";

async function escolherPdf(): Promise<ArquivoPdf | null> {
  const caminho = await open({ multiple: false, directory: false, filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (!caminho) return null;
  const bytes = await readFile(caminho);
  return {
    nome: caminho.split(/[\\/]/).pop() ?? caminho,
    dados: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  };
}

async function entrarComGoogle(): Promise<void> {
  // Etapa 6: navegador do sistema + retorno ao app (popup não funciona na WebView).
  throw new Error("O login no app ainda não está disponível. Use a versão web por enquanto.");
}

export const plataformaTauri: Plataforma = { nome: "tauri", escolherPdf, entrarComGoogle };
