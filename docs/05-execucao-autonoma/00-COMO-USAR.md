# Protocolo de execução autônoma — leia antes de qualquer coisa

> **Público: agentes de IA.** Este arquivo não é um guia para humano acompanhar;
> é o contrato de trabalho de quem executa. Se você recebeu só este arquivo, ele
> basta para começar — o resto você encontra sozinho a partir daqui.
> **Idioma:** tudo que você escrever (código comentado, documento, commit) é em
> português do Brasil.

## 0. O que mudou e por quê

Até 2026-08-19 o Aqui Log parou de avançar três vezes pelo mesmo motivo: o agente
chegava numa borda que só o Álvaro podia atravessar — uma decisão pendente, uma
credencial que não existia, um QA que exigia olho humano — e **parava**. O
trabalho seguinte, que não dependia de nada disso, ficava parado junto.

Esta pasta existe para que isso não aconteça mais. Três coisas foram resolvidas:

1. **As 7 decisões pendentes foram fechadas** (`DEC-07`, `DEC-09`, `DEC-12`,
   `DEC-13`, `DEC-14`, `DEC-15`, `DEC-16`) e estão em
   [`../02-planejamento/03-DECISOES.md`](../02-planejamento/03-DECISOES.md).
2. **Credencial deixou de ser parede.** Toda tarefa que depende de uma vai até o
   fim contra sandbox/mock e para num passo único e explícito, registrado em
   [`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md).
3. **QA visual deixou de exigir humano.** A onda 1 constrói o aparato
   (emulador + Playwright) e o
   [`02-PORTAO-DE-VERIFICACAO.md`](02-PORTAO-DE-VERIFICACAO.md) passa a exigi-lo.

## 1. O ciclo de uma sessão

Faça exatamente nesta ordem. Não pule o passo 1 achando que já sabe o estado.

| # | Passo | Como |
| ---: | --- | --- |
| 1 | Ler o baseline | `git status --short --branch` + [`../04-status/01-ESTADO-ATUAL.md`](../04-status/01-ESTADO-ATUAL.md) + [`91-REGISTRO-DE-EXECUCAO.md`](91-REGISTRO-DE-EXECUCAO.md) (última linha) |
| 2 | Escolher a tarefa | §2 deste arquivo. Você escolhe sozinho. |
| 3 | Marcar `IN_PROGRESS` | no [`../02-planejamento/02-BACKLOG.md`](../02-planejamento/02-BACKLOG.md), com a data |
| 4 | Ler o plano da tarefa | o arquivo `1X-ONDA-*.md` que contém o ID, **inteiro**, e os planos que ele referencia |
| 5 | Implementar | escopo fechado: só o ID escolhido. Ver §4. |
| 6 | Passar o portão | [`02-PORTAO-DE-VERIFICACAO.md`](02-PORTAO-DE-VERIFICACAO.md), sem exceção |
| 7 | Escrever a evidência | `../04-status/entregas/AAAA-MM-DD-EVIDENCIA-<ID>.md` |
| 8 | Atualizar a verdade | estado atual, backlog, roadmap, changelog, handoff |
| 9 | Registrar | uma linha em [`91-REGISTRO-DE-EXECUCAO.md`](91-REGISTRO-DE-EXECUCAO.md) |
| 10 | Commitar e empurrar | commit em português, push no `main` |

**Uma tarefa por sessão.** Isso não é limite de autonomia — é o que mantém o
commit pequeno, a evidência auditável e o rollback barato. A sessão seguinte pega
a próxima sozinha; a cadeia não precisa de você para continuar.

## 2. Como escolher sua tarefa, sem perguntar a ninguém

1. Abra [`01-ONDAS.md`](01-ONDAS.md).
2. Percorra a lista **de cima para baixo** — ela já está em ordem de dependência.
3. Pegue a **primeira** tarefa que satisfaça as três condições:
   - não está `DONE` no backlog;
   - todas as dependências dela estão `DONE`;
   - não está esperando um item aberto do [`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md).
4. É essa. Não negocie, não escolha a mais interessante, não faça duas.

Se **nenhuma** tarefa passar no filtro, isso é uma informação, não um erro:
escreva no registro que a fila está seca, liste no runbook o que destrava a
primeira bloqueada, e encerre dizendo isso com todas as letras.

## 3. Autorizações permanentes

Concedidas pelo Álvaro em 2026-08-19. **Não pergunte de novo** — perguntar o que
já foi autorizado é o que trava a cadeia.

- ✅ **Commit e push direto no `main`**, sem PR e sem branch.
- ✅ **Reiniciar o runtime deste PC**: `systemctl --user restart aqui-log-api`,
  `aqui-log-dashboard`, `cloudflared-aqui-log`.
- ✅ **Rodar migration no banco de produção local**
  (`~/Documentos/Bando_de_dados/Aqui_Log`), desde que a migration tenha sido
  aplicada **e revertida** antes num banco descartável.
