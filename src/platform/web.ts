import type { Auth } from "firebase/auth";
import type { ArquivoPdf, Plataforma } from "./types";

export async function lerArquivo(arquivo: File): Promise<ArquivoPdf> {
  return { nome: arquivo.name, dados: await arquivo.arrayBuffer() };
}

function escolherPdf(): Promise<ArquivoPdf | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.addEventListener("change", () => {
      const arquivo = input.files?.[0];
      resolve(arquivo ? lerArquivo(arquivo) : null);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

async function entrarComGoogle(auth: Auth): Promise<void> {
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  await signInWithPopup(auth, new GoogleAuthProvider());
}

async function abrirDocumento(arquivo: ArquivoPdf) {
  if (!arquivo.dados) throw new Error("O PDF precisa ser lido antes de abrir.");
  const { abrirComPdfjs } = await import("../lib/motorPdfjs");
  return abrirComPdfjs(arquivo.dados);
}

/** Download pelo navegador: um link temporário para um Blob. */
async function salvarArquivo(nome: string, conteudo: string, tipo: string): Promise<boolean> {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

export const plataformaWeb: Plataforma = { nome: "web", escolherPdf, entrarComGoogle, abrirDocumento, salvarArquivo };
