# Handoff vigente

- **Data/hora:** 2026-08-19
- **Agente:** Grok 4.6
- **Tarefa:** `B2C-04` — verificação de telefone por código no app
- **Branch/commit inicial:** `main` @ `b09d1dc` (`COUR-02`)
- **Estado:** código e testes prontos neste clone Windows. Falta
  migration + restart + smoke **no acer**.

## Resultado

Evidência: `docs/04-status/entregas/2026-08-19-EVIDENCIA-B2C-04.md`.

Cliente confirma o celular com código de 6 dígitos, sem SMS (`DEC-04`).
Adapter local revela `devCode`; production não. Trocar o número zera a
verificação. O app mostra a tela depois do cadastro (dá para pular).

## Coisas que o próximo agente precisa saber

1. **Gate de pedido está desligado em local.** Só `PHONE_VERIFY_REQUIRED=true`
   ou `NODE_ENV=production` bloqueia `POST /deliveries`. Não ligar no
   acer sem avisar: o piloto ainda cria pedido com crédito de admin.
2. **`devCode` é o adapter local.** Se alguém apontar `NODE_ENV=production`
   no acer, o smoke do bloco B2C-04 quebra (não vem código na resposta).
3. **Migration `1786000000000`** adiciona colunas em `customers`. Sem ela
   o challenge 500.
4. **Sessão antiga no app** sem a chave `phoneVerified` **não** força a
   tela (senão todo cliente já logado cai nela). Cadastro/login novos
   mandam o booleano.
5. Entregador não verifica telefone neste pacote.

## Não feito e bloqueios

- Migration + restart + smoke no acer.
- QA visual / rebuild de APK (`UX-02`) — Álvaro adiou.
- `PAY-02` (Pagar.me).
- SMS de verdade.

## Próximo passo recomendado

1. No acer: `git pull`, `pnpm db:migrate`, rebuild da API, `PORT=3011`
   smoke.
2. Código: `B2C-02B` (prévia de preço) ou `PAY-01A` (cancelamento do
   cliente). Sem credencial, `PAY-02` continua bloqueado.

## Mensagem de retomada

> `B2C-04` fechou no código: telefone por código no app, sem SMS.
> Falta **migration e smoke no acer**. Gate de pedido não está ligado
> em local. Álvaro pulou `UX-02`.
