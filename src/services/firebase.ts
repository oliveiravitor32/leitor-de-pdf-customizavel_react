import type { FirebaseOptions } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

type Env = Record<string, string | undefined>;

/** Lê a config pública do Firebase; sem ela o app funciona só localmente. */
export function lerConfigFirebase(env: Env): FirebaseOptions | null {
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  return Object.values(config).every(Boolean) ? (config as FirebaseOptions) : null;
}

export type Firebase = { auth: Auth; db: Firestore };

let instancia: Promise<Firebase> | undefined;

/** Carrega o SDK sob demanda (fora do bundle inicial). Devolve null sem config. */
export function obterFirebase(): Promise<Firebase> | null {
  const config = lerConfigFirebase(import.meta.env);
  if (!config) return null;
  instancia ??= (async () => {
    const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);
    const app = initializeApp(config);
    return { auth: getAuth(app), db: getFirestore(app) };
  })();
  return instancia;
}