- ✅ **Subir emulador Android e Waydroid** e instalar APK para QA.
- ✅ **Gerar APK release** e versionar em `dist/`.

## 4. Limites que continuam valendo

- ❌ Não commitar segredo, token, chave ou `.env`. Nunca.
- ❌ Não reescrever histórico, não `--force`, não apagar trabalho de outro agente.
- ❌ Não mudar `PENDENTE` para `DECIDIDA` no
  [`03-DECISOES.md`](../02-planejamento/03-DECISOES.md). As 7 que faltavam já
  foram fechadas; **decisão nova é do Álvaro**, e o lugar dela é o runbook.
- ❌ Não ligar serviço cloud, criar conta ou gastar dinheiro.
- ❌ Não compilar iOS (ver `DEC-27` — o Mac ainda não chegou).
- ❌ Não misturar dois IDs no mesmo commit, nem fazer "melhoria oportunista" no
  caminho. Achou outra coisa para arrumar? Vira linha nova no
  [`01-ONDAS.md`](01-ONDAS.md), não vira código agora.
- ❌ Não marcar `DONE` sem o portão executado. "Deve passar" não é evidência;
  "não executado" é uma evidência válida e honesta.

## 5. Quando você travar — a regra mais importante desta pasta

**Travar não para a cadeia.** Antes, o `AGENTS.md` mandava parar e esperar. Agora:

1. Escreva em [`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md) um item novo com:
   o que falta, **por que só o Álvaro pode fazer**, o passo a passo exato (com o
   que ele precisa colar e onde), e **qual ID destrava** quando terminar.
2. Marque o ID como `BLOCKED` no backlog, com o motivo em uma linha.
3. **Volte para o §2 e pegue a próxima tarefa desbloqueada.** Na mesma sessão.
4. Só encerre quando tiver fechado uma tarefa ou constatado fila seca.

Um bloqueio bem escrito no runbook vale mais que meia tarefa entregue. O que não
vale nada é uma sessão que terminou perguntando.

## 6. Como encerrar

Sua última mensagem diz, sem enfeite: **qual ID fechou**, qual foi o resultado do
portão (números reais de teste, não "tudo verde"), **o que não foi executado e
por quê**, o que foi para o runbook, e **qual é o próximo ID** pela regra do §2.

## 7. Mapa da pasta

| Arquivo | Quando abrir |
| --- | --- |
| [`00-COMO-USAR.md`](00-COMO-USAR.md) | agora, sempre |
| [`01-ONDAS.md`](01-ONDAS.md) | para escolher a tarefa |
| [`02-PORTAO-DE-VERIFICACAO.md`](02-PORTAO-DE-VERIFICACAO.md) | antes de dizer que terminou |
| [`10-ONDA-1-QA-AUTOMATIZADO.md`](10-ONDA-1-QA-AUTOMATIZADO.md) | primeira onda; destrava as outras |
| [`11-ONDA-2-PAINEL-ADMIN.md`](11-ONDA-2-PAINEL-ADMIN.md) | `ADMIN-01`…`ADMIN-07` |
| [`12-ONDA-3-APP-CLIENTE.md`](12-ONDA-3-APP-CLIENTE.md) | `B2C-02B`, `B2C-03`, `B2C-03A`, socket |
| [`13-ONDA-4-APP-PRESTADOR.md`](13-ONDA-4-APP-PRESTADOR.md) | `COUR-03`…`COUR-06` |
| [`14-ONDA-5-PAGAMENTO.md`](14-ONDA-5-PAGAMENTO.md) | `PAY-01A`, `PAY-01B`, `PAY-02` |
| [`15-ONDA-6-SUPORTE.md`](15-ONDA-6-SUPORTE.md) | `SUP-01`…`SUP-05` |
| [`16-ONDA-7-LOTE-E-FROTA.md`](16-ONDA-7-LOTE-E-FROTA.md) | `LOT-01/02`, `FROTA-01/02` |
| [`17-ONDA-8-OPS-E-CLOUD.md`](17-ONDA-8-OPS-E-CLOUD.md) | `DISP-03`, `OPS-01/02/03`, `OPS-DB-01` |
| [`18-ONDA-9-IOS.md`](18-ONDA-9-IOS.md) | paridade iOS sem compilar |
| [`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md) | quando travar (você **escreve**, nunca executa) |
| [`91-REGISTRO-DE-EXECUCAO.md`](91-REGISTRO-DE-EXECUCAO.md) | no início (ler) e no fim (escrever) |

Esta pasta **não substitui** o [`../../AGENTS.md`](../../AGENTS.md) nem o
[`../02-planejamento/01-ROADMAP.md`](../02-planejamento/01-ROADMAP.md) — ela diz
*como executar sem humano*; eles continuam dizendo *o que o produto é*. Em
conflito sobre regra de produto, mandam eles. Em conflito sobre parar ou seguir,
manda o §5 daqui.
