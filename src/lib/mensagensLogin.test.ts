import { describe, expect, it } from "vitest";
import { mensagemErroLogin } from "./mensagensLogin";

describe("mensagemErroLogin", () => {
  it("cancelar o popup não é erro", () => {
    expect(mensagemErroLogin({ code: "auth/popup-closed-by-user" })).toBeNull();
    expect(mensagemErroLogin({ code: "auth/cancelled-popup-request" })).toBeNull();
  });

  it("traduz os códigos conhecidos", () => {
    expect(mensagemErroLogin({ code: "auth/popup-blocked" })).toMatch(/bloqueou a janela/i);
    expect(mensagemErroLogin({ code: "auth/network-request-failed" })).toMatch(/conexão/i);
    expect(mensagemErroLogin({ code: "auth/configuration-not-found" })).toMatch(/não está configurado/i);
    expect(mensagemErroLogin({ code: "auth/unauthorized-domain" })).toMatch(/não está configurado/i);
  });

  it("erro sem código conhecido usa a mensagem própria ou uma genérica", () => {
    expect(mensagemErroLogin(new Error("O login no app ainda não está disponível."))).toBe(
      "O login no app ainda não está disponível.",
    );
    expect(mensagemErroLogin({ code: "auth/outro", message: "Firebase: Error (auth/outro)." })).toBe(
      "Não foi possível entrar. Tente de novo.",
    );
  });
});
