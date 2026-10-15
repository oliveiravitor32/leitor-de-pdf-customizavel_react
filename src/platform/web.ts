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

async function abrirDocumento(dados: ArrayBuffer) {
  const { abrirComPdfjs } = await import("../lib/motorPdfjs");
  return abrirComPdfjs(dados);
}

export const plataformaWeb: Plataforma = { nome: "web", escolherPdf, entrarComGoogle, abrirDocumento };
