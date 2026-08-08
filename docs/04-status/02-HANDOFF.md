# Handoff vigente

- **Data/hora:** 2026-08-08 (~17:00 BRT)
- **Agente:** Claude Code (Opus 5)
- **Tarefas:** `B2C-05`, `UX-01C`, `DEC-02` + `B2C-02`/`B2C-02A` e tema escuro
- **Branch/commit inicial:** `main` @ `f987e26`

> Várias tarefas na mesma sessão por autorização explícita do Álvaro. Foram
> executadas **em sequência**, com commits e evidência próprios.

## Resultado

Quatro IDs `DONE` e uma decisão fechada.

**`B2C-05`** — criação de pedido exige foto (≥1), tipo, tamanho, peso e os dois
endereços. Vale só para criação: pedido legado continua legível.

**`UX-01C`** — o painel deixou de ser verde; `styles.css` virou a fonte única de
cor de marca e nenhum hexadecimal de marca sobrou fora do tema.

**`DEC-02` + `B2C-02`/`B2C-02A`** — preço v2 versionado:
`base + km × tarifa_do_modo + peso + tamanho`, com piso. Versão e breakdown ficam
congelados no pedido, então mudar configuração **não** mexe em pedido já criado.
Todos os valores — inclusive **multas e cutoffs** — são editáveis no painel admin.

**Tema escuro** do painel, derivado por tokens, com alternador, persistência e
respeito ao `prefers-color-scheme`.

## Coisas que o próximo agente precisa saber

1. **Os valores do `DEC-02` são provisórios.** Foram escolhidos para destravar a
   implementação, não são calibragem de mercado. A calibragem real é do Álvaro,
   na tela de configurações — sem deploy.
2. **As multas são configuráveis mas não são cobradas.** A cobrança depende de
   `PAY-01`/`COUR-02`. A tela avisa o operador.
3. **Dois laranjas, dois papéis, por causa do contraste.** No claro, texto usa
   `#C54B07`; no escuro, `#FB923C` — o tom do claro sumiria no escuro, e o
   `#F97316` puro reprova no AA com texto branco.
4. **`class-transformer` entrega o DTO com as chaves ausentes em `undefined`.**
   Foi a raiz de um bug de perda silenciosa em settings. Qualquer merge de patch
   parcial precisa filtrar `undefined` antes.

## Evidências

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 11 suítes / **70 testes** (eram 36 no início da sessão) |
| `pnpm smoke` | PASS — 9 execuções no total da sessão |
| `pnpm db:migrate` em banco descartável | PASS — 9 migrations |
| Rollback + reaplicação da migration nova | PASS |
| Preço v2 em HTTP vivo | PASS — 4 cenários de peso/tamanho |
| Congelamento do preço | PASS — base alterada, pedido intacto |
| `DEC-19` na escrita de settings | PASS — `400` nos dois casos inválidos |
| Salvar configurações pela UI | PASS — valor persistido, 14 campos auditados |
| Rejeição de criação (`B2C-05`) | PASS — 10 casos, `400` em português |
| Leitura de pedido legado | PASS |
| Contraste AA | PASS — 0 reprovações em 11 telas × **2 temas** |
| `flutter analyze` / `flutter test` | PASS na rodada do `B2C-05`; N/A depois |
| APK e QA em emulador/dispositivo | **NÃO EXECUTADO** |

Documentos em `docs/04-status/entregas/2026-08-08-EVIDENCIA-*`.

## Defeitos corrigidos no caminho

- **Settings perdiam valores personalizados** em patch parcial (silencioso).
- **Formulário de configurações não submetia**: `min=0.001` com `step=0.5`
  invalida todo peso inteiro e o navegador bloqueia o submit inteiro sem aviso.
- **`DELIVERED` e `CANCELED` com o mesmo cinza** na tabela de entregas.
- **`@IsNotEmpty` aceitava `"   "`** como endereço.

## Defeito registrado e NÃO corrigido

**O gráfico "Entregas por status" não renderiza setores.** Legenda e eixos
aparecem, o `<Pie>` produz um `<g>` vazio, sem erro no console. Não é regressão
desta sessão: reproduzi com as cores hexadecimais originais, sem o `label` e sem
os `<Cell>`. Os outros dois gráficos funcionam. Aparenta ser incompatibilidade
do Recharts 3.9 com React 19. Escopo de `UX-02`.

## Ambiente usado

Bancos descartáveis `aqui_log_b2c05`, `aqui_log_ux01c` e `aqui_log_b2c02`
(container `aqui-log-postgres`, 5433), Redis em 6379, API em `PORT=3011` com
`PUBLIC_API_URL` alinhado, dashboard em `vite --port 5199`. O `.env` **não** foi
alterado (só o `.env.example`); overrides por variável de ambiente. Processos de
teste encerrados e bancos descartáveis removidos.

## Próximo

Escolher **um** ID:

1. `PICK-01` — `pickup_code` na coleta (P1, `DEC-24` decidida). Migration +
   backend + app do motoboy; **ou**
2. `UX-02` — QA visual/acessibilidade dos fluxos. Inclui o gráfico de pizza
   quebrado e a busca decorativa da `TopBar`; a parte mobile exige dispositivo.

`SCHED-01` ficou mais perto: a tarifa dual e o admin dela já existem; falta o
cliente **escolher** o modo.

## Pendências herdadas

- APK e QA visual em emulador/dispositivo seguem não executados.
- Busca da `TopBar` continua decorativa.
- O dashboard não tem runner de teste — mudança visual só se prova com QA de
  navegador.
- Cloud, SMS e pagamentos reais continuam atrás de credenciais e autorização.

## Mensagem de retomada

> `B2C-05`, `UX-01C` e `B2C-02` fechados com evidência. `DEC-02` decidida com
> valores provisórios **editáveis no admin** (inclusive multas). Preço v2 com
> breakdown congelado no pedido, painel com tema claro/escuro e contraste AA
> medido nos dois. 70 testes. Três bugs corrigidos no caminho, um registrado sem
> correção (gráfico de pizza, Recharts × React 19). Próximo: `PICK-01` ou `UX-02`.
