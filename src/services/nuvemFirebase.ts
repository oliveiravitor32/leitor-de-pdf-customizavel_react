import { onAuthStateChanged, type Auth } from "firebase/auth";
import { deleteDoc, doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import type { DocRemoto, ServicoNuvem } from "../lib/sincronizacao";

/** Guarda as preferências em users/{uid}. Só o uid sai do objeto do Firebase. */
export function criarNuvemFirebase(auth: Auth, db: Firestore): ServicoNuvem {
  const ref = (uid: string) => doc(db, "users", uid);
  return {
    observarConta: (aoMudar) => onAuthStateChanged(auth, (usuario) => aoMudar(usuario ? { uid: usuario.uid } : null)),
    async ler(uid) {
      const snap = await getDoc(ref(uid));
      return snap.exists() ? (snap.data() as DocRemoto) : null;
    },
    gravar: (uid, dados) => setDoc(ref(uid), dados, { merge: true }),
    apagar: (uid) => deleteDoc(ref(uid)),
  };
}
