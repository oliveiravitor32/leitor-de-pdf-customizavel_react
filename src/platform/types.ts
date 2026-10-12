/** PDF já lido para a memória, independente de onde veio (input, diálogo nativo, arrastar). */
export type ArquivoPdf = {
  nome: string;
  dados: ArrayBuffer;
};

/** Tudo que depende da plataforma (navegador ou Tauri) passa por aqui. */
export interface Plataforma {
  nome: "web" | "tauri";
  /** Abre o seletor de arquivos; devolve null se o usuário cancelar. */
  escolherPdf(): Promise<ArquivoPdf | null>;
}
