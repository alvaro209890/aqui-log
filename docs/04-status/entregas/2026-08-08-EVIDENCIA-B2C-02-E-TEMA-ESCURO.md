# Evidência — `DEC-02` + `B2C-02`/`B2C-02A` + tema escuro do painel

> **Data:** 2026-08-08
> **Agente:** Claude Code (Opus 5)
> **Commit inicial:** `9855612` (`main`)
> **Autorização:** Álvaro — fechar `DEC-02` com valores provisórios editáveis no
> admin, implementar, testar, e passar o painel web para tema escuro.
> **Ambiente:** banco descartável `aqui_log_b2c02`, API em `PORT=3011`,
> dashboard em `vite --port 5199`, QA em Chrome real (espelho CDP)

## 1. `DEC-02` — decidida com valores provisórios

Registrada em `03-DECISOES.md` como decisão do Álvaro. Os valores **não** são
calibragem de mercado: são o ponto de partida que destrava `B2C-02`/`B2C-06`.

| Item | Valor provisório |
| --- | --- |
| Taxa base | R$ 7,00 |
| Mínimo cobrado | R$ 9,00 |
| Percentual da plataforma | 20% |
| Km imediato / agendado | R$ 2,50 / R$ 1,80 |
| Faixas de peso (até 2 / 5 / 10 / 20 kg) | +R$ 0 / 2,00 / 4,50 / 9,00 |
| Acima de 20 kg | +R$ 15,00 |
| Tamanho P / M / G | +R$ 0 / 1,50 / 4,00 |
| Multa do prestador / do cliente | R$ 3,00 / R$ 0 |
| Cutoff imediato / agendado | 5 min / 60 min |

**Todos são editáveis no painel admin**, sem deploy — era o requisito explícito.
As multas ficam configuráveis desde já, mas a **cobrança automática não existe**:
depende de `PAY-01`/`COUR-02`. A tela diz isso ao operador.

## 2. `B2C-02` / `B2C-02A` — preço v2

Fórmula: `base + km × tarifa_do_modo + adicional_peso + adicional_tamanho`, com
piso `minFeeCents`; a plataforma retém um percentual e o resto é do prestador.

- `pricing.types.ts` ganhou `PRICING_VERSION = 2`, faixas de peso e adicionais;
- `pricing.calc.ts` implementa o v2 e **preserva a assinatura v1**;
- migration `1785300000000-DeliveryPricingV2Fields` adiciona `pricing_version`,
  `pricing_breakdown` (jsonb) e `fulfillment_mode` — aditiva, pedido antigo
  fica com versão/breakdown nulos e continua legível;
- a criação persiste o breakdown: mudança de settings **não** altera pedido já
  criado (`DEC-19`).

### Preço verificado em HTTP vivo

Com base R$ 7,00, km imediato R$ 2,50, distância ≈ 1,54 km (R$ 3,86):

| Pedido | Cálculo | Total |
| --- | --- | --- |
| P, 1 kg | 700 + 386 | R$ 10,86 |
| P, 7 kg | 700 + 386 + 450 | R$ 15,36 |
| G, 7 kg | 700 + 386 + 450 + 400 | R$ 19,36 |
| G, 25 kg | 700 + 386 + 1500 + 400 | R$ 29,86 |

Congelamento conferido: alterei a taxa base para R$ 50,00 e o pedido já criado
manteve `priceCents 2986` e `breakdown.baseFeeCents 700`.

### `DEC-19` em HTTP vivo

| Tentativa | Resultado |
| --- | --- |
| agendado R$ 4,00 > imediato R$ 2,50 | `400` |
| agendado igual ao imediato | `400` |
| agendado R$ 1,90 (< imediato) | `200` |
| duas faixas com o mesmo `upToKg` | `400` |

## 3. Tema escuro

Implementado como a regra 7 das diretrizes manda: **derivado, não invertido**.
Só os tokens mudam em `:root[data-theme='dark']` — nenhuma regra de layout é
duplicada, então o painel inteiro acompanha sem manutenção paralela.

