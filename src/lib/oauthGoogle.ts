/**
 * Login com Google para apps nativos (RFC 8252): o navegador do sistema faz o
 * login e devolve um código para um servidor em 127.0.0.1; o app troca o
 * código por um id_token usando PKCE.
 */

const URL_AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
const URL_TOKEN = "https://oauth2.googleapis.com/token";

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function gerarAleatorio(tamanho = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(tamanho)));
}

export async function gerarPkce(verificador = gerarAleatorio()): Promise<{ verificador: string; desafio: string }> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador));
  return { verificador, desafio: base64url(new Uint8Array(hash)) };
}

/** Pede só `openid`: basta o uid, sem e-mail nem dados do perfil. */
export function montarUrlAutorizacao(p: { clientId: string; redirectUri: string; desafio: string; estado: string }): string {
  const params = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: "openid",
    code_challenge: p.desafio,
    code_challenge_method: "S256",
    state: p.estado,
    prompt: "select_account",
  });
  return `${URL_AUTORIZACAO}?${params}`;
}

/** Código de autorização do retorno; null se o usuário cancelou. */
export function lerRetorno(url: string, estadoEsperado: string): string | null {
  const params = new URL(url).searchParams;
  if (params.get("state") !== estadoEsperado) throw new Error("Resposta de login inválida. Tente de novo.");
  if (params.get("error")) return null;
  return params.get("code");
}

type Buscar = (url: string, init: RequestInit) => Promise<Response>;

export async function trocarCodigoPorIdToken(
  buscar: Buscar,
  p: { clientId: string; clientSecret: string; codigo: string; verificador: string; redirectUri: string },
): Promise<string> {
  const resposta = await buscar(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: p.codigo,
      code_verifier: p.verificador,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      redirect_uri: p.redirectUri,
    }).toString(),
  });
  const dados = (await resposta.json()) as { id_token?: string };
  if (!resposta.ok || !dados.id_token) throw new Error("O Google recusou o login. Tente de novo.");
  return dados.id_token;
}
