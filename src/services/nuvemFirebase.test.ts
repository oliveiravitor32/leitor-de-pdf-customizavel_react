import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, ...caminho: string[]) => caminho.join("/")),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: vi.fn() }));

import { deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { criarNuvemFirebase } from "./nuvemFirebase";

const nuvem = criarNuvemFirebase({} as never, {} as never);

describe("nuvemFirebase", () => {
  it("grava em users/{uid} mesclando por categoria", async () => {
    const doc = { preferencias: { modo: { modo: "leitura" as const } }, atualizadoEm: { modo: 1 } };
    await nuvem.gravar("u1", doc);
    expect(setDoc).toHaveBeenCalledWith("users/u1", doc, { merge: true });
  });

  it("ler devolve null quando o documento não existe", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    expect(await nuvem.ler("u1")).toBeNull();
  });

  it("ler devolve o documento existente", async () => {
    const dados = { preferencias: {}, atualizadoEm: {} };
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => dados } as never);
    expect(await nuvem.ler("u1")).toEqual(dados);
  });

  it("apagar remove o documento", async () => {
    await nuvem.apagar("u1");
    expect(deleteDoc).toHaveBeenCalledWith("users/u1");
  });

  it("observarConta expõe só o uid", () => {
    vi.mocked(onAuthStateChanged).mockImplementation((_a, cb) => {
      (cb as (u: unknown) => void)({ uid: "u1", email: "x@y.com", displayName: "Fulano" });
      return () => {};
    });
    const recebido = vi.fn();
    nuvem.observarConta(recebido);
    expect(recebido).toHaveBeenCalledWith({ uid: "u1" });
  });
});