- escolha do usuário no `localStorage`; sem escolha, segue o sistema
  (`prefers-color-scheme`);
- aplicado em `main.tsx` **antes** de montar o React, para não piscar branco;
- botão de alternância na `TopBar`.

**O laranja troca de papel no escuro.** No claro, texto branco pequeno precisa de
um laranja escuro (`#C54B07`); no escuro o contraste corre ao contrário e o
`#C54B07` daria 2,6:1 sobre o fundo — some. Por isso o escuro usa `#FB923C`
(8,7:1 sobre o fundo, 7,7:1 sobre a superfície) tanto para acento quanto para
texto, e o texto **sobre** o laranja fica quase preto (8,2:1).

## 4. QA de navegador (Chrome real)

| Verificação | Resultado |
| --- | --- |
| Contraste AA em 11 telas × 2 temas | PASS — **0 reprovações** (varredura de todo texto renderizado, não amostra) |
| Alternância de tema | PASS — persiste, aplica sem recarregar, respeita o sistema |
| Tela de configurações | PASS — 14 campos, faixas com adicionar/remover, prévia em R$ |
| Salvar pela UI | PASS — multa alterada para R$ 5,55, persistida, 14 campos auditados, toast exibido |
| Preço v2 refletido no pedido | PASS — breakdown visível na API |

## 5. Três defeitos encontrados no caminho

### 5.1 Patch parcial de settings apagava valores (pré-existente, corrigido)

`class-transformer` instancia o DTO com **todas** as propriedades declaradas: as
não enviadas chegam como `undefined` e, no spread, sobrescreviam os valores já
salvos. Como `JSON.stringify` descarta `undefined`, a perda era **silenciosa** —
personalizar a taxa base e depois editar só o TTL revertia a taxa ao padrão.
Também deixava a validação cega, permitindo furar o `DEC-19`.

Corrigido filtrando `undefined` antes do merge, com dois testes de regressão.

### 5.2 Formulário de configurações não submetia (meu, corrigido)

`<input type="number" min={0.001} step={0.5}>` torna **todo peso inteiro
inválido** (2 kg não é alcançável a partir de 0,001 em passos de 0,5). O
navegador então bloqueia o submit do formulário **inteiro**, sem mensagem
visível. Descoberto porque o salvamento pela UI não gerava requisição nenhuma.
Corrigido com `step="any"`.

### 5.3 Gráfico de pizza não renderiza (pré-existente, **NÃO corrigido**)

"Entregas por status" renderiza legenda e eixo, mas **nenhum setor**. Não é
regressão desta sessão nem do `UX-01C`: reproduzi com as cores hexadecimais
originais, sem o `label` e sem os `<Cell>` — o `<Pie>` produz um `<g>` vazio em
todos os casos, sem erro no console. Os outros dois gráficos funcionam.
Aparenta ser incompatibilidade do Recharts 3.9 com React 19.

Fora do escopo desta tarefa. Registrado como pendência.

## 6. Comandos executados

| Comando | Resultado |
| --- | --- |
| `pnpm build` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 11 suítes / **70 testes** (eram 44) |
| `pnpm smoke` | PASS — 3 execuções |
| `pnpm db:migrate` em banco descartável | PASS — 9 migrations |
| `migration:revert` + reaplicação da nova | PASS — colunas somem e voltam |
| `flutter analyze` / `flutter test` | N/A — nenhum arquivo Flutter/Dart tocado |

## 7. Limitações

- Os valores do `DEC-02` são **provisórios**; a calibragem real é do Álvaro, na
  tela de configurações.
- `B2C-06` (escolha do modo pelo cliente) **não** foi implementado: a estrutura
  dual de tarifa existe e é validada, mas todo pedido nasce `IMMEDIATE`. Escolher
  o modo depende de `SCHED-01`.
- `B2C-02B` (prévia de preço antes de confirmar) não entrou.
- As multas são configuráveis, mas **não são cobradas** (`PAY-01`/`COUR-02`).
- Gráfico de pizza segue quebrado (item 5.3).
- Modo escuro dos **apps Flutter** não foi tocado — só o painel web.
