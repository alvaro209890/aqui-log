# Handoff vigente

- **Data/hora:** 2026-08-11
- **Agente:** Claude (Opus 5)
- **Tarefas:** `PAY-01` (fechamento), app cliente + APK e `OPS-01A` (runtime de
  distribuição no acer) — as três autorizadas explicitamente pelo Álvaro na
  mesma missão
- **Branch/commit inicial:** `main` @ `8b05bf2` (PAY-01 parcial, CI vermelho)
- **Estado:** ✅ tudo entregue, commitado e pushado; CI verde

## Resultado

Evidência completa em
`docs/04-status/entregas/2026-08-11-EVIDENCIA-APK-E-RUNTIME.md`.
Operação do runtime em `docs/03-referencia/05-RUNTIME-ACER.md`.

- **`PAY-01` DONE**: smoke fechado (asserção do summary agora compara o **delta
  da execução** contra uma baseline capturada no início) + erro de lint
  (`no-unsafe-enum-comparison`) corrigido. Eram os dois motivos do CI vermelho.
- **App cliente**: URL padrão da API passou a ser o domínio público (era o
  loopback do emulador — o APK não falaria com nada), **auto-login** com sessão
  persistida + refresh na abertura, e **carteira** (saldo/reservado/extrato)
  para o `402` do pré-pago ter para onde apontar.
- **APK**: `dist/aqui-log-cliente-2026-08-11.apk` (arm64, 19,4 MB, SHA-256
  `47d0ddd2…`). `dist/` é gitignored de propósito.
- **`OPS-01A` DONE**: <https://aquilog-api.cursar.space/api/v1> e
  <https://aquilog.cursar.space> no ar, 3 units systemd de usuário `enabled` com
  `linger`, banco migrado para `~/Documentos/Bando_de_dados/Aqui_Log`.

Verificação: `pnpm build`/`lint`/`test` ✅ (25 suítes / 219 testes), `pnpm smoke`
✅ 3× no localhost e 1× pelo domínio público, `flutter analyze`/`test` ✅ nos dois
apps (cliente 21), `dart analyze`/`test` ✅ no core (23).

## Coisas que o próximo agente precisa saber

1. **O runtime está no ar e é o de verdade.** Publicar código novo da API é
   `pnpm --filter backend build && systemctl --user restart aqui-log-api`. Ver
   `docs/03-referencia/05-RUNTIME-ACER.md` §4.
2. **`pnpm build` na raiz publica o dashboard apontando para `localhost`** — o
   script não passa `VITE_API_URL`. Existe uma rede de proteção em
   `apps/dashboard/src/api.ts` (fora de `localhost`, usa a API pública), mas o
   build de produção deve passar a variável.
3. **`PUBLIC_API_URL` do serviço é a URL pública.** Por isso o smoke local
   precisa rodar contra o domínio:
   `API_URL=https://aquilog-api.cursar.space/api/v1 pnpm smoke`. Rodar contra
   `localhost:3011` aborta no upload da presign (proteção de `BASE-04`).
4. **`cloudflared tunnel route dns <nome>` pode acertar o túnel errado** —
   aconteceu nesta rodada (gravou para `auracore-local-api`). Sempre usar o
   **UUID** e conferir a saída.
5. **O smoke não assume banco limpo.** A asserção do summary compara delta
   contra baseline; não voltar a comparar o total.
6. **O produto é pré-pago e não tem recarga.** Um cliente novo que instalar o
   APK **não consegue publicar pedido** sem um admin creditar saldo
   (`POST /finance/accounts/customer/:id/adjust`). É a pendência que mais pesa.

## Não feito e bloqueios

- **`PAY-02`** (recarga PIX/cartão, Pagar.me v5): `BLOCKED` por conta e
  credenciais. Sem ela o app não é auto-suficiente.
- **QA visual em aparelho/emulador** (`UX-02`): o APK existe, ninguém instalou.
- **Login de admin no painel público pelo navegador**: não executado — digitar
  senha em formulário está fora do escopo do agente. O carregamento do painel,
  o fallback de SPA e o acesso à API pela origem pública estão provados.
- **Backup automatizado do banco** no caminho novo: é `OPS-01`. Só existe um
  dump pontual pré-migração, fora do repositório.
- **`PAY-DEC-02`** (política de cancelamento do cliente após aceite/coleta):
  sem decisão do Álvaro; nada foi inventado.
- Fora de escopo por instrução: `COUR-02`, `B2C-04`, `DISP-03`, lote, frota e
  cloud (Render/Vercel/Firebase).

## Próximo passo recomendado

1. **`COUR-02`** — destravado pelo `PAY-01`: cancelamento do prestador com
   cutoff e débito da taxa no saldo (`DEC-22`, `FLOW-DEC-01`: R$ 3,00; 5/60 min).
2. Ou **`UX-02`** — agora com o APK do cliente pronto para instalar.
3. Quando o Álvaro tiver a conta Pagar.me, **`PAY-02`** passa à frente das duas.

## Mensagem de retomada

> `PAY-01` e `OPS-01A` estão `DONE` e no `main` com CI verde. O Aqui Log roda
> neste PC em <https://aquilog-api.cursar.space/api/v1> (API) e
> <https://aquilog.cursar.space> (painel), subindo sozinho com o PC. O APK do
> cliente está em `dist/aqui-log-cliente-2026-08-11.apk`. A pendência que mais
> pesa é `PAY-02` (recarga de saldo): sem ela, quem instalar o app não consegue
> publicar pedido sem crédito manual de admin.
