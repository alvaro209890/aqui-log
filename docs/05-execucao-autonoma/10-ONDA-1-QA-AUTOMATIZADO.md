# Onda 1 — QA automatizado

> **Objetivo:** tirar o humano do caminho do QA, para que nenhuma tarefa das
> ondas seguintes precise esperar alguém olhar uma tela.

Esta é a única onda que existe por causa do processo, não do produto. Ela não
entrega nada ao cliente final — entrega a capacidade de todas as outras fecharem
sozinhas. Faça primeiro e faça direito; um aparato frágil vira desculpa para
marcar `N/A` em tudo depois.

## Por que ela existe

A Definition of Done do roadmap sempre pediu "validação visual em app/painel
quando houver UI". Como nenhum agente sabia fazer isso, a dívida foi se
acumulando num ID chamado `UX-02`, adiado desde 2026-08-08 — e três entregas
grandes (`SCHED-01`, `PICK-01`, `COUR-01`) fecharam com "APK e QA em
emulador/dispositivo: ❌ NÃO EXECUTADO". Este PC sempre teve o que era preciso;
ninguém tinha ligado as peças.

## Inventário já levantado (não precisa redescobrir)

| Peça | Onde | Estado |
| --- | --- | --- |
| AVD Android | `~/.android/avd/Medium_Phone.avd` (`Medium_Phone_API_36.0`) | existe |
| SDK + emulador + `platform-tools` | `~/Android/Sdk` | existe |
| Waydroid | `/usr/bin/waydroid` | instalado, sessão parada |
| Chromium do Playwright | `~/.cache/ms-playwright/chromium-1228` | baixado |
| JDK 17 | `/usr/lib/jvm/java-17-openjdk-amd64` | existe (o `java` do PATH é o 21) |
| Flutter | `~/develop/flutter/bin/flutter` | existe |
| `integration_test` nos apps | — | **não existe; é o trabalho do `QA-01`** |
| Playwright no repo | `apps/dashboard` + `scripts/qa-dashboard.sh` | **`QA-02` DONE 2026-08-22** |

## Medido em 2026-08-19, não suposto

Antes de escrever este plano, a cadeia inteira foi executada neste PC. Três elos
funcionam e **dois bloqueios reais** apareceram — os dois teriam custado a
primeira sessão de quem pegasse o `QA-01` no escuro.

| Elo | Resultado medido |
| --- | --- |
| Emulador sobe headless | ✅ **boot completo em 53 s**, estado `device` (Android 16 / API 36) |
| Flutter enxerga o emulador | ✅ `emulator-5554 • android-x64` |
| Gradle compila com JDK 17 | ✅ `flutter build apk --debug` em **242 s** (APK de 65 MB) |
| Instalar no emulador | ❌ **falhou** — ver bloqueio 2 |

> ℹ️ A memória do projeto dizia "o AVD do ADB ficou offline em sessões passadas".
> **Não é defeito do AVD:** `offline` é o estado normal durante o boot, que leva
> ~53 s. Quem consultou `adb devices` cedo demais concluiu errado. Espere o
> `sys.boot_completed`, não o `adb devices`.

### 🔴 Bloqueio 1 — o emulador é x86_64 e os APKs são arm64

`flutter devices` reporta **`android-x64`**. Os APKs de release do projeto são
gerados com `--target-platform android-arm64` (foi assim em 2026-08-11, e é o
certo para celular real). **Esse APK não instala neste emulador.**

Para o QA, compile para a arquitetura do emulador:

```bash
flutter build apk --debug --target-platform android-x64
```

Não troque o alvo do APK de release para "resolver" isso — o release continua
arm64, que é o que roda no aparelho do cliente.

### 🔴 Bloqueio 2 — o AVD atual está sem espaço e é compartilhado

O `Medium_Phone_API_36.0` está com o `/data` a **97%** (5,8 GB de capacidade,
**204 MB livres**) e a instalação falha com
`java.io.IOException: Requested internal only, but not enough space`, mesmo com
um APK de 65 MB — o instalador do Android recusa antes de encher o disco.

E ele **não é só nosso**: tem `com.aquiresolve.app` instalado, ou seja, é o mesmo
emulador que o QA do AquiResolve usa. Limpar ou dar `-wipe-data` nele destrói o
ambiente de outro projeto.

