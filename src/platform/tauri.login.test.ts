import { beforeEach, describe, expect, it, vi } from "vitest";

let aoReceberUrl: (url: string) => void = () => {};

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@fabianlars/tauri-plugin-oauth", () => ({
  start: vi.fn(async () => 5000),
  cancel: vi.fn(async () => {}),
  onUrl: vi.fn(async (cb: (url: string) => void) => {
    aoReceberUrl = cb;
    return () => {};
  }),
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: { credential: vi.fn((idToken: string) => ({ idToken })) },
  signInWithCredential: vi.fn(async () => ({})),
}));

import { openUrl } from "@tauri-apps/plugin-opener";
import { fetch } from "@tauri-apps/plugin-http";
import { cancel } from "@fabianlars/tauri-plugin-oauth";
import { signInWithCredential } from "firebase/auth";
import { plataformaTauri } from "./tauri";

beforeEach(() => {
  vi.stubEnv("VITE_GOOGLE_DESKTOP_CLIENT_ID", "cid");
  vi.stubEnv("VITE_GOOGLE_DESKTOP_CLIENT_SECRET", "seg");
});

async function aguardarNavegador() {
  await vi.waitFor(() => expect(openUrl).toHaveBeenCalled());
  return new URL(vi.mocked(openUrl).mock.calls[0][0] as string);
}

describe("plataformaTauri.entrarComGoogle", () => {
  it("abre o navegador, recebe o código e entra no Firebase com o id_token", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id_token: "tok" })));
    const auth = {} as never;
    const login = plataformaTauri.entrarComGoogle(auth);

    const url = await aguardarNavegador();
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:5000");
    aoReceberUrl(`http://127.0.0.1:5000/?code=abc&state=${url.searchParams.get("state")}`);

    await login;
    expect(signInWithCredential).toHaveBeenCalledWith(auth, { idToken: "tok" });
    expect(cancel).toHaveBeenCalledWith(5000);
  });

  it("servidor já encerrado pelo plugin não vira erro depois do login", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id_token: "tok" })));
    vi.mocked(cancel).mockRejectedValueOnce("server not running");
    const login = plataformaTauri.entrarComGoogle({} as never);
    const url = await aguardarNavegador();
    aoReceberUrl(`http://127.0.0.1:5000/?code=abc&state=${url.searchParams.get("state")}`);
    await expect(login).resolves.toBeUndefined();
    expect(signInWithCredential).toHaveBeenCalled();
  });

  it("a página de retorno declara UTF-8 para os acentos aparecerem", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id_token: "tok" })));
    const login = plataformaTauri.entrarComGoogle({} as never);
    const url = await aguardarNavegador();
    const { start } = await import("@fabianlars/tauri-plugin-oauth");
    expect(vi.mocked(start).mock.calls[0][0]?.response).toMatch(/<meta charset="utf-8">/i);
    aoReceberUrl(`http://127.0.0.1:5000/?code=abc&state=${url.searchParams.get("state")}`);
    await login;
  });

  it("cancelar no navegador termina sem erro e sem login", async () => {
    const login = plataformaTauri.entrarComGoogle({} as never);
    const url = await aguardarNavegador();
    aoReceberUrl(`http://127.0.0.1:5000/?error=access_denied&state=${url.searchParams.get("state")}`);
    await expect(login).resolves.toBeUndefined();
    expect(signInWithCredential).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });

  it("sem client id configurado avisa o usuário", async () => {
    vi.stubEnv("VITE_GOOGLE_DESKTOP_CLIENT_ID", "");
    await expect(plataformaTauri.entrarComGoogle({} as never)).rejects.toThrow(/não está configurado/i);
  });
});
