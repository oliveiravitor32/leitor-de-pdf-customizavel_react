import { categorias, type Categoria, type PartesPorCategoria } from "./categorias";
import type { EstadoLeitor } from "../types";

/** Momento (ms) da última alteração de cada categoria. */
export type Carimbos = Partial<Record<Categoria, number>>;

/** Quais categorias este dispositivo envia e recebe da nuvem. */
export type Ativas = Record<Categoria, boolean>;

export type DocRemoto = {
  preferencias: Partial<PartesPorCategoria>;
  atualizadoEm: Carimbos;
};

/** Só o identificador da conta: nenhum dado pessoal circula pelo app. */
export type Conta = { uid: string } | null;

/** O que a sincronização precisa da nuvem; a implementação real usa Firebase. */
export interface ServicoNuvem {
  observarConta(aoMudar: (conta: Conta) => void): () => void;
  ler(uid: string): Promise<DocRemoto | null>;
  gravar(uid: string, doc: DocRemoto): Promise<void>;
  apagar(uid: string): Promise<void>;
}

const nomesCategorias = Object.keys(categorias) as Categoria[];

export const todasAtivas: Ativas = Object.fromEntries(nomesCategorias.map((c) => [c, true])) as Ativas;

export function categoriasAlteradas(antes: EstadoLeitor, depois: EstadoLeitor): Categoria[] {
  return nomesCategorias.filter((c) => categorias[c].some((campo) => antes[campo] !== depois[campo]));
}

/** Copia só os campos da categoria, descartando o que vier a mais da nuvem. */
function camposDa(categoria: Categoria, origem: Partial<EstadoLeitor>): Partial<EstadoLeitor> {
  return Object.fromEntries(
    categorias[categoria].filter((campo) => campo in origem).map((campo) => [campo, origem[campo]]),
  );
}

/**
 * Para cada categoria ativa, a versão com o carimbo mais recente vence:
 * a da nuvem é aplicada localmente; a local vai em `paraEnviar`.
 */
export function mesclar(
  local: EstadoLeitor,
  carimbosLocais: Carimbos,
  remoto: DocRemoto | null,
  ativas: Ativas,
): { estado: EstadoLeitor; carimbos: Carimbos; paraEnviar: DocRemoto | null } {
  let estado = local;
  const carimbos = { ...carimbosLocais };
  const paraEnviar: DocRemoto = { preferencias: {}, atualizadoEm: {} };

  for (const c of nomesCategorias) {
    if (!ativas[c]) continue;
    const tLocal = carimbosLocais[c] ?? 0;
    const tRemoto = remoto?.atualizadoEm[c] ?? -1;
    const parteRemota = remoto?.preferencias[c];

    if (parteRemota && tRemoto > tLocal) {
      estado = { ...estado, ...camposDa(c, parteRemota) };
      carimbos[c] = tRemoto;
    } else if (tLocal > tRemoto) {
      Object.assign(paraEnviar.preferencias, { [c]: camposDa(c, local) });
      paraEnviar.atualizadoEm[c] = tLocal;
    }
  }

  const temEnvio = Object.keys(paraEnviar.preferencias).length > 0;
  return { estado, carimbos, paraEnviar: temEnvio ? paraEnviar : null };
}
