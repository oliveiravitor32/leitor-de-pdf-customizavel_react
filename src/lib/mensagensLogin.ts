const mensagens: Record<string, string | null> = {
  "auth/popup-closed-by-user": null,
  "auth/cancelled-popup-request": null,
  "auth/popup-blocked": "O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet. Verifique e tente de novo.",
  "auth/configuration-not-found": "O login com Google não está configurado neste servidor.",
  "auth/unauthorized-domain": "O login com Google não está configurado para este endereço.",
};

/** Texto amigável para um erro de login; null quando o usuário só cancelou. */
export function mensagemErroLogin(erro: unknown): string | null {
  const { code, message } = (erro ?? {}) as { code?: string; message?: string };
  if (code) return code in mensagens ? mensagens[code] : "Não foi possível entrar. Tente de novo.";
  return message || "Não foi possível entrar. Tente de novo.";
}
