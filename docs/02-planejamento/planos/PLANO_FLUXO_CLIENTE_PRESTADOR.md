# Plano — Fluxo cliente ↔ prestador (encomenda, modos, cancelamento, recolhimento)

> **Atualizado:** 2026-08-07
> **Papel:** especificação subordinada ao [roadmap](../01-ROADMAP.md)
> **Abrange:** `B2C-05`, `B2C-06`, `SCHED-01`, `COUR-01`, `COUR-02`, `PICK-01`
> **Decisões:** `DEC-01`, `DEC-18` … `DEC-24` em [`03-DECISOES.md`](../03-DECISOES.md)
> **Não autoriza:** implementação de código nesta rodada; gateway/PIX real; cloud
> **Relacionados:** [confiança/preço](PLANO_CONFIANCA_E_PRECO.md) ·
> [pagamentos](PLANO_PAGAMENTOS.md) · [lote](PLANO_LOTE_MULTI_PEDIDO.md) ·
> [admin](PLANO_ADMIN.md) · [fluxo do produto](../../01-produto/01-FLUXO-DO-PRODUTO.md)

## 1. Objetivo

Fechar o desenho do fluxo operacional entre **cliente** e **prestador (motoboy)**
para que a implementação futura não introduza bugs de máquina de estados, preço
ou dinheiro. Este plano formaliza o que o dono descreveu em 2026-08-07 e resolve
as contradições com a documentação anterior (foto opcional, desistência sem
penalidade dura, preço único por km, ausência de código de recolhimento).

## 2. Invariantes

1. O servidor é a única autoridade de preço, status e dinheiro.
2. Pedido novo exige foto (≥ 1), endereços de coleta e entrega, peso, tipo e
   tamanho da encomenda (`DEC-01`, `DEC-18`).
3. Há dois modos de cumprimento: `IMMEDIATE` e `SCHEDULED` (`DEC-18`).
4. `price_per_km_immediate` > `price_per_km_scheduled`; ambos configuráveis no
   admin e versionados; valores congelados na cotação/criação (`DEC-19`).
5. Prestador pode aceitar `SCHEDULED` no momento da criação (`DEC-20`).
6. Cancelamento pelo prestador só dentro da janela configurável e com taxa
   debitada do saldo interno; fora da janela, só suporte (`DEC-21`, `DEC-22`).
7. Pagamento do prestador = saldo interno; dinheiro real só via saque (`DEC-23`).
8. Transição `AT_PICKUP → PICKED_UP` exige `pickup_code` válido **e** foto de
   prova de coleta (`DEC-24`).
9. Pedido agendado **individual** ≠ bloco intermunicipal `LOT-02`.
10. Lote não mistura `IMMEDIATE` e `SCHEDULED`.

## 3. Criação do pedido (cliente)

### 3.1 Campos obrigatórios (novos pedidos)

| Campo | Regra |
| --- | --- |
| Foto da encomenda | ≥ 1 URL/chave do storage; máx. 3; MIME/tamanho validados |
| Endereço de saída (coleta) | texto + coordenadas válidas |
| Endereço de entrega | texto + coordenadas válidas |
| Peso (`weight_kg`) | > 0 e ≤ limite operacional |
| Tipo (`product_type`) | catálogo do backend |
| Tamanho (`package_size`) | `SMALL` / `MEDIUM` / `LARGE` |
| Modo (`fulfillment_mode`) | `IMMEDIATE` ou `SCHEDULED` |
| Observação (`notes`) | opcional; só texto livre |

Para `SCHEDULED`: `pickup_window_start/end` (e, se aplicável,
`delivery_window_start/end`) obrigatórios; início da janela no futuro com
antecedência mínima configurável.

### 3.2 Legado

Pedidos antigos sem foto/campos estruturados **continuam legíveis** nos apps e
no dashboard. Novos pedidos sem os obrigatórios são **rejeitados** (HTTP 4xx).
A flag `REQUIRE_PRODUCT_PHOTO` passa a refletir `DEC-01` (obrigatória para
criação). Remoção do fallback de `notes` continua fora deste plano.

> **Como ficou em `B2C-05` (2026-08-08):** essa flag nunca existiu no código. A
> obrigatoriedade foi implementada direto no `CreateDeliveryDto`, sem chave de
> ligar/desligar — `DEC-01` está decidida e não há caso de uso para desativá-la.
> Se algum dia for preciso um modo permissivo, ele terá de ser criado do zero.

### 3.3 Fluxo de criação

