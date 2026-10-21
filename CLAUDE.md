# Leitor de PDF Customizável — contexto para o Claude Code

Responda sempre em **português do Brasil**, de forma direta.

> **Este projeto está em desenvolvimento com arquitetura TDD.** Para qualquer funcionalidade ou correção: **primeiro crie o teste** (e veja ele falhar), **depois implemente** a funcionalidade. Isso vale também para código nativo (Rust/Kotlin) dos plugins: separe a lógica testável e teste antes. Detalhes na seção "TDD (obrigatório)".

## Objetivo

Um leitor de PDF com aparência personalizável (cores, fonte, zoom, modo somente texto) disponível em **três alvos a partir de um único código React**:

| Alvo    | Como é gerado              | Distribuição                |
|---------|----------------------------|-----------------------------|
| Web     | `vite build` → `dist/`     | Vercel                      |
| Desktop | `tauri build`              | .msi/.exe, .dmg, AppImage   |
| Mobile  | `tauri android/ios build`  | APK/AAB, IPA                |

O usuário faz login com Google (Firebase Auth) e as preferências ficam salvas no Firestore, para que a experiência seja a mesma em qualquer dispositivo.

## Stack

- React 19 + TypeScript + Vite 6 + Tailwind 4
- Motor de PDF atrás da interface `DocumentoMotor` (`src/types`):
  - **Tauri (desktop/Android): PDFium** via Rust (`pdfium-render`, `src-tauri/src/pdf/`), com o pdf.js de reserva se a biblioteca não carregar;
  - **Web: `pdfjs-dist`** (o worker deve ser resolvido via `import.meta.url`, nunca por CDN).
- Renderização controlada por `useRenderizador`: só as páginas visíveis ±2 ficam na memória, uma renderização por vez, rascunho antes da versão nítida, filtro de cor aplicado no desenho.
- Tauri 2 (desktop + mobile), pasta `src-tauri/`
- Firebase: Auth (Google) + Firestore (plano Spark/gratuito)
- Deploy web: Vercel

## Arquitetura

```
src/
├─ components/   UI, 100% compartilhada
├─ hooks/        lógica de estado de UI
├─ lib/          pdf.ts, predefinicoes.ts (código puro, sem APIs de plataforma)
├─ types/
├─ platform/     ÚNICA camada que conhece a plataforma
│  ├─ types.ts   interface Platform
│  ├─ index.ts   detecta isTauri e carrega a implementação via import() dinâmico
│  ├─ web.ts     <input type=file>, download por Blob, signInWithPopup
│  └─ tauri.ts   plugin-dialog, plugin-fs, OAuth via navegador do sistema + deep link
├─ services/
│  ├─ firebase.ts   inicialização (config via variáveis VITE_FIREBASE_*)
│  ├─ auth.ts       login/logout; usa platform.signInWithGoogle()
│  └─ settings.ts   preferências: cache local + sincronização com Firestore
src-tauri/       projeto Rust do Tauri
vercel.json
```

### Regras

1. **Componentes e hooks nunca importam `@tauri-apps/*`** nem usam APIs exclusivas de uma plataforma. Tudo passa por `src/platform`.
2. **Preferências só são lidas/gravadas via `services/settings.ts`**, nunca com `localStorage` direto em componentes ou hooks.
3. O bundle web não pode carregar código do Tauri: use `import()` dinâmico em `platform/index.ts`.
4. Segredos não vão para o repositório. A config pública do Firebase vai no `.env` (`VITE_FIREBASE_*`), com um `.env.example` versionado.
5. Toda funcionalidade nova deve funcionar na web; se depender de recurso nativo, precisa de um fallback na implementação web.

### Login com Google

- **Web:** `signInWithPopup(auth, new GoogleAuthProvider())`.
- **Tauri:** popup/redirect do Firebase não funcionam na WebView e o Google bloqueia login embutido. Fluxo:
  1. abrir a URL OAuth do Google no navegador do sistema (`@tauri-apps/plugin-opener`);
  2. receber o retorno por deep link `leitorpdf://auth` (`tauri-plugin-deep-link`) ou por servidor localhost (`tauri-plugin-oauth`, só desktop);
  3. `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))`.

### Modelo de dados (Firestore)

```
users/{uid}
  preferencias: { tema, corFundo, corTexto, fonte, tamanhoFonte, zoom, zoomTexto, ... }
  updatedAt: timestamp
```

Regra de segurança: `allow read, write: if request.auth.uid == uid;`
Sincronização: o cache local é a fonte imediata. Ao logar, mesclar pelo `updatedAt` mais recente. Gravações no Firestore com debounce (~1 s).

## Decisões de arquitetura

As decisões técnicas importantes ficam em `docs/DECISOES.md` (formato ADR). Ao resolver um problema não óbvio, sobretudo de desempenho, registre o contexto, as hipóteses testadas, as medições de antes e depois e as alternativas descartadas.

