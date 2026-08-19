# Plano técnico — Encomenda, confiança, preço e oferta

> **Atualizado:** 2026-08-07
> **Papel:** especificação subordinada ao [roadmap](../01-ROADMAP.md)
> **Abrange:** `B2C-01` a `B2C-06` e `DISP-01` a `DISP-03` (preço dual com
> [fluxo cliente↔prestador](PLANO_FLUXO_CLIENTE_PRESTADOR.md))
> **Não autoriza:** gateway, SMS pago, cloud ou aumento automático de preço
> **Estado de `B2C-01`:** schema/API/core/apps implementados em 2026-08-07; dashboard e execução da migration em banco de teste permanecem no próximo pacote; foto obrigatória decidida (`DEC-01`), ativação em `B2C-05`

## 1. Objetivos e invariantes

Este plano remove o acoplamento dos dados da encomenda ao campo `notes`, torna o preço explicável e fortalece a confiança entre cliente e motoboy.

Invariantes:

- o servidor é a única autoridade de preço;
- pedido antigo continua legível durante toda a migração;
- oferta aceita conserva preço e repasse congelados;
- foto de produto e comprovantes de coleta/entrega são conceitos diferentes;
- avaliação só pode ser criada por participante da entrega concluída;
- reoferta possui limite de tentativas e nunca altera preço sem consentimento.

## 2. `B2C-01` — dados estruturados da encomenda

### 2.1 Contrato implementado

Adicionar a `deliveries`, inicialmente como campos opcionais:

| Campo | Tipo sugerido | Validação |
| --- | --- | --- |
| `product_type` | `varchar(40)` | catálogo aceito pelo backend; `OTHER` admite descrição livre separada |
| `package_size` | `varchar(16)` | `SMALL`, `MEDIUM` ou `LARGE` |
| `weight_kg` | `numeric(8,3)` | maior que zero e menor ou igual a 1000 kg; até 3 casas decimais |
| `delivery_scope` | `varchar(24)` | `SAME_CITY` ou `OTHER_CITY` |
| `product_photo_urls` | `jsonb` | array sem repetição, máximo de 3 URLs e host permitido pelo storage |

Evitar enum nativo do PostgreSQL para catálogo mutável. DTOs e domínio devem expor valores estáveis em inglês; textos pt-BR ficam na apresentação.

`notes` volta a representar somente observação livre. Enquanto houver legado, a leitura segue:

```text
campos próprios completos → usar campos próprios
campos próprios ausentes  → parsear OrderMeta.fromNotes(notes)
parse impossível          → exibir como pedido legado, sem inventar valores
```

### 2.2 Migração em três passos

1. **Expandir:** criar colunas opcionais e índices úteis sem remover `notes`.
2. **Migrar tráfego:** backend grava campos próprios; core/apps leem campos próprios e mantêm fallback.
3. **Contrair depois:** somente após telemetria indicar zero fallback relevante, retirar o bloco estruturado de novos `notes`; remoção definitiva do parser fica para outra versão.

Não fazer backfill SQL frágil sobre texto localizado. Se o backfill for necessário, usar rotina versionada que reutilize regras equivalentes ao parser e produza relatório de sucessos/falhas antes de escrever.

### 2.3 Compatibilidade vertical

| Camada | Estado em 2026-08-07 |
| --- | --- |
| Backend | ✅ Entity, migration, DTO, persistência e validação de URL |
| `aqui_log_core` | ✅ aceita JSON da API e mantém `fromNotes` como fallback |
| App cliente | ✅ envia campos próprios; observação permanece livre |
| App motoboy | ✅ mostra dados próprios ou legado, sem diferença funcional |
| Dashboard | ▶️ filtros por cliente/categoria/tamanho/peso e sinalização de legado |

### 2.4 Foto da encomenda

**Decisão (`DEC-01`, 2026-08-07):** exigir ao menos uma foto na **criação** de
pedido novo. Pedidos legados sem foto continuam legíveis; criação sem foto é
rejeitada. Ativação em código: pacote `B2C-05`, `READY` desde 2026-08-08
(`BASE-04` e `B2C-01B` concluídos).

