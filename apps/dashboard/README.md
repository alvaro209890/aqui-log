# Dashboard — Aqui Log

Painel React + Vite para administração e operação. Antes de trabalhar, leia
[`AGENTS.md`](../../AGENTS.md) e selecione um ID `READY` no
[backlog](../../docs/02-planejamento/02-BACKLOG.md).

## Mapa rápido

- `src/pages/`: páginas operacionais.
- `src/components/`: navegação e componentes reutilizáveis.
- `src/charts/`: visualizações de métricas.
- `src/api.ts`: cliente/contratos HTTP.
- `src/LiveMap.tsx`: mapa e tracking atual.
- `src/styles.css`: estilos atuais; tokens laranja do dashboard são `UX-01C`.

## Comandos

```bash
pnpm --filter dashboard dev
pnpm --filter dashboard build
pnpm --filter dashboard lint
```

Vite local: `http://localhost:5173`. O dashboard não possui suíte automatizada
própria registrada; build/lint não substituem QA real no navegador.

## Limites

- `B2C-01B` em progresso: filtros `productType`, `packageSize`, faixa de peso e
  `customerId`. Falta QA no navegador.
- Não misturar `B2C-01B` com o pacote visual `UX-01C`.
- Ações administrativas usam comandos de domínio; não fazem update genérico.
- `SUPPORT` não executa ação financeira, de pedido, frota ou lote.
- Posição exata de motoboy só aparece durante viagem ativa.
