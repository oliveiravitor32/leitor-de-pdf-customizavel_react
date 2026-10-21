# Medição de desempenho no celular

Scripts usados nas investigações de `docs/DECISOES.md` (ADR-004 e ADR-005). Eles controlam o app **de release** no aparelho real pelo protocolo do Chrome DevTools e pelo `adb`. Medições no navegador do PC ou no `tauri android dev` (Rust sem otimização) não representam o celular.

| Script | O que mede |
|---|---|
| `pdfTeste.mjs` | Gera o PDF de teste: 100 páginas tamanho carta, só texto e linhas. Não usa arquivos pessoais. |
| `medirRenderizacao.mjs` | Tempo do PDFium + ponte Rust↔JS e da montagem do `ImageBitmap`, por tipo de imagem (miniatura, nítida). Mostra também o formato da resposta: `ArrayBuffer` (bytes) ou `Array` (JSON). |
| `medirMiniaturas.mjs` | Tempo desde a abertura até todas as páginas terem imagem, e quantos `drawImage` aconteceram nesse período. |
| `medirRolagem.mjs` | Quadros desenhados durante arremessos de verdade (`dumpsys gfxinfo`) e capturas de tela no meio do arremesso. |

## Pré-requisitos

- Celular com depuração USB, aparecendo em `adb devices`. Node 22 ou mais novo (tem `WebSocket` nativo).
- **Uma versão temporária com a WebView inspecionável.** No `src-tauri/gen/android/app/src/main/java/.../MainActivity.kt`, adicione:

  ```kotlin
  import android.webkit.WebView
  // dentro de onCreate, depois de super.onCreate(...):
  WebView.setWebContentsDebuggingEnabled(true) // TEMPORÁRIO: medição, não commitar
  ```

  Gere o APK de release (`npm run tauri android build -- --apk --target aarch64`), assine com a chave de depuração e instale. **Desfaça a alteração logo depois do build** (`git checkout -- src-tauri/gen/android/app/src/main/java`). Ela nunca deve ir para um commit nem para a loja.

## Como rodar

Com o celular **desbloqueado** e o app aberto na tela, sem tocar nele durante a medição:

```bash
node scripts/medicao/pdfTeste.mjs 100 teste100.pdf
node scripts/medicao/medirRenderizacao.mjs teste100.pdf
node scripts/medicao/medirMiniaturas.mjs teste100.pdf
node scripts/medicao/medirRolagem.mjs teste100.pdf 5000
```

No fim, reinstale o APK normal e remova o encaminhamento de porta com `adb forward --remove-all`.

## Armadilhas encontradas

- **Contar quadros pelo JS (`requestAnimationFrame`) engana** na WebView do Android: dá 7 a 9 por segundo até com a tela vazia. Use o `dumpsys gfxinfo` do sistema.
- **`Input.synthesizeScrollGesture` não funciona** na WebView do Android e o script fica travado esperando a resposta. Use `adb shell input swipe`.
- **Tela bloqueada ou app em segundo plano:** a WebView fica com largura 0, e os tempos podem sair cerca de 2 vezes maiores (foi o que aconteceu na primeira medição do ADR-004). Confira com `adb shell dumpsys window | grep isKeyguardShowing`.
- **Estilos injetados persistem** até recarregar a página. Os scripts recarregam o app antes de cada medição, para uma não contaminar a outra.
