import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { Auth } from "firebase/auth";
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

const PAGINA_RETORNO =
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Leitor de PDF</title></head>' +
  '<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0">' +
  "<p>Login concluído. Pode fechar esta aba e voltar ao Leitor de PDF.</p></body></html>";

/**
 * O Google bloqueia login dentro da WebView: o login acontece no navegador do
 * sistema e volta por um servidor temporário em 127.0.0.1.
 */
async function entrarComGoogle(auth: Auth): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("O login com Google não está configurado neste app.");

  const [oauth, { openUrl }, { fetch }, google, firebaseAuth] = await Promise.all([
    import("@fabianlars/tauri-plugin-oauth"),
    import("@tauri-apps/plugin-opener"),
    import("@tauri-apps/plugin-http"),
    import("../lib/oauthGoogle"),
    import("firebase/auth"),
  ]);

  const { verificador, desafio } = await google.gerarPkce();
  const estado = google.gerarAleatorio();
  const porta = await oauth.start({ response: PAGINA_RETORNO });
  const redirectUri = `http://127.0.0.1:${porta}`;
  let pararDeOuvir = () => {};

  try {
    const retorno = new Promise<string>((resolve) => {
      oauth.onUrl(resolve).then((parar) => (pararDeOuvir = parar));
    });
    await openUrl(google.montarUrlAutorizacao({ clientId, redirectUri, desafio, estado }));

    const codigo = google.lerRetorno(await retorno, estado);
    if (!codigo) return;

    const idToken = await google.trocarCodigoPorIdToken(fetch, { clientId, clientSecret, codigo, verificador, redirectUri });
    await firebaseAuth.signInWithCredential(auth, firebaseAuth.GoogleAuthProvider.credential(idToken));
  } finally {
    pararDeOuvir();
    // O plugin costuma encerrar o servidor sozinho após a primeira resposta.
    await oauth.cancel(porta).catch(() => {});
  }
}

export const plataformaTauri: Plataforma = { nome: "tauri", escolherPdf, entrarComGoogle };
