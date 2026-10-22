import type { DocRemoto } from "./sincronizacao";

/**
 * Arquivo "Exportar meus dados": tudo o que o app guarda na nuvem sobre o
 * usuário (o uid e o documento de preferências), em JSON legível.
 */
export function montarExportacao({ uid, remoto, agora }: { uid: string; remoto: DocRemoto | null; agora: Date }): string {
  return JSON.stringify(
    {
      formato: "leitor-pdf-customizavel/exportacao",
      versao: 1,
      exportadoEm: agora.toISOString(),
      conta: { uid },
      nuvem: remoto,
    },
    null,
    2,
  );
}

export function nomeArquivoExportacao(agora: Date): string {
  return `leitor-pdf-meus-dados-${agora.toISOString().slice(0, 10)}.json`;
}