## Comandos

- `npm run pdfium:baixar`: baixa os binários do PDFium (versão fixa, hash conferido) para `src-tauri/pdfium/` e `jniLibs/`. **Obrigatório uma vez antes de qualquer build/teste do Tauri** (`cargo test` também usa a DLL).
- `npm run dev`: web local
- `npm run build`: build web (é o que a Vercel roda)
- `npm run tauri dev` / `npm run tauri build`: desktop
- `npm run tauri android dev`: mobile (exige Android Studio/SDK; iOS só em macOS)

## Skills do projeto (`.claude/skills/`)

As skills foram escritas para outras stacks; aqui elas valem com estas adaptações:

- **privacy-by-design-rails** (automática, sem comando): o scanner Ruby e os exemplos Rails **não se aplicam**. Use só os princípios (`references/pii-definition.md`, minimização, consentimento, DSAR, retenção), traduzidos para React + Firebase:
  - no Firestore, só preferências e o `uid`. Nada de nome, e-mail ou foto copiados do perfil Google, e nenhum nome ou conteúdo de PDF;
  - nunca logar (`console.*`) token, e-mail ou dados do usuário;
  - regras do Firestore restritas ao dono (`request.auth.uid == uid`);
  - o usuário precisa conseguir **exportar e apagar** os próprios dados (botão "excluir conta/dados");
  - segredos fora do git (`.env`), e analytics só com consentimento.
- **privacy-assessment-rails**: o Passo 1 (scanner Ruby) é pulado, porque não há Ruby nem Rails. Faça a análise manual (Passo 2 em diante) mapeando os itens do checklist para Firebase/Tauri e marque como N/A os itens exclusivos de Rails (`encrypts`, `filter_attributes`, ransack, jobs, mailers).
- **review-that-runs**: forge = GitHub (`gh`). Gates = `npm ci` + `npm test` + `npm run build`. Para a validação no navegador, use o **navegador embutido** (`mcp__Claude_Browser__*`) no lugar do Chrome DevTools MCP. Estamos no Windows, então use Git Bash; sem `setsid`, mate os processos pelo PID ou use `preview_stop`.
- **sherlock**: usa a suíte do Vitest (ver TDD abaixo) como baseline e métrica de antes/depois.

## TDD (obrigatório)

O projeto é desenvolvido com **TDD**: vermelho → verde → refatorar.

1. Escreva primeiro um teste que falha descrevendo o comportamento esperado.
2. Implemente o mínimo necessário para passar.
3. Refatore com os testes verdes.

- **Ferramentas:** Vitest + @testing-library/react + jsdom (`npm test` e `npm run test:watch`).
- Os testes ficam ao lado do código: `arquivo.ts` → `arquivo.test.ts`.
- Código novo não entra sem teste. Bug corrigido ganha antes um teste que o reproduz.
- `src/platform` e `src/services` são testados com mocks da interface `Platform` e do Firebase (sem rede). O Firestore real só é usado em testes de integração com o Emulator Suite.
- Antes de commitar, `npm test` e `npm run build` devem passar. Esses dois comandos são também os gates usados por `/review-that-runs` e o baseline do `/sherlock`.

## ⚠️ Antes de qualquer publicação oficial

Antes de gerar build de **release** para loja (Play Store, Microsoft Store, App Store) ou publicar uma versão oficial, **pare e avise o autor**. Peça para ele confirmar:

- o **identificador** do app (`identifier` em `src-tauri/tauri.conf.json`, hoje `io.github.oliveiravitor32.leitorpdf`). Ele vira o nome do pacote na Play Store e **não pode ser mudado depois de publicado**;
- o **nome do produto** (`productName`) e o título da janela;
- a versão (`version`) e os ícones (`src-tauri/icons/`);
- **o cliente OAuth do Android para a loja.** O cliente atual ("Android (debug)", ID `271094971310-8r1oe6sgsp6nk252p107inki3cb31bmh`) só vale para testes: pacote `io.github.oliveiravitor32.leitorpdf.debug` + SHA-1 da chave de depuração do PC. Para publicar, crie **outro** cliente Android no Google Cloud com o pacote **sem** `.debug` e o SHA-1 da chave de assinatura do Google Play (Play Console → Proteção do Play → Assinatura de apps). Sem isso, o login com Google não funciona no app da loja.

Não prossiga sem a confirmação explícita.

## Convenções

- Nomes de código em português, seguindo o que já existe (`useEstadoLeitor`, `BarraFerramentas`...).
- **Commits convencionais** (Conventional Commits): `tipo(escopo opcional): descrição`.
  - Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `style`.
  - Descrição curta, simples e clara, em português, no imperativo e com minúscula. Ex.: `feat(platform): abre PDF pelo diálogo nativo`.
  - Um assunto por commit. Corpo só quando o "porquê" não for óbvio.
- Rode `npm run build` antes de commitar (inclui checagem de tipos).