```text
cliente preenche → cotação server-side (modo + km + peso/tamanho) → confirma
→ pedido criado com pricing_version + breakdown + fulfillment_mode
→ IMMEDIATE: auto-dispatch imediato
→ SCHEDULED: entra na fila de ofertas imediatamente (aceite antecipado permitido)
```

## 4. Modos e preço (`B2C-06`)

### 4.1 Fórmula (estende `B2C-02`)

```text
km_rate = fulfillment_mode == IMMEDIATE
          ? settings.price_per_km_immediate
          : settings.price_per_km_scheduled

subtotal = base + (distância_km * km_rate) + adicional_tamanho + adicional_peso
priceCents = max(minFee, arredondar(subtotal))
platformFeeCents = arredondar(priceCents * percentual_plataforma)
courierFeeCents = priceCents - platformFeeCents
```

Invariante de produto: `price_per_km_immediate` **deve ser estritamente maior**
que `price_per_km_scheduled` na validação do admin (salvar settings inválidos
é rejeitado).

### 4.2 Congelamento

- Cotação e criação persistem `pricing_version`, `pricing_breakdown`,
  `fulfillment_mode` e o `km_rate` usado.
- Mudança de settings **não** altera pedidos já cotados/criados.
- Reoferta usa o snapshot congelado.
- Troca de modo (`IMMEDIATE` ↔ `SCHEDULED`) **não** é edição in-place: cliente
  cancela (conforme política) e cria novo pedido com nova cotação.

### 4.3 Valores numéricos

Os centavos/km exatos e faixas de peso/tamanho continuam em `DEC-02` (`PENDENTE`).
A **estrutura** dual está `DECIDIDA` (`DEC-19`).

## 5. Aceite antecipado e agenda do prestador (`SCHED-01`, `COUR-01`)

### 5.1 Aceite

- Pedido `SCHEDULED` pode ser aceito assim que criado (`DEC-20`).
- Aceite congela preço, repasse e a taxa de cancelamento do prestador
  (`courier_cancel_fee_cents` da versão vigente no aceite).
- Após aceite: status `ACCEPTED`; para `SCHEDULED`, a execução só “abre” perto
  da janela (app mostra em **Agenda** até o início; ver §5.2).
- Capacidade: prestador com agendados aceitos não recebe oferta `IMMEDIATE`
  cuja execução colida com a janela reservada (folga mínima configurável).

### 5.2 Tela do app prestador

Duas seções (abas ou listas filtradas), mesmo se a UI mudar:

| Seção | Conteúdo |
| --- | --- |
| **Em andamento** | Aceitos `IMMEDIATE` e `SCHEDULED` cuja janela já iniciou / corrida ativa (`ACCEPTED` em execução, `AT_PICKUP`, `PICKED_UP`, `IN_TRANSIT`) |
| **Agenda** | `SCHEDULED` aceitos com início de janela ainda no futuro |

Em cada card: código público, modo, janelas, endereços, encomenda (foto/peso),
repasse, botão de cancelar (habilitado só se dentro do cutoff), e status.

### 5.3 Distinção de `LOT-02`

| Conceito | O quê |
| --- | --- |
| Pedido agendado individual (`SCHED-01`) | Um pedido `SCHEDULED`, aceite antecipado, preço/km agendado |
| Bloco intermunicipal (`LOT-02`) | Vários pedidos agrupados por origem/destino/dia; candidatura a bloco |

Um pedido `SCHEDULED` individual **pode** depois entrar em bloco, se elegível;
as regras de lote continuam em `PLANO_LOTE_MULTI_PEDIDO.md`. Lote **não** mistura
modos temporais.

## 6. Cancelamento pelo prestador (`COUR-02`)

### 6.1 Janela permitida (= cutoff de `DEC-21`)

```text
permitido_se:
  status ∈ { ACCEPTED }          # antes de AT_PICKUP / coleta
  e agora < (âncora_início - courier_cancel_cutoff_minutes)
```

“Janela permitida” e “cutoff” são o **mesmo** limite: do aceite até
`âncora_início - cutoff`. Fora disso, só suporte.

Âncora de início:

- `IMMEDIATE`: instante do aceite (ou `accepted_at`); cutoff curto típico
  (valor exato `PENDENTE` em settings).
- `SCHEDULED`: `pickup_window_start`.

Fora da janela: API recusa; só suporte/admin redespacha com motivo e auditoria.

### 6.2 Taxa