- validar MIME, tamanho, quantidade e host no backend;
- armazenar chaves/URLs privadas conforme o adapter de storage;
- não aceitar URL arbitrária enviada pelo cliente;
- não reutilizar `collectionProofUrl` ou `deliveryProofUrl`.

Campos estruturados (`product_type`, `package_size`, `weight_kg`) e endereços de
coleta/entrega também são obrigatórios em pedidos novos (`DEC-18`). Detalhe em
[PLANO_FLUXO_CLIENTE_PRESTADOR.md](PLANO_FLUXO_CLIENTE_PRESTADOR.md).

### 2.5 Aceite de `B2C-01`

- migration sobe e reverte em banco de teste;
- pedido novo persiste e devolve campos estruturados;
- pedido legado abre nos dois apps e dashboard;
- peso inválido, catálogo inválido e URL não permitida são recusados;
- cliente só altera/cria dados do próprio pedido nos estados permitidos;
- smoke B2C permanece verde para pedido novo e pedido histórico lido pelo fallback
  de `notes`; o modelo B2B removido não faz parte do aceite.

## 3. `B2C-02` — preço v2 (e extensão `B2C-06`)

### 3.1 Modelo

```text
km_rate = fulfillment_mode == IMMEDIATE
          ? settings.price_per_km_immediate
          : settings.price_per_km_scheduled

subtotal = base + (distância_km * km_rate) + adicional_tamanho + adicional_peso
priceCents = max(minFee, arredondar(subtotal))
platformFeeCents = arredondar(priceCents * percentual_plataforma)
courierFeeCents = priceCents - platformFeeCents
```

Invariante de produto (`DEC-19`): `price_per_km_immediate` > `price_per_km_scheduled`
na validação do admin. Valores numéricos finais: `DEC-02`.

Persistir no pedido:

- `fulfillment_mode` — `IMMEDIATE` | `SCHEDULED`;
- `pricing_version` — identifica a configuração/regra;
- `pricing_breakdown` — componentes em centavos (inclui `km_rate` usado);
- `quoted_at` — instante da cotação;
- `price_cents` e `courier_fee_cents` — snapshot já existente;
- `platform_fee_cents` — persistir explicitamente ou provar derivação invariável.

Configuração pode continuar em settings/Redis, mas cada pedido deve guardar dados suficientes para auditoria mesmo que a configuração mude.

Modos, aceite antecipado e UI do prestador: ver
[PLANO_FLUXO_CLIENTE_PRESTADOR.md](PLANO_FLUXO_CLIENTE_PRESTADOR.md).

### 3.2 Prévia e confirmação

Adicionar uma operação de cotação server-side antes da confirmação. A criação recalcula com as mesmas entradas e rejeita/solicita nova confirmação se a cotação expirou ou mudou além da tolerância definida.

O app envia características e coordenadas, nunca totais financeiros confiáveis.

### 3.3 Aumento por falta de aceite

Não aplicar aumento silencioso. Uma nova proposta precisa:

1. informar valor anterior, novo valor e motivo;
2. obter consentimento do cliente;
3. gerar nova versão de cotação/oferta;
4. preservar trilha de auditoria.

Na primeira versão, priorizar ampliação de raio e aviso ao cliente.

### 3.4 Aceite de `B2C-02`

- testes de limites P/M/G, faixas exatas de peso, arredondamento e tarifa mínima;
- `priceCents = courierFeeCents + platformFeeCents` em todos os casos;
- duas requisições iguais sob a mesma versão retornam o mesmo breakdown;
- pedido existente mantém seu valor quando settings mudam;
- valor mostrado ao cliente, motoboy, dashboard e extrato é consistente.

## 4. `B2C-03` — avaliação mútua

### 4.1 Modelo

Substituir a unicidade atual apenas em `delivery_id` por:

```text
unique(delivery_id, from_role)
from_role: CUSTOMER | COURIER
from_user_id
to_user_id
score: 1..5
comment: opcional, com limite
```

