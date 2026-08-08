# Evidência — `UX-01C` (identidade laranja do dashboard)

> **Data:** 2026-08-08
> **Agente:** Claude Code (Opus 5)
> **Commit inicial:** `bc8059f` (`main`)
> **Referência:** `docs/01-produto/02-DIRETRIZES-VISUAIS.md`
> **Ambiente:** banco descartável `aqui_log_ux01c`, API em `PORT=3011`,
> dashboard em `vite --port 5199`, QA em Chrome real (espelho CDP)

## 1. O que mudou

| Camada | Mudança |
| --- | --- |
| `styles.css` | Camada de tokens em `:root` (marca, superfície, texto, borda, semânticas, sidebar, séries de gráfico). Todo o verde/menta de marca saiu |
| `styles.css` | Neutros deixam de ser tingidos de verde (`#172521`, `#f3f5f2`, `#e4e8e4`…) e passam à escala neutra das diretrizes |
| `theme.ts` (novo) | Ponte token→JS para Recharts/Leaflet; exporta **nome** de token, nunca valor |
| `charts/*` | As 3 séries passam a consumir tokens; laranja é a série principal |
| `LiveMap.tsx` | Pinos e rota por token (pino de coleta usa o laranja forte para o ícone branco manter ≥3:1) |
| `StatusBadge.tsx` | Tons semânticos corrigidos (ver seção 3) |
| `TopBar.tsx` | Placeholder deixa de citar "empresa" (vocabulário B2B removido do produto) |
| `DeliveriesPage.tsx` | Ação "Assign" → "Atribuir" |

Nenhum hexadecimal de marca sobrou fora de `styles.css`:

```
grep -rn "#[0-9a-fA-F]\{6\}" src --include="*.tsx" --include="*.ts"  → 0 ocorrências
```

## 2. Os dois laranjas (e por quê)

As diretrizes pedem laranja de marca **e** contraste adequado (regras 1 e 4).
Esses dois requisitos colidem: branco sobre o `#F97316` canônico dá **2,8:1** e
reprova no WCAG AA, que exige 4,5:1 para texto normal — o texto dos botões tem
12px/600, que não se qualifica como "texto grande".

Solução adotada, com dois tokens e um só sistema de marca:

| Token | Valor | Uso | Contraste |
| --- | --- | --- | --- |
| `--color-primary` | `#F97316` | acentos, ícones, barra de item ativo, série principal de gráfico (não-texto) | — |
| `--color-primary-strong` | `#C54B07` | botões, links e texto laranja | 4,79:1 sobre branco · 4,58:1 sobre `--color-bg` |

`#C54B07` é praticamente o laranja **mais claro** que ainda passa no AA nos dois
fundos. A primeira tentativa usou `#C2410C` (5,2:1): passa com folga, mas na tela
**lê como vermelho** e trai a identidade — corrigido após olhar o screenshot, não
apenas o número.

## 3. Correção semântica encontrada no QA

`StatusBadge` violava a regra 1 das diretrizes:

| Estado | Antes | Agora | Motivo |
| --- | --- | --- | --- |
| `DELIVERED` | `gray` | `green` | concluído é sucesso |
| `CANCELED` | `gray` | `red` | **dividia o mesmo cinza de `DELIVERED`** — na tabela, entrega concluída ficava indistinguível de cancelada |
| `REJECTED` | `gray` | `red` | erro |
| `IN_TRANSIT` | `green` | `blue` | rastreamento é informação; verde pertence ao sucesso |

Foi preciso criar a classe `.status.red`, que não existia.

## 4. QA de navegador executado (Chrome real)

Login com admin do `.env`, contra a API viva em `:3011` com massa de 3 entregas.

| Verificação | Resultado |
| --- | --- |
| Login: fundo, marca, botão e eyebrow | PASS — laranja; nenhum verde |
| Visão geral: sidebar, KPIs, 3 gráficos, mapa, tabela | PASS — item ativo laranja, série de gráfico laranja |
| Varredura automática de verde **de marca** nas 10 páginas | PASS — 0 ocorrências (`/`, `/deliveries`, `/couriers`, `/finance`, `/ratings`, `/reports`, `/alerts`, `/users`, `/audit`, `/settings`, `/map`) |
| Cores semânticas preservadas | PASS — "Sistema operacional" verde, delta positivo verde, selo "Entregue" verde |
| Selo de status após a correção | PASS — "Entregue" → verde `rgb(4,120,87)` |
| Contraste AA dos pares de texto reais | PASS — botão 4,79 · eyebrow 4,58 · secundário 4,83 · célula 4,83 · selo 5,21 · label 4,83 · subtítulo 4,63 |
| Foco de teclado | PASS — `:focus-visible` com contorno sólido de 2px, não só cor |
| Layout mobile (iframe 430px) | PASS — sidebar recolhida, menu hambúrguer visível, filtros em 1 coluna, **sem overflow horizontal** |

Screenshots: `ux01c-login.png`, `ux01c-overview.png`, `ux01c-entregas.png`,
`ux01c-mobile.png` (scratchpad da sessão; não versionados).

A varredura de verde é um script que percorre todos os elementos, lê a cor
computada e acusa qualquer cor com o canal G dominante, ignorando as semânticas
legítimas de sucesso — ou seja, checa o resultado renderizado, não o CSS-fonte.

## 5. Comandos executados

| Comando | Resultado |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (backend + dashboard) |
| `pnpm test` | PASS — backend 10 suítes / 44 testes |
| `pnpm smoke` (API `:3011`) | PASS |
| `flutter analyze` / `flutter test` | N/A — nenhum arquivo Flutter/Dart tocado |

## 6. Limitações

- O dashboard **não tem runner de teste** (o `lint` é `tsc -b`), então a
  identidade não tem teste automatizado: a garantia é o QA de navegador acima
  mais a regra de "zero hexadecimal fora do tema", que é verificável por `grep`.
- Modo escuro não foi implementado (é opcional na regra 7 das diretrizes).
- `UX-02` (QA visual/acessibilidade dos fluxos ponta a ponta, incluindo os apps
  em dispositivo) continua pendente; esta rodada cobriu só o dashboard.
- A busca da `TopBar` continua **decorativa** — só o vocabulário foi corrigido.
  Torná-la funcional é escopo de `UX-02`.
