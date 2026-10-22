import { useCallback, useEffect, useRef, useState } from "react";
import { montarExportacao } from "../lib/exportacao";
import type { Categoria } from "../lib/categorias";
import { categoriasAlteradas, mesclar, type Conta, type ServicoNuvem } from "../lib/sincronizacao";
import { carregarAtivas, carregarCarimbos, salvarAtivas, salvarCarimbos } from "../services/settings";
import type { EstadoLeitor } from "../types";

type Opcoes = {
  estado: EstadoLeitor;
  aplicar: (estado: EstadoLeitor) => void;
  /** Sem nuvem (Firebase não configurado) tudo continua só local. */
  nuvem: ServicoNuvem | null;
  /** Espera (ms) após a última alteração antes de enviar. */
  atraso?: number;
};

export function useSincronizacao({ estado, aplicar, nuvem, atraso = 1000 }: Opcoes) {
  const [conta, setConta] = useState<Conta>(null);
  const [ativas, setAtivas] = useState(carregarAtivas);
  const [erro, setErro] = useState("");

  // Último estado conhecido: estados vindos da nuvem são gravados aqui antes de
  // aplicar, para não serem confundidos com alterações do usuário.
  const anteriorRef = useRef(estado);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const ativasRef = useRef(ativas);
  ativasRef.current = ativas;
  const pendentesRef = useRef(new Set<Categoria>());

  const sincronizar = useCallback(
    async (uid: string) => {
      if (!nuvem) return;
      try {
        const remoto = await nuvem.ler(uid);
        const r = mesclar(estadoRef.current, carregarCarimbos(), remoto, ativasRef.current);
        salvarCarimbos(r.carimbos);
        if (r.estado !== estadoRef.current) {
          anteriorRef.current = r.estado;
          aplicar(r.estado);
        }
        if (r.paraEnviar) await nuvem.gravar(uid, r.paraEnviar);
        setErro("");
      } catch {
        setErro("Não foi possível sincronizar agora.");
      }
    },
    [nuvem, aplicar],
  );

  useEffect(() => {
    if (!nuvem) return;
    return nuvem.observarConta((novaConta) => {
      setConta(novaConta);
      if (novaConta) sincronizar(novaConta.uid);
    });
  }, [nuvem, sincronizar]);

  // Alterações do usuário: carimba as categorias e agenda o envio.
  useEffect(() => {
    const alteradas = categoriasAlteradas(anteriorRef.current, estado);
    anteriorRef.current = estado;
    if (alteradas.length === 0) return;

    const agora = Date.now();
    const carimbos = carregarCarimbos();
    for (const c of alteradas) {
      carimbos[c] = agora;
      pendentesRef.current.add(c);
    }
    salvarCarimbos(carimbos);
  }, [estado]);

  useEffect(() => {
    if (!nuvem || !conta || pendentesRef.current.size === 0) return;
    const timer = setTimeout(() => {
      const pendentes = [...pendentesRef.current].filter((c) => ativasRef.current[c]);
      pendentesRef.current.clear();
      if (pendentes.length === 0) return;
      // Reusa a mesclagem só com as categorias pendentes ligadas.
      const filtro = Object.fromEntries(Object.keys(ativasRef.current).map((c) => [c, pendentes.includes(c as Categoria)]));
      const { paraEnviar } = mesclar(estadoRef.current, carregarCarimbos(), null, filtro as typeof ativas);
      if (paraEnviar) nuvem.gravar(conta.uid, paraEnviar).catch(() => setErro("Não foi possível sincronizar agora."));
    }, atraso);
    return () => clearTimeout(timer);
  }, [estado, conta, nuvem, atraso]);

  const alternarCategoria = useCallback(
    (categoria: Categoria) => {
      const novas = { ...ativasRef.current, [categoria]: !ativasRef.current[categoria] };
      ativasRef.current = novas;
      setAtivas(novas);
      salvarAtivas(novas);
      // Ao religar, traz/envia o que estiver mais novo.
      if (novas[categoria] && conta) sincronizar(conta.uid);
    },
    [conta, sincronizar],
  );

  const apagarDadosNuvem = useCallback(async () => {
    if (!nuvem || !conta) return;
    await nuvem.apagar(conta.uid);
  }, [nuvem, conta]);

  /** JSON com tudo o que a nuvem guarda sobre o usuário (direito de acesso aos dados). */
  const exportarDadosNuvem = useCallback(async () => {
    if (!nuvem || !conta) throw new Error("Entre na conta para exportar os dados da nuvem.");
    return montarExportacao({ uid: conta.uid, remoto: await nuvem.ler(conta.uid), agora: new Date() });
  }, [nuvem, conta]);

  return { conta, ativas, erro, alternarCategoria, apagarDadosNuvem, exportarDadosNuvem };
}
