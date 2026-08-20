# Onda 8 — Telemetria, prontidão operacional e cloud

> **Objetivo:** medir o que a operação faz, garantir que o banco não se perde, e
> deixar a cloud a um passo de distância — o passo sendo credencial, não código.

Plano de requisitos:
[`PLANO_HOSPEDAGEM.md`](../02-planejamento/planos/PLANO_HOSPEDAGEM.md).
Operação atual: [`../03-referencia/05-RUNTIME-ACER.md`](../03-referencia/05-RUNTIME-ACER.md).

## Estado de onde se parte

Desde 2026-08-11 o Aqui Log **está no ar neste PC** (`OPS-01A` / `DEC-26`): API em
`aquilog-api.cursar.space`, painel em `aquilog.cursar.space`, Postgres e Redis em
container, tudo em systemd user com linger, subindo sozinho ao ligar o PC. Os
dados do Postgres moram em `~/Documentos/Bando_de_dados/Aqui_Log`.

O que isso **não** tem: backup, monitoramento e telemetria. O banco que está no ar
hoje é um banco sem cópia — esse é o risco mais concreto de todo o projeto.

---

## `DISP-03` — telemetria de despacho

**Depende de:** `QA-03`. Destrava `FROTA-01`, `LOT-01` e `OPS-01`.

- [ ] Medir: tempo até o aceite, recusas, expirações, e **varredura de anel sem
      candidato**.
- [ ] O anel sem candidato hoje **não vira linha em lugar nenhum** — de propósito,
      para não inundar `delivery_events` a cada 10 s. Essa é a lacuna que esta
      tarefa fecha: contador agregado, não evento por varredura.
- [ ] Registrar que o raio é distância **em linha reta**, não rota real — a
      métrica precisa disso para não mentir.
- [ ] Expor no painel o suficiente para calibrar anéis, rodadas e a estimativa
      fixa de 45 min de duração do imediato que o `SCHED-01` usa.

**Aceite:** um ciclo completo de busca sem candidato produz números conferíveis
sem inflar a tabela de eventos.

---

## `OPS-01` — prontidão operacional

**Depende de:** `B2C-02B`, `B2C-03A`, `DISP-03`.

- [ ] **Backup automatizado** do Postgres em `~/Documentos/Bando_de_dados/Aqui_Log`,
      com rotação — e **restauração testada de verdade**, num banco novo. Backup
      que nunca foi restaurado não é backup.
- [ ] FKs e índices onde falta (o schema cresceu por migrations aditivas).
- [ ] Retenção e saneamento, incluindo a trilha da `DEC-12` e os `audit_logs` de
      2 anos (`ADMIN-DEC-03`).
- [ ] Logs e auditoria consistentes; alerta quando um job para de rodar.

**Aceite:** derrubar o banco e restaurar do backup, com o smoke passando depois.
Prove isso num banco descartável, não no que está no ar.

---

## `OPS-02` — Firebase real

**Depende de:** item "projeto Firebase" do
[`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md).

Sem credencial: adapters reais escritos, com **fallback local que continua sendo o
padrão** (`STORAGE_DRIVER=local`), testes com mock, e o aviso
`FIREBASE_ENABLED=true but credentials incomplete` continuando inócuo.

- [ ] Storage privado para documentos e provas (hoje é local).
- [ ] FCM para push nativo (hoje notificação é só API).
- [ ] Escrever o item do runbook: criar projeto Firebase **do Aqui Log** —
      ⚠️ **não reusar o projeto do AquiResolve** — baixar service account, colar em
      `~/.config/aqui-log/env`.

---

## `OPS-DB-01` — Postgres → Firestore

**Depende de:** `OPS-02`.

- [ ] Modelo de coleções desenhado e revisado contra as queries que existem.
- [ ] Migração com **dual-write** e reconciliação; nada de corte seco.
- [ ] **Não remover o Postgres local** antes da migração fechar (`INV-02`).

---

## `OPS-03` — deploy Render + Vercel

**Depende de:** `OPS-01`, `OPS-02`, e dos itens "Render" e "Vercel" do runbook.

- [ ] Sem credencial: `render.yaml`/config de build, variáveis documentadas,
      `vercel.json` do painel conferido, script de smoke público parametrizável.
- [ ] ⚠️ `pnpm build` na raiz **não** passa `VITE_API_URL` e publica o painel
      apontando para localhost. Build de produção **sempre** com a variável — este
      erro já aconteceu aqui.
- [ ] Com credencial: deploy, health real na API do Render, painel do Vercel
      apontando para ela, smoke B2C público.

**Aceite:** `OPS-03` só fecha com health real e smoke público. Build verde não
comprova deploy — está escrito no roadmap e continua valendo.

---

## O que NÃO fazer nesta onda

- Não desligar o runtime do acer para "migrar de vez". A cloud é **evolução
  posterior** (`DEC-26`); o acer continua sendo a distribuição inicial até o
  Álvaro decidir o contrário.
- Não provisionar nada, não criar conta, não gastar. O agente escreve o passo; o
  Álvaro clica.
