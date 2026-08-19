# Handoff vigente

- **Data/hora:** 2026-08-19
- **Agente:** Grok 4.6
- **Tarefa:** `B2C-04` — verificação de telefone por código no app
- **Branch/commit inicial:** `main` @ `b09d1dc` (`COUR-02`)
- **Estado:** entregue, pushado (`ee0c3f7`). Migration no acer, API
  reiniciada, `PHONE_VERIFY_ADAPTER=local` no EnvironmentFile, smoke
  vivo **aprovado**.

## Resultado

Evidência: `docs/04-status/entregas/2026-08-19-EVIDENCIA-B2C-04.md`.

Cliente confirma o celular com código de 6 dígitos, sem SMS (`DEC-04`).
Adapter local revela `devCode`; production não. Trocar o número zera a
verificação. O app mostra a tela depois do cadastro (dá para pular).

## Coisas que o próximo agente precisa saber

1. **Gate de pedido está desligado em local.** Só `PHONE_VERIFY_REQUIRED=true`
   ou `NODE_ENV=production` bloqueia `POST /deliveries`. Não ligar no
   acer sem avisar: o piloto ainda cria pedido com crédito de admin.
2. **`devCode` exige `PHONE_VERIFY_ADAPTER=local`.** O acer tem
   `NODE_ENV=production`; sem o adapter o challenge não revela o código
   e o smoke quebra. O valor já está no EnvironmentFile.
3. **Migration `1786000000000`** adiciona colunas em `customers`. Sem ela
   o challenge 500.
4. **Sessão antiga no app** sem a chave `phoneVerified` **não** força a
   tela (senão todo cliente já logado cai nela). Cadastro/login novos
   mandam o booleano.
5. Entregador não verifica telefone neste pacote.

## Não feito e bloqueios

- QA visual / rebuild de APK (`UX-02`) — Álvaro adiou.
- `PAY-02` (Pagar.me).
- SMS de verdade.
- Ligar `PHONE_VERIFY_REQUIRED=true` (bloqueia pedido sem telefone
  confirmado).

## Próximo passo recomendado

1. Código: `B2C-02B` (prévia de preço) ou `PAY-01A` (cancelamento do
   cliente). Sem credencial, `PAY-02` continua bloqueado.
2. `UX-02` quando houver aparelho.

## Mensagem de retomada

> `B2C-04` fechou: telefone por código no app, sem SMS. Migration e
> smoke no acer passaram (`PHONE_VERIFY_ADAPTER=local`). Gate de pedido
> só liga com `PHONE_VERIFY_REQUIRED=true`. Álvaro pulou `UX-02`.
