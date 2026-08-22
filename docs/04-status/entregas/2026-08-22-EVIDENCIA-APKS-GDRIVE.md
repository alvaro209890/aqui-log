# Evidência — APKs 22/08 no Google Drive + runtime confirmado

> **Data:** 2026-08-22 · **Autor:** Hermes-server (PC server-desktop)
> **Pedido do Álvaro:** terminar o Aqui Log, gerar os APKs, salvar no Google Drive
> pelo Windows, manter backend rodando no acer sob `*.cursar.space` com banco local,
> e documentar no GitHub e no Segundo Cérebro.
> **Base:** `main` @ `2417c04` (QA-03). Nenhum commit de código novo nesta rodada —
> a fila de desenvolvimento (`ADMIN-01`) segue para a próxima sessão.

## APKs gerados (rebuild do dia)

| App | Arquivo | Tamanho | SHA-256 |
| --- | --- | --- | --- |
| Cliente (B2C) | `dist/aqui-log-cliente-2026-08-22.apk` | 19.434.972 B | `c749937ff2d3f12cf395d71b330930a9dbbb041a3ecc341baf8d181545e8afde` |
| Entregador | `dist/aqui-log-entregador-2026-08-22.apk` | 19.403.264 B | `ef878a00288fe3a34749e4808fe56162d512a7add5408f9484083246dae8ebf7` |

- Build: `flutter build apk --release --target-platform android-arm64`
  (JAVA_HOME=17), no acer.
- **Hashes idênticos aos builds de 2026-08-21** → determinismo confirmado: nenhum
  código de app mudou desde o fechamento do QA-01; estes APKs são o estado atual
  do produto.
- Portão: `flutter analyze` 0 issues ×2 · widget tests **23 passed** (cliente) /
  **30 passed** (entregador).

## Entrega no Google Drive (via Windows pcque001imap)

Caminho: `G:\Meu Drive\Aqui_Log\APKs\` (Drive virtual G:, DriveFS logado).

| Passo | Resultado |
| --- | --- |
| Rota server→acer→server→Windows (scp) | ✅ |
| Hash SHA-256 conferido NO Windows após a cópia | ✅ idênticos ao build do acer |
| Tamanho dos arquivos no Drive | ✅ exatos (byte a byte) |

## Runtime de distribuição (acer) — verificado em 2026-08-22

| Verificação | Resultado |
| --- | --- |
| `GET https://aquilog-api.cursar.space/api/v1/health` | ✅ HTTP 200 |
| Dashboard `https://aquilog.cursar.space/` | ✅ HTTP 200 |
| systemd user `aqui-log-api` (:3011) / `aqui-log-dashboard` (:3012) | ✅ active |
| Containers `aqui-log-postgres` / `aqui-log-redis` | ✅ Up 26 h, healthy |
| Banco persistido no acer | ✅ `~/Documentos/Bando_de_dados/Aqui_Log` (DEC-26) |

Os APKs apontam por default para `https://aquilog-api.cursar.space/api/v1`
(padrão `3d66fd0`) — instalam no celular sem configuração extra.

## Fila

Próximo ID: **`ADMIN-01`** (onda 2 — fundação de auditoria: motivo obrigatório,
`audit_logs`, matriz de permissões, confirmação dupla). `PAY-02` continua
bloqueado por credenciais Pagar.me.
