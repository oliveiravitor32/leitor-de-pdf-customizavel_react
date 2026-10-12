import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(async () => ({})),
}));

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { plataformaWeb } from "./web";

describe("plataformaWeb.entrarComGoogle", () => {
  it("usa o popup do Google", async () => {
    const auth = {} as never;
    await plataformaWeb.entrarComGoogle(auth);
    expect(signInWithPopup).toHaveBeenCalledWith(auth, expect.any(GoogleAuthProvider));
  });
});