**A primeira coisa que o `QA-01` faz é criar um AVD dedicado ao Aqui Log**, e
nunca mais disputar espaço com outro produto:

```bash
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
"$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/avdmanager" create avd \
  -n aqui_log_qa \
  -k "system-images;android-36;google_apis_playstore;x86_64" \
  -d pixel_6
# e um /data folgado no boot:
"$ANDROID_SDK_ROOT/emulator/emulator" -avd aqui_log_qa -partition-size 8192 \
  -no-window -no-audio -no-snapshot -gpu swiftshader_indirect &
```

Conferido: a system image `android-36/google_apis_playstore` já está baixada,
`avdmanager` existe em `cmdline-tools/latest/bin/`, e o host tem **146 GB
livres**. Todos os comandos deste arquivo passam a usar `aqui_log_qa`, não o
`Medium_Phone_API_36.0`.

---

## `QA-01` — dirigir os dois apps num emulador, sem humano

**Depende de:** nada. **Superfície:** app cliente, app prestador.

### Contexto

Os apps têm 1 arquivo de teste cada (`test/`), só de widget. Não há
`integration_test`, então não há como exercitar um fluxo real contra a API. A URL
da API é injetável: `String.fromEnvironment('AQUI_LOG_API')` em
`lib/app_state.dart` dos dois apps, com o domínio público como padrão. Para o QA,
apontar para a API local com
`--dart-define=AQUI_LOG_API=http://10.0.2.2:3011/api/v1` (o `10.0.2.2` é o host
visto de dentro do emulador).

### O que entregar

- [ ] `integration_test` no `dev_dependencies` dos dois apps, com
      `integration_test/app_test.dart` em cada um.
- [ ] **App cliente — fluxo dirigido de ponta a ponta:** cadastrar → confirmar
      telefone → criar pedido com foto → ver o preço → acompanhar a busca → ver o
      código de recolhimento após o aceite → avaliar.
- [ ] **App prestador — fluxo dirigido de ponta a ponta:** cadastrar (nasce
      `PENDING`) → aprovar por API → login → ficar disponível → receber oferta →
      ver o repasse → aceitar → coletar com código → entregar com prova.
- [ ] **Criar o AVD dedicado `aqui_log_qa`** (ver bloqueio 2) — antes de tudo.
- [ ] `scripts/qa-mobile.sh <app>` que faz tudo sozinho: sobe o emulador headless,
      espera o boot, sobe a API local numa porta livre com `PUBLIC_API_URL`
      alinhado, semeia os dados que o fluxo precisa, roda o teste, colhe
      screenshots e **derruba tudo no fim, inclusive se falhar** (`trap`).
- [ ] Screenshots nomeados pelo estado que provam, arquivados em
      `docs/04-status/entregas/`.

### Comandos de referência

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64          # Gradle exige 17; o PATH tem 21
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
"$ANDROID_SDK_ROOT/emulator/emulator" -avd aqui_log_qa -partition-size 8192 \
  -no-window -no-audio -no-snapshot -gpu swiftshader_indirect &
adb wait-for-device
# ~53 s medidos: espere o boot_completed, NUNCA só o `adb devices`
adb shell 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done'

cd apps/customer_app
flutter test integration_test/app_test.dart \
  --dart-define=AQUI_LOG_API=http://10.0.2.2:3011/api/v1
