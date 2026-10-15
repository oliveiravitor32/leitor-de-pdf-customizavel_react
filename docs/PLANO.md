# Plano de desenvolvimento — remake multiplataforma

Cada etapa termina com o app **funcionando e commitado**. A web nunca pode quebrar.

## Etapa 0 — Preparação do repositório
- Criar a branch `remake`.
- Adicionar `CLAUDE.md`, `.env.example`, ajustar `.gitignore` (`dist/`, `*.tsbuildinfo`, `.env`, `src-tauri/target/`).
- Remover do git os arquivos gerados que estiverem versionados (`dist/`, `*.tsbuildinfo`).
- Configurar Vitest + Testing Library + jsdom (`npm test`, `npm run test:watch`).
- Escrever testes de caracterização do comportamento atual (`lib/predefinicoes.ts`, `useEstadoLeitor`) antes de refatorar.
- **Pronto quando:** `npm test` e `npm run build` passam e o repositório está limpo.

> A partir daqui, toda etapa segue TDD: primeiro o teste que falha, depois a implementação.

## Etapa 1 — Camada de plataforma (só web)
- Criar `src/platform/` (`types.ts`, `index.ts`, `web.ts`).
- Mover para lá a abertura de arquivo (hoje há `<input type="file">` em `App.tsx` e `ZonaDeArquivo.tsx`).
- **Pronto quando:** o app web se comporta exatamente como antes, mas os componentes chamam `platform.abrirPdf()`.

## Etapa 2 — Serviço de preferências
- Criar `src/services/settings.ts` com `carregar()`, `salvar()` e `assinar()`.
- Tirar o `localStorage` de `useEstadoLeitor.ts` e passar a usar o serviço.
- Separar no estado o que é **preferência** (sincroniza) do que é **sessão** (PDF aberto, página atual).
- **Pronto quando:** as preferências persistem como hoje, passando só pelo serviço.

## Etapa 3 — Deploy web na Vercel
- `vercel.json` (build `npm run build`, saída `dist`).
- Conectar o repositório na Vercel e conferir o worker do pdf.js em produção.
- **Pronto quando:** existe uma URL pública funcionando e o deploy é automático a cada push na `main`.

## Etapa 4 — Tauri desktop
- `npm i -D @tauri-apps/cli` → `npx tauri init` (devUrl `http://localhost:5173`, frontendDist `../dist`).
- Pré-requisitos no Windows: Rust (rustup), Microsoft C++ Build Tools, WebView2.
- Criar `src/platform/tauri.ts` com `plugin-dialog` + `plugin-fs` para abrir PDF.
- Configurar ícones e nome do app, depois rodar `tauri build` para gerar o instalador.
- **Pronto quando:** o instalador .msi abre, lê um PDF e salva preferências localmente.

## Etapa 5 — Firebase na web
- Criar o projeto no console do Firebase, ativar Auth (Google) e Firestore.
- `services/firebase.ts` e `services/auth.ts`, mais um botão de login/logout na UI.
- Integrar o Firestore ao `settings.ts` (merge por `updatedAt`, gravação com debounce).
- Publicar as regras de segurança do Firestore.
- **Pronto quando:** você loga na web, muda o tema, abre outro navegador, loga de novo e o tema está lá.

## Etapa 6 — Login no Tauri desktop
- Criar um OAuth Client ID no Google Cloud (tipo "Desktop").
- Fluxo navegador do sistema → `tauri-plugin-oauth` (localhost) → `signInWithCredential`.
- **Pronto quando:** você loga no desktop e as preferências da web aparecem.

## Etapa 7 — Mobile (Android)
- Pré-requisitos: Android Studio, SDK, NDK, `JAVA_HOME`.
- `npx tauri android init` e ajustar a UI para toque e telas pequenas (barra de ferramentas responsiva).
- Login via deep link `leitorpdf://auth` (`tauri-plugin-deep-link`).
- Abrir PDF pelo seletor do sistema e via "Abrir com" (intent).
- **Pronto quando:** o APK de debug roda no celular com login e sincronização funcionando.

