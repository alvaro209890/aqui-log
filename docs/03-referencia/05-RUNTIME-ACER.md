# Runtime de distribuição no acer (`OPS-01A` / `DEC-26`)

> **Atualizado:** 2026-08-11
> **Papel:** referência operacional de como o Aqui Log roda no PC `acer` —
> subir, verificar, reiniciar e mexer sem derrubar os outros sistemas do PC.
> **Decisão:** `DEC-26` (distribuição inicial no acer via Cloudflare Tunnel).
> **Evidência:** `docs/04-status/entregas/2026-08-11-EVIDENCIA-APK-E-RUNTIME.md`

## 1. O que roda

| Peça | Onde | Porta | Como sobe |
| --- | --- | --- | --- |
| PostgreSQL 17 | container `aqui-log-postgres` | `5433` → 5432 | Docker, `restart=unless-stopped` |
| Redis 7 | container `aqui-log-redis` | `6379` | Docker, `restart=unless-stopped` |
| API NestJS | systemd **user** `aqui-log-api` | `3011` | `node dist/main` |
| Dashboard (build estático) | systemd **user** `aqui-log-dashboard` | `127.0.0.1:3012` | `node infra/static-server.mjs apps/dashboard/dist` |
| Cloudflare Tunnel | systemd **user** `cloudflared-aqui-log` | — | `cloudflared tunnel --config ~/.cloudflared/aqui-log-config.yml run` |

URLs públicas:

- **API:** <https://aquilog-api.cursar.space/api/v1>
- **Dashboard:** <https://aquilog.cursar.space>

Início automático ao ligar o PC: as três units estão `enabled` em
`default.target` e o usuário `acer` tem `linger` ligado
(`loginctl enable-linger acer`), então elas sobem **sem ninguém fazer login**.
Os containers voltam pelo `restart=unless-stopped` do Docker.

## 2. Onde moram os dados e os segredos

- **Dados do Postgres:** `~/Documentos/Bando_de_dados/Aqui_Log` (bind mount,
  padrão de pastas do acer exigido por `DEC-26`). Migrado em 2026-08-11 do
  volume Docker `infra_postgres_data`, que **continua existindo** como cópia de
  segurança até o backup formal de `OPS-01`.
- **Segredos da API:** `~/.config/aqui-log/env` (modo `600`), **fora do
  repositório**. É o `EnvironmentFile` da unit. Contém `JWT_SECRET`,
  `DATABASE_PASSWORD`, `ADMIN_PASSWORD` e o `PUBLIC_API_URL` público.
- **Credencial do túnel:** `~/.cloudflared/66aa2d7d-….json` + `cert.pem` —
  nunca commitar.
- Os arquivos `.service` versionados ficam em `infra/systemd/` e **só
  referenciam** caminhos; nenhum segredo está neles.

## 3. Verificação rápida (um comando)

```bash
systemctl --user is-active aqui-log-api aqui-log-dashboard cloudflared-aqui-log \
  && docker ps --filter name=aqui-log --format '{{.Names}} {{.Status}}' \
  && curl -s https://aquilog-api.cursar.space/api/v1/health \
  && curl -s -o /dev/null -w '\ndashboard HTTP %{http_code}\n' https://aquilog.cursar.space/
```

Saída saudável: três `active`, dois containers `healthy`, health com
`"status":"ok"` + `db: ok` + `redis: ok`, dashboard `HTTP 200`.

## 4. Operações comuns

```bash
# reiniciar tudo
systemctl --user restart aqui-log-api aqui-log-dashboard cloudflared-aqui-log

# ver log
journalctl --user -u aqui-log-api -f
journalctl --user -u cloudflared-aqui-log -n 50 --no-pager

# publicar código novo da API
cd ~/Documentos/aqui-log && pnpm --filter backend build \
  && systemctl --user restart aqui-log-api

# publicar dashboard novo (ver a armadilha do VITE_API_URL abaixo)
cd ~/Documentos/aqui-log \
  && VITE_API_URL=https://aquilog-api.cursar.space/api/v1 pnpm --filter dashboard build \
  && systemctl --user restart aqui-log-dashboard

# migrations
cd ~/Documentos/aqui-log && pnpm db:migrate
```

## 5. Instalar do zero (outro PC ou depois de formatar)

```bash
cd ~/Documentos/aqui-log
# 1. banco e cache
(cd infra && docker compose up -d)
# 2. segredos (copiar o modelo e preencher)
mkdir -p ~/.config/aqui-log && chmod 600 ~/.config/aqui-log/env
# 3. build
pnpm install && pnpm --filter backend build
VITE_API_URL=https://aquilog-api.cursar.space/api/v1 pnpm --filter dashboard build
# 4. units
cp infra/systemd/*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now aqui-log-api aqui-log-dashboard cloudflared-aqui-log
loginctl enable-linger "$USER"
```

## 6. Armadilhas conhecidas

1. **`pnpm build` na raiz publica o dashboard apontando para `localhost`.** O
   script raiz não passa `VITE_API_URL`. Desde 2026-08-11 o
   `apps/dashboard/src/api.ts` tem uma rede de proteção: sem a variável, se a
   página **não** estiver em `localhost`, ele usa
   `https://aquilog-api.cursar.space/api/v1`. Mesmo assim, para o build de
   produção **passe a variável** — a proteção é para não quebrar em silêncio,
   não para substituir a configuração.
2. **`PUBLIC_API_URL` define a URL de upload** devolvida pela presign. Se ela
   não casar com a API que o cliente chama, o upload de foto falha. No runtime
   público ela é `https://aquilog-api.cursar.space/api/v1`; por isso o smoke
   local também precisa rodar contra o domínio público:
   `API_URL=https://aquilog-api.cursar.space/api/v1 pnpm smoke`.
3. **`cloudflared tunnel route dns <nome>` pode acertar o túnel errado.** Em
   2026-08-11 o comando com o nome `aqui-log` gravou o CNAME apontando para o
   túnel `auracore-local-api`. Sempre use o **UUID** e confira a saída:
   `cloudflared tunnel route dns --overwrite-dns 66aa2d7d-… <hostname>`.
4. **Não editar os configs de túnel dos outros sistemas** do acer
   (`hermes-acer-config.yml`, `codingpro-config.yml`, `mapasfacil-config.yml`,
   `saldopro-config.yml`, `/etc/cloudflared/config.yml`). O Aqui Log tem config
   própria: `~/.cloudflared/aqui-log-config.yml`.
5. **A porta 3000 costuma estar ocupada** neste PC por outro processo, e a 4173
   é do Painel de Limites. O Aqui Log usa 3011 (API) e 3012 (dashboard).

## 7. O que ainda não é este runtime

- **Não é a nuvem.** Render/Vercel/Firebase seguem como evolução posterior
  (`DEC-25`, `OPS-02`/`OPS-03`), atrás de credenciais.
- **Não tem backup automatizado** nem monitoramento — é `OPS-01`.
- **Não tem HTTPS próprio nem autenticação de borda**: quem protege é o JWT da
  própria API. O dashboard é público e exige login de admin.
