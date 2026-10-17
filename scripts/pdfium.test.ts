import { describe, expect, it } from "vitest";
import { ALVOS, VERSAO_PDFIUM, conferirHash } from "./pdfium.mjs";

describe("script do PDFium", () => {
  it("usa uma versão fixa", () => {
    expect(VERSAO_PDFIUM).toBe("chromium/8066");
  });

  it("coloca a .so do Android em jniLibs/<abi> e a dll do Windows na pasta de recursos", () => {
    expect(ALVOS["android-arm64"].destino).toBe("src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/libpdfium.so");
    expect(ALVOS["android-arm"].destino).toBe("src-tauri/gen/android/app/src/main/jniLibs/armeabi-v7a/libpdfium.so");
    expect(ALVOS["android-x64"].destino).toBe("src-tauri/gen/android/app/src/main/jniLibs/x86_64/libpdfium.so");
    expect(ALVOS["win-x64"].destino).toBe("src-tauri/pdfium/pdfium.dll");
  });

  it("todo alvo tem hash SHA-256 conhecido", () => {
    for (const alvo of Object.values(ALVOS)) expect(alvo.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("aceita o arquivo com o hash certo e recusa o adulterado", () => {
    const dados = new TextEncoder().encode("abc");
    const hashDeAbc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(() => conferirHash(dados, hashDeAbc)).not.toThrow();
    expect(() => conferirHash(dados, "0".repeat(64))).toThrow(/hash/i);
  });
});