- Ao cancelar com sucesso: débito `courier_cancel_fee_cents` (congelado no aceite)
  do **saldo disponível** do prestador via ledger (`DEC-22`).
- Saldo insuficiente: **recusa** o cancelamento (não gera saldo negativo).
  Prestador precisa acumular crédito ou receber ajuste admin auditado.
- Pedido volta a `REQUESTED` e entra em redespacho; cliente é notificado.
- Índice de confiabilidade registra a desistência (além da taxa).

### 6.3 O que esta decisão substitui

A frase anterior “motoboy desiste antes da 1ª coleta **sem penalidade dura**”
fica **revogada** para o fluxo individual. Desistência pré-coleta = taxa +
registro de confiabilidade, dentro do cutoff.

Pós-coleta: inalterado — só suporte, com custódia/devolução.

### 6.4 Cancelamento pelo cliente (lembrete)

Continua em `PLANO_PAGAMENTOS.md` / `PAY-01A`. Não confundir taxa do **cliente**
(sobre reserva) com taxa do **prestador** (sobre saldo do motoboy).

## 7. Código de recolhimento (`PICK-01`)

### 7.1 Conceitos distintos

| Código | Quem vê | Função |
| --- | --- | --- |
| Código público (`AQL-…`) | ambos, listagens | Identificar o pedido |
| `pickup_code` | cliente (sempre após aceite); prestador só no fluxo de coleta | Confirmar recolhimento |

### 7.2 Regras

1. Gerado no servidor no aceite (ou na criação, mas só revelado ao prestador em
   `AT_PICKUP` / tela de coleta — cliente vê antes para mostrar ao prestador).
2. Entropia suficiente: **4 dígitos numéricos** (`FLOW-DEC-03`); não é o `AQL-*`.
3. Prestador informa o código no app; servidor valida; só então aceita a foto
   de coleta e avança para `PICKED_UP`.
4. Tentativas falhas: rate limit; **após 5 erros**, bloqueio temporário + alerta
   (`FLOW-DEC-03`).
5. Código perdido / ilegível: fallback **somente** suporte/admin, com motivo,
   auditoria e, se possível, prova alternativa (foto + declaração).
6. Pedidos legados sem `pickup_code`: transição por foto de coleta (comportamento
   atual) até backfill ou expiração natural do legado.

## 8. Dinheiro do prestador (`DEC-23`)

```text
entrega DELIVERED → liquidação ledger → crédito conta pagar-motoboy / saldo disponível
→ (após janela de contestação, DEC-17) → elegível a saque
→ payout (PAY-02) → dinheiro real
```

- Carteira MVP atual evolui para contas do ledger (`PAY-01`); não é “dinheiro na
  mão” nem negociação fora da plataforma.
- Taxas de cancelamento do prestador são lançamentos do ledger (receita
  plataforma / compensação operacional — detalhe contábil em `PAY-01A`).
- Saque real permanece atrás de `PAY-02` + autorização; o **modelo** (saldo
  interno sacável) está decidido.

## 9. Matriz de situações (cliente ↔ prestador)

| Situação | Sistema | Cliente | Prestador | Admin/suporte |
| --- | --- | --- | --- | --- |
| Cria `IMMEDIATE` | Cotação km alto; dispatch | Confirma | Recebe oferta | — |
| Cria `SCHEDULED` | Cotação km baixo; oferta imediata | Confirma janela | Pode aceitar já; vai para Agenda | — |
| Aceite antecipado | Congela preço/taxa cancel | Vê “motoboy confirmado” | Card na Agenda | — |
| Prestador cancela no cutoff | Debita taxa; redespacha | Notificado | Perde corrida + taxa | Log |
| Prestador tenta cancelar fora do cutoff | Recusa | — | Bloqueado | Pode redespachar |
| Prestador sem saldo p/ taxa | Recusa cancel | — | Precisa saldo | Pode creditar teste |
| Chega na coleta | Exige `pickup_code` + foto | Mostra código | Digita código + foto | Fallback se perdido |
| Cliente cancela pré-aceite | Libera 100% (futuro ledger) | Cancela | — | Log |
| Cliente cancela pós-aceite pré-coleta | Política `PAY-01A` | Cancela | Compensação conforme regra | — |
| Pós-coleta qualquer desistência | Não automático | Fluxo devolução | Só via suporte | Decide |

## 10. Configurações no admin (`ADMIN-07`)

Novos (ou estendidos) `app_settings` versionados:

| Chave | Significado |
| --- | --- |
| `price_per_km_immediate` | R$/km modo imediato |
| `price_per_km_scheduled` | R$/km modo agendado (< imediato) |
| `courier_cancel_cutoff_minutes_immediate` | Cutoff cancelamento prestador (imediato) |
| `courier_cancel_cutoff_minutes_scheduled` | Cutoff antes de `pickup_window_start` |
| `courier_cancel_fee_cents` | Taxa debitada do saldo do prestador |
| `REQUIRE_PRODUCT_PHOTO` | Alinhada a `DEC-01` (true para novos) |
| `pickup_code_length` / tentativas | **4 dígitos / 5 tentativas** (`FLOW-DEC-03`) |
| `min_schedule_lead_minutes` | **30 min** de antecedência mínima para agendar (`FLOW-DEC-02`) — implementado em `SCHED-01` |
| `schedule_max_window_minutes` | Duração máxima da janela de coleta (**480**, provisório de `SCHED-01`) |
| `schedule_capacity_slack_minutes` | Folga mínima entre a janela reservada e outra corrida (**15**, provisório de `SCHED-01`) |
| `immediate_execution_estimate_minutes` | Quanto se assume que um imediato ocupa, para detectar colisão (**45**, provisório de `SCHED-01`) |

Toda mudança: versão nova, prévia de efeito, rollback de 1 clique, confirmação
dupla se houver pedidos em voo.

## 11. Pacotes de implementação (ordem relativa)

Baseline concluído em 2026-08-08; `B2C-05` foi o primeiro pacote deste plano a
fechar (`DONE`, mesma data) e liberou `PICK-01` para `READY`.

| Ordem | ID | Entrega | Dependências |
| ---: | --- | --- | --- |
| ✅ | `BASE-04` | Baseline runtime | concluído 2026-08-08 |
| ✅ | `B2C-01B` | Filtros dashboard B2C | concluído 2026-08-08 |
| 1 | `B2C-05` ✅ | Obrigatoriedade foto + campos na criação | `B2C-01B` ✅, `DEC-01` |
| 3 | `B2C-06` ✅ | Preço dual km imediato/agendado + settings | concluído 2026-08-09, junto de `SCHED-01` |
| 4 | `SCHED-01` ✅ | Modo `SCHEDULED` individual + aceite antecipado | concluído 2026-08-09 |
| 5 | `COUR-01` ▶️ | Tela Em andamento / Agenda | `SCHED-01` ✅, `DEC-21` ✅ |
| 6 | `PICK-01` ✅ | `pickup_code` na coleta | concluído 2026-08-09 |
| 7 | `COUR-02` ✅ | Cancelamento prestador + taxa no ledger | concluído 2026-08-19 |
| 8 | `PAY-01`… | Ledger + saldo sacável (modelo) | `DEC-23`, autorização `DEC-05` |

`B2C-06` pode ser entregue como extensão de `B2C-02` no mesmo ciclo se o escopo
couber; senão, `B2C-02` entrega faixas peso/tamanho e `B2C-06` o dual km.

## 12. Critérios de aceite (documentais → futuros testes)

- [x] Novo pedido sem foto/peso/endereços/modo é rejeitado. — `B2C-05` + `SCHED-01`
- [x] Cotação `IMMEDIATE` > cotação equivalente `SCHEDULED` (mesmo km), com settings válidos. — `B2C-06`
- [x] Settings com km agendado ≥ km imediato são rejeitados. — `B2C-02`, reconferido em `B2C-06`
- [x] Prestador aceita `SCHEDULED` na criação. — `SCHED-01`; **a tela de Agenda em si continua em `COUR-01`**
- [x] Cancelamento prestador dentro do cutoff debita taxa; fora, recusa. — `COUR-02`
- [x] Sem saldo suficiente, cancelamento prestador recusa sem saldo negativo. — `COUR-02`
- [x] `PICKED_UP` exige código válido + foto; código errado não avança. — `PICK-01`
- [x] Fallback de código só via papel admin/suporte auditado. — `PICK-01`
- [ ] Lote rejeita mistura `IMMEDIATE`/`SCHEDULED`. — `LOT-01`
- [x] Reoferta não recalcula com settings novos. — congelamento provado em `B2C-02` e `B2C-06`

## 13. Fora de escopo deste plano

- Implementação de código, migrations ou UI real nesta sessão.
- Gateway PIX / payout bancário operacional (`PAY-02`).
- Agrupamento automático (`TRIP-*`).
- Remoção do parser legado de `notes`.
- Valores finais de km, taxas e cutoffs (`DEC-02` e settings).
