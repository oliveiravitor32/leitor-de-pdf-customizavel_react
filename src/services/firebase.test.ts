import { describe, expect, it } from "vitest";
import { lerConfigFirebase } from "./firebase";

describe("lerConfigFirebase", () => {
  it("devolve null se faltar alguma variável (app segue só local)", () => {
    expect(lerConfigFirebase({ VITE_FIREBASE_API_KEY: "x" })).toBeNull();
  });

  it("monta a config com todas as variáveis", () => {
    expect(
      lerConfigFirebase({
        VITE_FIREBASE_API_KEY: "k",
        VITE_FIREBASE_AUTH_DOMAIN: "d",
        VITE_FIREBASE_PROJECT_ID: "p",
        VITE_FIREBASE_APP_ID: "a",
      }),
    ).toEqual({ apiKey: "k", authDomain: "d", projectId: "p", appId: "a" });
  });
});
