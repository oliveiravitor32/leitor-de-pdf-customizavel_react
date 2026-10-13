import { describe, expect, it, vi } from "vitest";
import { gerarPkce, lerRetorno, montarUrlAutorizacao, trocarCodigoPorIdToken } from "./oauthGoogle";

describe("gerarPkce", () => {
  it("gera verificador aleatório e desafio S256 em base64url", async () => {
    const a = await gerarPkce();
    const b = await gerarPkce();
    expect(a.verificador).not.toBe(b.verificador);
    expect(a.verificador).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(a.desafio).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("desafio é o SHA-256 do verificador (vetor da RFC 7636)", async () => {
    const { desafio } = await gerarPkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(desafio).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("montarUrlAutorizacao", () => {
  it("pede só openid (sem e-mail nem perfil) com PKCE", () => {
    const url = new URL(
      montarUrlAutorizacao({ clientId: "cid", redirectUri: "http://127.0.0.1:5000", desafio: "d", estado: "e" }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "cid",
      redirect_uri: "http://127.0.0.1:5000",
      response_type: "code",
      scope: "openid",
      code_challenge: "d",
      code_challenge_method: "S256",
      state: "e",
      prompt: "select_account",
    });
  });
});

describe("lerRetorno", () => {
  it("devolve o código quando o estado confere", () => {
    expect(lerRetorno("http://127.0.0.1:5000/?code=abc&state=e", "e")).toBe("abc");
  });

  it("devolve null quando o usuário cancela", () => {
    expect(lerRetorno("http://127.0.0.1:5000/?error=access_denied&state=e", "e")).toBeNull();
  });

  it("rejeita estado diferente (proteção contra CSRF)", () => {
    expect(() => lerRetorno("http://127.0.0.1:5000/?code=abc&state=x", "e")).toThrow();
  });
});

describe("trocarCodigoPorIdToken", () => {
  it("troca o código pelo id_token", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify({ id_token: "tok" }), { status: 200 }));
    const token = await trocarCodigoPorIdToken(buscar, {
      clientId: "cid",
      clientSecret: "seg",
      codigo: "abc",
      verificador: "v",
      redirectUri: "http://127.0.0.1:5000",
    });
    expect(token).toBe("tok");
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    const corpo = new URLSearchParams(init.body as string);
    expect(corpo.get("grant_type")).toBe("authorization_code");
    expect(corpo.get("code_verifier")).toBe("v");
  });

  it("falha com mensagem quando o Google recusa", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    await expect(
      trocarCodigoPorIdToken(buscar, { clientId: "c", clientSecret: "s", codigo: "x", verificador: "v", redirectUri: "r" }),
    ).rejects.toThrow(/login/i);
  });
});
