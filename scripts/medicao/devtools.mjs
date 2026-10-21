// Conexão com a WebView do app no celular pelo protocolo do Chrome DevTools
// (via `adb forward`), mais atalhos do adb. Ver README.md.

import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const PACOTE = "io.github.oliveiravitor32.leitorpdf";
export const PORTA = 9333;

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
export const adb = (...args) => String(execFileSync("adb", args));

/** Encaminha a porta local para o socket de depuração da WebView do app aberto. */
export function encaminharWebView() {
  const soquetes = adb("shell", "cat", "/proc/net/unix").match(/webview_devtools_remote_\d+/g);
  if (!soquetes) {
    throw new Error("WebView não inspecionável: o app está aberto e com a linha temporária no MainActivity.kt?");
  }
  adb("forward", `tcp:${PORTA}`, `localabstract:${soquetes.at(-1)}`);
}

/** Conecta na página do app e devolve `chamar` (método CDP) e `avaliar` (JS na página). */
export async function conectar() {
  const alvos = await (await fetch(`http://127.0.0.1:${PORTA}/json`)).json();
  const ws = new WebSocket(alvos.find((a) => a.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const chamar = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const meu = ++id;
      const limite = setTimeout(() => reject(new Error(`sem resposta: ${method}`)), 90_000);
      const aoReceber = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id !== meu) return;
        clearTimeout(limite);
        ws.removeEventListener("message", aoReceber);
        resolve(m);
      };
      ws.addEventListener("message", aoReceber);
      ws.send(JSON.stringify({ id: meu, method, params }));
    });
  const avaliar = async (expression) => {
    const r = await chamar("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "erro no JS");
    return r.result?.result?.value;
  };
  return { chamar, avaliar, fechar: () => ws.close() };
}

/** JS que abre o PDF no app soltando o arquivo na janela (mesmo caminho do arrastar e soltar). */
export function codigoAbrirPdf(caminhoPdf) {
  const base64 = readFileSync(caminhoPdf).toString("base64");
  return `(() => {
    const bin = atob("${base64}");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "teste.pdf", { type: "application/pdf" }));
    window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  })()`;
}

/** Recarrega o app no modo contínuo (o modo das medições). */
export async function recarregarNoModoContinuo({ chamar, avaliar }, instrumentacao) {
  await avaliar(`(() => {
    const chave = "leitorPdf:estado";
    const estado = JSON.parse(localStorage.getItem(chave) || "{}");
    localStorage.setItem(chave, JSON.stringify({ ...estado, layout: "continuo", modo: "original" }));
  })()`);
  await chamar("Page.enable");
  if (instrumentacao) await chamar("Page.addScriptToEvaluateOnNewDocument", { source: instrumentacao });
  await chamar("Page.reload", { ignoreCache: true });
  await dormir(2500);
}

/** Arremesso de verdade na tela (pixels do aparelho). O DevTools não rola a WebView do Android. */
export const arremessar = (deY, ateY, ms = 60) => adb("shell", "input", "swipe", "540", String(deY), "540", String(ateY), String(ms));

/** Mesmo arremesso, sem bloquear o script (para capturar a tela no meio dele). */
export const arremessarSemEsperar = (deY, ateY, ms = 60) =>
  new Promise((resolve) => execFile("adb", ["shell", "input", "swipe", "540", String(deY), "540", String(ateY), String(ms)], resolve));
