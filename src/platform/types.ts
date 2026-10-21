import type { Auth } from "firebase/auth";
import type { DocumentoMotor } from "../types";

/**
 * PDF escolhido pelo usuário. Na web (e ao arrastar) vem já lido em `dados`;
 * no Tauri vem só o `caminho`, para o Rust ler o arquivo sem passar os bytes pela ponte.
 */
export type ArquivoPdf = { nome: string } & ({ dados: ArrayBuffer; caminho?: never } | { caminho: string; dados?: never });

/** Tudo que depende da plataforma (navegador ou Tauri) passa por aqui. */
export interface Plataforma {
  nome: "web" | "tauri";
  /** Abre o seletor de arquivos; devolve null se o usuário cancelar. */
  escolherPdf(): Promise<ArquivoPdf | null>;
  /** Login com Google; o resultado chega pelo observador de conta do Firebase. */
  entrarComGoogle(auth: Auth): Promise<void>;
  /** Abre o PDF no motor da plataforma (pdf.js na web, PDFium no Tauri). */
  abrirDocumento(arquivo: ArquivoPdf): Promise<DocumentoMotor>;
}