## Etapa 8 — Distribuição
- Assinatura de código (Windows opcional no início; Android obrigatória para a Play Store).
- GitHub Actions: build desktop (Windows/macOS/Linux) e Android em cada tag `v*`.
- Opcional: auto-update (`tauri-plugin-updater`), iOS (exige Mac + conta Apple Developer).

## Etapa 7.5 — Performance: motor PDFium (Nível 3) + otimizações do Nível 1

**Objetivo:** usar o PDFium (motor em C++ do Chrome e do Android) via Rust (`pdfium-render`) no desktop e no Android. A web continua no pdf.js, como alternativa (regra 5 do CLAUDE.md). Todas as fases seguem TDD.

**Arquitetura**
- `src/platform`: nova interface `MotorPdf` com `abrir(dados)`, `paginas` (tamanhos), `renderizar(pagina, escala)`, `extrairTexto(pagina)` e `fechar()`.
  - Web: implementação com pdf.js (o código atual, adaptado).
  - Tauri: comandos Rust; as imagens voltam como bytes crus (RGBA) pelo IPC binário do Tauri, sem codificar em PNG.
- `src-tauri/src/pdf/`: módulo Rust com o documento aberto em memória, a renderização e a extração de texto (a reconstrução de parágrafos foi portada do `lib/pdf.ts`).
- Binários do PDFium: versão fixa `chromium/8066` (bblanchon/pdfium-binaries), baixada por um script com conferência de hash e **fora do git**.
  - Windows: `pdfium.dll` vai como recurso do instalador.
  - Android: `libpdfium.so` vai em `jniLibs/<abi>`.

**Fases**
1. **Interface `MotorPdf` + pdf.js adaptado** (sem mudar o comportamento).
2. **Gerenciador de renderização** (lógica pura, motor-agnóstica):
   - só as páginas visíveis ±2 ficam desenhadas, e o resto é liberado;
   - fila com uma renderização por vez, com prioridade para a página visível e cancelamento das que saíram da tela;
   - rascunho em baixa resolução antes da versão nítida;
   - teto de resolução no celular (densidade de pixels ≤ 1,5 e limite de pixels por página).
3. **Filtro de cor aplicado uma vez** no desenho (`ctx.filter`), no lugar do filtro CSS contínuo. Páginas memorizadas, para não re-renderizar ao mudar o número da página atual.
4. **Rust + PDFium:** script de download, módulo `pdf` e comandos, com testes `cargo test` usando um PDF de exemplo.
5. **`MotorPdf` do Tauri** em `platform/tauri.ts`, testado com mocks.
6. **Android:** empacotar `libpdfium.so` (arm64, arm, x64) e testar no celular.
7. **Medição** antes e depois (memória e tempo por página), com build **release**.

## Decisões tomadas (2026-10-12)

1. **Branch:** trabalho na `remake`, com merge na `main` ao fim de cada etapa.
2. **O que sincroniza:** só aparência (cores/predefinição) e preferências de usabilidade (fonte, tamanhos, espaçamento, modo). O usuário liga/desliga a sincronização **por categoria** (ex.: compartilhar cores, mas não a fonte). Categorias desligadas ficam só no dispositivo.
3. **Arquivos:** nenhum PDF, nome de arquivo ou progresso de leitura é salvo na nuvem por enquanto.
4. **Mobile:** Android primeiro, com publicação na Play Store ao final. iOS fica para depois.
5. **Login:** opcional. O app funciona sem conta, e o login só habilita a sincronização.

### Modelo de dados (implementado na Etapa 5)

```
users/{uid}
  preferencias: { cores: {...}, fonte: {...}, espacamento: {...}, modo: {...} }
  atualizadoEm: { cores: ms, fonte: ms, ... }
```

- As categorias ficam em `src/lib/categorias.ts`.
- **Os interruptores são por dispositivo** (ficam no `localStorage`). Uma categoria desligada neste dispositivo não é enviada nem recebida, mas continua na nuvem para os outros dispositivos.
- O botão **"Apagar meus dados"** remove o documento inteiro da nuvem e encerra a sessão. As preferências continuam no dispositivo.
- Para cada categoria, a mesclagem fica com a versão de carimbo mais recente.
- Regras de segurança em `firestore.rules`: só o dono acessa e só as chaves conhecidas são aceitas.
