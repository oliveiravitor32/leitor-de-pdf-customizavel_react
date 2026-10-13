import { useCallback, useEffect, useState } from "react";
import { mensagemErroLogin } from "../lib/mensagensLogin";
import type { ServicoNuvem } from "../lib/sincronizacao";
import { obterPlataforma } from "../platform";
import { obterFirebase } from "../services/firebase";

/** Carrega o Firebase sob demanda e expõe login/logout. Sem config, tudo fica null. */
export function useNuvem() {
  const [nuvem, setNuvem] = useState<ServicoNuvem | null>(null);
  const [erroLogin, setErroLogin] = useState("");
  const firebase = obterFirebase();

  useEffect(() => {
    if (!firebase) return;
    let ativo = true;
    Promise.all([firebase, import("../services/nuvemFirebase")]).then(([{ auth, db }, m]) => {
      if (ativo) setNuvem(m.criarNuvemFirebase(auth, db));
    });
    return () => {
      ativo = false;
    };
  }, [firebase]);

  const entrar = useCallback(async () => {
    if (!firebase) return;
    setErroLogin("");
    try {
      const { auth } = await firebase;
      await (await obterPlataforma()).entrarComGoogle(auth);
    } catch (e) {
      setErroLogin(mensagemErroLogin(e) ?? "");
    }
  }, [firebase]);

  const sair = useCallback(async () => {
    if (!firebase) return;
    const [{ auth }, { signOut }] = await Promise.all([firebase, import("firebase/auth")]);
    await signOut(auth);
  }, [firebase]);

  return { disponivel: Boolean(firebase), nuvem, entrar, sair, erroLogin };
}
