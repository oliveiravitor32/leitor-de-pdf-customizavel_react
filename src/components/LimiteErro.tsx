import { Component, type ReactNode } from "react";

type Estado = { erro: Error | null };

/** Se algum componente quebrar, mostra o erro na tela em vez de deixar tudo branco. */
export class LimiteErro extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold">Algo deu errado.</p>
        <p className="max-w-md break-words text-sm opacity-70">{erro.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="cursor-pointer rounded-lg border border-current/30 px-4 py-2 text-sm"
        >
          Recarregar
        </button>
      </div>
    );
  }
}
