import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@fabianlars/tauri-plugin-oauth", () => ({ start: vi.fn(), cancel: vi.fn(), onUrl: vi.fn() }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: { credential: vi.fn((idToken: string) => ({ idToken })) },
  signInWithCredential: vi.fn(async () => ({})),
}));

import { invoke } from "@tauri-apps/api/core";
import { start } from "@fabianlars/tauri-plugin-oauth";
import { signInWithCredential } from "firebase/auth";
import { plataformaTauri } from "./tauri";

beforeEach(() => {
  vi.stubEnv("VITE_GOOGLE_WEB_CLIENT_ID", "web-cid");
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 15; moto g15)");
});
afterEach(() => vi.unstubAllEnvs());

describe("plataformaTauri.entrarComGoogle no Android", () => {
  it("usa o login nativo do Android com o ID do cliente Web e entra no Firebase", async () => {
    vi.mocked(invoke).mockResolvedValue({ idToken: "tok" });
    const auth = {} as never;

    await plataformaTauri.entrarComGoogle(auth);

    expect(invoke).toHaveBeenCalledWith("plugin:google-login|entrar", { clientId: "web-cid" });
    expect(signInWithCredential).toHaveBeenCalledWith(auth, { idToken: "tok" });
    expect(start).not.toHaveBeenCalled();
  });

  it("cancelar na janela do Google termina sem erro e sem login", async () => {
    vi.mocked(invoke).mockResolvedValue({ cancelado: true });
    await expect(plataformaTauri.entrarComGoogle({} as never)).resolves.toBeUndefined();
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it("sem o ID do cliente Web avisa que não está configurado", async () => {
    vi.stubEnv("VITE_GOOGLE_WEB_CLIENT_ID", "");
    await expect(plataformaTauri.entrarComGoogle({} as never)).rejects.toThrow(/não está configurado/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("erro do plugin nativo vira erro com mensagem", async () => {
    vi.mocked(invoke).mockRejectedValue("No credentials available");
    await expect(plataformaTauri.entrarComGoogle({} as never)).rejects.toThrow(/No credentials available/);
  });
});