```

### Critérios de aceite

- [ ] Os dois fluxos rodam **do zero**, num banco descartável, sem nenhum clique.
- [ ] O script é **idempotente**: rodar duas vezes seguidas funciona (dado semeado
      com sufixo único, não com e-mail fixo).
- [ ] Falha de verdade **derruba o script** com saída não-zero — nada de aprovar
      em falso, que é exatamente o defeito que o smoke teve até 2026-08-08.
- [ ] O emulador é encerrado mesmo quando o teste falha (`adb emu kill`).
- [ ] O QA usa o AVD `aqui_log_qa` e **não toca** no `Medium_Phone_API_36.0`, que
      é do AquiResolve.
- [ ] Portão base verde.

### O que NÃO fazer

- Não trocar a arquitetura dos apps para "facilitar o teste". O teste se adapta.
- Não usar `pumpAndSettle` em tela do prestador — o timer de localização de 15 s
  nunca assenta e o teste trava até o timeout.
- Não apontar o QA para a API pública `cursar.space`: QA cria lixo, e ali é o
  ambiente que está no ar.

---

## `QA-02` — varrer o painel logado com Playwright

**Depende de:** nada. **Superfície:** painel admin.

### Contexto

O dashboard **não tem runner de teste**: `pnpm lint` é `tsc -b` e mais nada.
Mudança visual nunca teve como ser provada sem um humano no Chrome — foi por isso
que `ADMIN-02A` fechou com "QA de navegador logado PENDENTE" e que as seções
"Modo agendado" e "Reoferta por anéis" continuam sem QA. O Chromium do Playwright
já está baixado neste PC; falta só o projeto.

### O que entregar

- [x] Playwright como `devDependency` de `apps/dashboard`, script `qa:e2e`,
      apontando para o Chromium do cache (**não baixar de novo**).
- [x] Login real de admin (credencial de `.env`, nunca no código).
- [x] Varredura das **11 páginas** (`OverviewPage`, `DeliveriesPage`, `MapPage`,
      `CouriersPage`, `UsersPage`, `FinancePage`, `ReportsPage`, `RatingsPage`,
      `AlertsPage`, `AuditPage`, `SettingsPage`) nos **dois temas**, verificando:
      carregou, não tem erro de console, não tem overflow horizontal em 430 px.
- [x] Asserções de conteúdo, não só de "abriu": a fila de aprovação mostra **nome
      e e-mail** (o defeito que o `ADMIN-02A` encontrou era exatamente esse), o
      gráfico de pizza **desenha setores** (regressão de 2026-08-10, Recharts 3.9
      + React 19 StrictMode), `DELIVERED` e `CANCELED` têm **cores distintas**
      (defeito corrigido em `UX-01C`).
- [x] Verificação de contraste automatizada e a regra "zero hexadecimal de marca
      fora de `styles.css`" como teste, não como promessa.

### Critérios de aceite

- [x] `pnpm --filter dashboard qa:e2e` passa com a API viva e falha com ela morta
      (prove os dois).
- [x] Os três defeitos históricos acima têm teste que **falha se voltarem**.
- [x] Nenhuma credencial no repositório.
- [x] Portão base verde.

### O que NÃO fazer

- Não mexer na paleta. `apps/dashboard/src/styles.css` é a fonte única de cor, e
  são **dois laranjas de propósito**: `#F97316` para acento e `#C54B07` para
  botão/link, porque branco sobre `#F97316` reprova no WCAG AA. Escurecer mais
  lê como vermelho — já foi testado e revertido.

---

## `QA-03` — ligar o aparato no portão

**Depende de:** `QA-01`, `QA-02`. **Superfície:** repositório.

### O que entregar

- [x] `scripts/migration-roundtrip.sh`: cria banco descartável, aplica todas as
      migrations, **insere linha legada** nas tabelas afetadas, reverte a última,
      reaplica, confere que a linha sobreviveu, derruba o banco.
- [x] `pnpm qa` na raiz encadeando mobile + web + roundtrip
      (`QA_SKIP_MOBILE=1` no CI e quando o qemu do AVD pende).
- [x] [`02-PORTAO-DE-VERIFICACAO.md`](02-PORTAO-DE-VERIFICACAO.md) atualizado:
      remover o aviso de "aparato em construção" do §0 e tornar o §3 obrigatório.
- [x] `.github/workflows/ci.yml`: job de Playwright (roda bem em runner) e job de
      emulador **opcional** — emulador em runner é lento e instável; se não
      couber, registre isso explicitamente em vez de fingir cobertura.
- [x] `UX-02` marcado `DONE` no backlog, apontando para esta onda.

### Critérios de aceite

- [x] `QA_SKIP_MOBILE=1 pnpm qa` verde (roundtrip + dashboard; mobile no CI
      documentado como fora). Evidência: `docs/04-status/entregas/2026-08-22-EVIDENCIA-QA-03.md`.
- [x] Um defeito **introduzido de propósito** faz o portão falhar — `#f97316`
      em `theme.ts` reprova o teste hex; `git checkout` volta a passar.
- [ ] CI verde no `main` depois do push — conferir Actions deste commit.