Manter os vínculos de domínio necessários para consultas e auditoria. Migração precisa classificar ratings antigos como `CUSTOMER` quando a autoria puder ser comprovada; casos ambíguos ficam registrados em relatório, não são adivinhados.

### 4.2 Regras

- apenas após `DELIVERED`;
- somente cliente e motoboy daquela entrega;
- uma avaliação por papel;
- alteração, se permitida, tem janela limitada e auditoria;
- médias exibem quantidade de avaliações;
- moderação/denúncia de comentário fica em backlog separado.

### 4.3 Aceite de `B2C-03`

- os dois participantes avaliam a mesma entrega sem conflito;
- terceiro, papel errado, duplicata e entrega não concluída são recusados;
- média e contagem não expõem telefone, endereço ou observação do pedido;
- ratings legados continuam visíveis.

## 5. `B2C-04` — verificação de telefone

Depende de `DEC-04`. O contrato independe do fornecedor:

- código de uso único com hash, TTL curto e número máximo de tentativas;
- cooldown e rate limit por telefone, IP e conta;
- `phone_verified_at` e normalização E.164;
- troca de telefone invalida verificação anterior;
- respostas não revelam se um telefone já possui conta;
- ambiente local usa adapter explícito; código nunca aparece em resposta de produção.

Gate: cadastro público em produção exige telefone verificado, mas testes locais e migrações não devem depender de serviço externo.

## 6. `DISP-01/02/03` — oferta sem aceite

> **Estado (2026-08-09):** os itens 1, 2, 3 e 5 do §6.1 e o §6.2 inteiro estão
> **implementados** em `DISP-01` (evidência:
> `docs/04-status/entregas/2026-08-09-EVIDENCIA-DISP-01.md`). O item 4 — avisar o
> cliente — e o aumento com consentimento do §3.3 continuam em `DISP-02`. As
> métricas do §6.3 continuam em `DISP-03`; `DISP-01` deixou o registro por
> rodada (raio, elegíveis, tentados, timestamps) e o motivo de término.

### 6.1 Estratégia inicial

1. oferecer ao candidato elegível mais próximo;
2. em expiração/recusa, excluir candidatos já tentados;
3. ampliar raio em anéis configuráveis, com máximo de rodadas e duração total;
4. avisar o cliente após o primeiro atraso significativo;
5. ao esgotar, manter estado recuperável com ações claras: tentar novamente, editar ou cancelar.

### 6.2 Concorrência e idempotência

- lock e revalidação continuam obrigatórios no aceite;
- um pedido só pode ter uma oferta pendente efetiva por estratégia atual;
- jobs repetidos não criam ofertas duplicadas para o mesmo par pedido/motoboy/rodada;
- cada rodada registra raio, candidatos, motivo de término e timestamps.

### 6.3 Métricas mínimas

- tempo criação → primeira oferta;
- tempo criação → aceite;
- candidatos elegíveis e tentados;
- recusas, expirações e ausência de candidato;
- raio e rodada do aceite;
- cancelamento após demora.

Essas métricas alimentam `TRIP-00` e a futura decisão de aumento de preço.

## 7. Ordem executável

| Ordem | Pacote | Dependência | Pode ser entregue sozinho? |
| --- | --- | --- | --- |
| 1 | `B2C-01` schema/API/core/apps | contrato fechado | Sim (obrigatoriedade de foto na criação = `B2C-05`) |
| 2 | `B2C-01B` dashboard B2C | `B2C-01` | Sim |
| 3 | `B2C-02` preço v2 | campos estruturados | Sim |
| 4 | `B2C-03` avaliação mútua | nenhuma externa | Sim |
| 5 | `DISP-01/02/03` resiliência | preço v2 + `DEC-03` | Sim |
| 6 | `B2C-04` ✅ | código no app (`DEC-04`) | Sim (2026-08-19); SMS/WhatsApp continuam futuros |

## 8. Fora de escopo

- seguro de carga, biometria e score de risco avançado;
- negociação livre de preço entre cliente e motoboy;
- pagamento, payout e conciliação;
- agrupamento multi-pedido;
- publicação cloud.
