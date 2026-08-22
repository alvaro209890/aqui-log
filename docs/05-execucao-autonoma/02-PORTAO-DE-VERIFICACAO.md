# Portão de verificação — nenhuma tarefa fecha sem passar aqui

> Substitui "validação visual quando houver UI" por comandos que um agente roda
> sozinho. Herda a Definition of Done do
> [`../02-planejamento/01-ROADMAP.md`](../02-planejamento/01-ROADMAP.md) §9 e
> acrescenta as camadas que faltavam.

## 0. Versão do portão

Depois de `QA-03` (2026-08-22) vale o portão **completo** (§2 + §3).
`N/A` em QA de app ou de navegador só é aceitável se a tarefa **não tocou**
naquela superfície, e precisa dizer qual superfície não foi tocada.

Marcar `N/A` sem justificativa é a mesma coisa que mentir. `Não executado` é uma
resposta honesta; `deve passar` não é resposta nenhuma.

## 1. Ambiente antes de começar

```bash
cd ~/Documentos/aqui-log
test -f .env || cp .env.example .env
docker compose --env-file .env -f infra/docker-compose.yml up -d   # Postgres 5433 + Redis 6379
```

Três armadilhas deste PC, todas já custaram sessão:

- **A porta 3000 costuma estar ocupada.** Suba a API numa porta livre e passe
  `PORT` **e** `PUBLIC_API_URL` juntos — `PUBLIC_API_URL` define a URL que a
  presign devolve, e desalinhada do `API_URL` que o smoke chama o upload de prova
  falha. Desde 2026-08-08 o smoke aborta nesse caso em vez de aprovar em falso.
- **Banco descartável não exige mexer no `.env`:** `DATABASE_NAME=aqui_log_<id>`
  na linha de comando basta — variável já no ambiente não é sobrescrita pelo
  `dotenv`.
- **Não carregue o `.env` com `. ./.env`** — valores como `ADMIN_NAME` têm espaço
  e quebram o shell. A aplicação lê sozinha.

## 2. Portão base — sempre

```bash
pnpm build
pnpm lint
pnpm test
pnpm smoke

cd apps/customer_app && flutter analyze && flutter test && cd -
cd apps/courier_app  && flutter analyze && flutter test && cd -
cd packages/aqui_log_core && dart analyze && dart test && cd -
```

Mais, quando aplicável à tarefa:

- [ ] **Migration ida e volta** em banco descartável — `up`, `down`, `up` de novo,
      com pelo menos **uma linha legada dentro das tabelas afetadas** sobrevivendo
      aos três passos. Migration aditiva; nada de `synchronize=true`.
- [ ] **Autorização por papel testada** — o que `CUSTOMER`, `COURIER` e admin
      podem e não podem ver. Rota nova que devolve entrega **tem que passar pelo
      recorte de `present()`** em `deliveries.service.ts`, senão vaza `pickupCode`
      ou `priceBoostProposal` para o app do prestador. Já vazou uma vez.
- [ ] **Pelo menos um caminho de erro exercitado de verdade** — não só o feliz.
- [ ] **Pedido legado continua legível** — o fallback de `notes` não morre sem
      tarefa própria.

## 3. Portão de QA — depois de `QA-03`

```bash
# navegador logado, sem humano
pnpm --filter dashboard qa:e2e

# app em aparelho, sem humano
bash scripts/qa-mobile.sh customer_app
bash scripts/qa-mobile.sh courier_app

# migration ida e volta, automatizada
bash scripts/migration-roundtrip.sh
```

Ou tudo de uma vez, na raiz:

```bash
pnpm qa
```

No CI e quando o qemu do AVD `aqui_log_qa` pende (já medido: thread QEMU
travada → segfault), pular o emulador sem fingir cobertura:

```bash
QA_SKIP_MOBILE=1 pnpm qa
```

### O que o aparato precisa respeitar

| Fato deste PC | Consequência |
| --- | --- |
| AVD do QA: **`aqui_log_qa`** (criado pelo `QA-01`) | `emulator -avd aqui_log_qa -partition-size 8192 -no-window -no-audio -no-snapshot -gpu swiftshader_indirect` |
| ⚠️ O `Medium_Phone_API_36.0` é do **AquiResolve** e está com o `/data` a 97% | não usar, não limpar, não dar `-wipe-data` |
| Boot leva **~53 s** e passa por `offline` | esperar `sys.boot_completed`, nunca só `adb devices` |
| O emulador é **x86_64**; o APK de release é **arm64** | QA compila com `--target-platform android-x64`; o release continua arm64 |
| `java` do PATH é o **21**, Gradle dos apps exige **17** | exportar `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64` antes de qualquer build Android |
| Chromium do Playwright já baixado | `~/.cache/ms-playwright` — não rebaixar, só apontar |
| Waydroid instalado (`Session: STOPPED`) | alternativa ao AVD se o emulador falhar; não é o caminho principal |
| Dashboard **não tem runner de teste** (`pnpm lint` = `tsc -b`) | mudança visual do painel **só** se prova por Playwright |
| Shell do prestador tem timer de 15 s | teste de widget que chega nele **não pode usar `pumpAndSettle`** — nunca assenta |

### Screenshot é evidência, não enfeite

Toda tarefa com UI arquiva screenshots em
`../04-status/entregas/` junto da evidência escrita, com o nome do estado que
provam (`ADMIN-02-recusa-com-motivo.png`). Um print de tela vazia não prova nada;
o print tem que mostrar o dado real que a tarefa produziu.

## 4. Registro obrigatório

Sem isto, a tarefa não está fechada — mesmo com tudo verde:

- [ ] `../04-status/entregas/AAAA-MM-DD-EVIDENCIA-<ID>.md` com **comando, saída
      observada, data, ambiente e commit** de cada item do portão;
- [ ] `../04-status/01-ESTADO-ATUAL.md` atualizado com **fato**, não intenção,
      incluindo a pendência que a tarefa deixou aberta;
- [ ] `../02-planejamento/02-BACKLOG.md` com o ID em `DONE` e a evidência linkada;
- [ ] `../02-planejamento/01-ROADMAP.md` se a fase mudou de estado;
- [ ] `../04-status/04-CHANGELOG.md` com uma entrada;
- [ ] `../04-status/02-HANDOFF.md` **substituído** (não é diário — é a última passagem);
- [ ] `91-REGISTRO-DE-EXECUCAO.md` com uma linha;
- [ ] `90-RUNBOOK-ALVARO.md` se algum bloqueio novo apareceu.

## 5. Números que você deve reportar

Não escreva "testes verdes". Escreva o que dá para conferir depois:

> `pnpm test` — 26 suítes / 224 testes, 0 falhas
> `flutter test` — cliente 21, entregador 28
> `dart test` (core) — 29
> `pnpm smoke` — 3 execuções consecutivas aprovadas, códigos `AQL-…` distintos
> `qa:e2e` — 11 páginas × 2 temas, 0 erro de console, 0 overflow em 430 px
> `qa-mobile` — 2 apps, fluxo completo dirigido, 14 screenshots

Se um número **caiu** em relação à sessão anterior, isso é um achado: explique
por quê antes de fechar.
