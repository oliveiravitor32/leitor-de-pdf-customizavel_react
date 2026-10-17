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

/** O plugin serve sempre a mesma página; ela mesma lê o endereço para saber se houve cancelamento. */
export function paginaRetorno(): string {
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Leitor de PDF</title></head>' +
    '<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0">' +
    '<p id="m">Pode fechar esta aba e voltar ao Leitor de PDF.</p>' +
    "<script>" +
    'document.getElementById("m").textContent = new URLSearchParams(location.search).has("error")' +
    ' ? "Login cancelado. Pode fechar esta aba e voltar ao Leitor de PDF."' +
    ' : "Login concluído. Pode fechar esta aba e voltar ao Leitor de PDF.";' +
    "</script></body></html>"
  );
}

/**
 * O Google bloqueia login dentro da WebView: o login acontece no navegador do
 * sistema e volta por um servidor temporário em 127.0.0.1.
 */
async function entrarComGoogle(auth: Auth): Promise<void> {
  return /android/i.test(navigator.userAgent) ? entrarNoAndroid(auth) : entrarNoDesktop(auth);
}

type RespostaLoginAndroid = { idToken?: string; cancelado?: boolean };

/** Android: janela nativa de contas do Google (Credential Manager), pelo plugin google-login. */
async function entrarNoAndroid(auth: Auth): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) throw new Error("O login com Google não está configurado neste app.");

  const [{ invoke }, firebaseAuth] = await Promise.all([import("@tauri-apps/api/core"), import("firebase/auth")]);
  let resposta: RespostaLoginAndroid;
  try {
    resposta = await invoke<RespostaLoginAndroid>("plugin:google-login|entrar", { clientId });
  } catch (e) {
    throw new Error(typeof e === "string" ? e : (e as Error).message);
  }
  if (resposta.cancelado || !resposta.idToken) return;
  await firebaseAuth.signInWithCredential(auth, firebaseAuth.GoogleAuthProvider.credential(resposta.idToken));
}

async function entrarNoDesktop(auth: Auth): Promise<void> {
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
  const porta = await oauth.start({ response: paginaRetorno() });
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

/** PDFium (nativo, rápido); se a biblioteca não carregar, o pdf.js garante que o PDF abre. */
async function abrirDocumento(dados: ArrayBuffer) {
  try {
    const { abrirComPdfium } = await import("./motorPdfium");
    const documento = await abrirComPdfium(dados);
    console.info("[pdf] motor: PDFium");
    return documento;
  } catch (e) {
    // Aparece no logcat (Android) e no console do desktop: dá para saber qual motor está ativo.
    const motivo = e instanceof Error ? e.message : String(e);
    console.warn("[pdf] PDFium indisponível, usando pdf.js:", motivo);
    const { abrirComPdfjs } = await import("../lib/motorPdfjs");
    return { ...(await abrirComPdfjs(dados)), motivoReserva: motivo };
  }
}

export const plataformaTauri: Plataforma = { nome: "tauri", escolherPdf, entrarComGoogle, abrirDocumento };
