# Plano de descoberta — Transportadora e rotas multi-pedido

> **Atualizado:** 2026-08-07
> **Status:** descoberta futura; não iniciar implementação operacional
> **Roadmap:** `TRIP-00`, `TRIP-01` e `TRIP-02`
> **Pré-requisitos:** pedido simples estável, preço v2, telemetria de despacho e política de responsabilidade por atraso

## 1. Hipótese de produto

Agrupar pedidos com retirada e destino próximos pode reduzir custo por entrega e aumentar ganho por viagem do motoboy sem degradar prazo, segurança ou rastreabilidade.

Essa hipótese só é válida se houver densidade real. Criar tabelas, telas e algoritmo antes de medir o volume pode produzir um subsistema caro que nunca fecha uma rota.

## 2. `TRIP-00` — gate de descoberta

Medir por pelo menos um período operacional representativo:

- pedidos por hora e região;
- pares de pedidos criados em janelas de 5, 10 e 15 minutos;
- proximidade entre retiradas e entre destinos;
- peso, tamanho e capacidade combinados;
- tempo atual até aceite e entrega;
- taxa de cancelamento e tolerância do cliente;
- km/tempo adicionais simulados ao combinar pedidos.

### Critério mínimo para avançar

Definir antes da análise, não depois, um limiar como:

```text
percentual de pedidos agrupáveis
economia média estimada por pedido
ganho estimado do motoboy por hora
desvio máximo de prazo
volume diário suficiente para um piloto
```

Se o gate econômico não fechar, manter oferta simples e reavaliar quando o volume crescer.

## 3. Vocabulário e invariantes

| Termo | Definição |
| --- | --- |
| Viagem (`trip`) | Execução de um conjunto ordenado de paradas por um motoboy |
| Parada (`stop`) | Retirada ou entrega vinculada a um ou mais pedidos |
| Capacidade | Limites de peso, volume, quantidade e tipo de veículo |
| Janela | Intervalo permitido para retirada/entrega e espera por agrupamento |
| Shadow mode | Agrupador calcula propostas, mas não altera ofertas reais |

Invariantes:

- uma entrega pertence a no máximo uma viagem ativa;
- cada pacote conserva código, destinatário, estado e provas próprios;
- nenhuma combinação excede capacidade declarada;
- reordenar paradas não pode violar coleta antes de entrega;
- preço e prazo são informados antes do aceite do cliente/motoboy;
- falha em um pacote não pode concluir ou apagar os demais;
- cancelamento precisa definir se a viagem é recalculada, continua ou termina.

## 4. Modelo de domínio proposto

Evitar apenas `trips_deliveries` com uma “ordem de entrega”, pois uma rota possui retiradas e entregas distintas.

| Entidade | Responsabilidade |
| --- | --- |
| `trips` | motoboy, estado, capacidade, distância/tempo previstos e reais |
| `trip_stops` | sequência, tipo `PICKUP/DELIVERY`, coordenadas, janela e estado |
| `trip_stop_deliveries` | relaciona pedidos à parada e registra prova por pacote quando necessário |
| `trip_events` | auditoria de criação, aceite, reordenação, chegada, falha e cancelamento |
| `trip_quotes` | preço do cliente, repasse do motoboy, economia e versão do algoritmo |

Estados iniciais sugeridos:

```text
DRAFT → OFFERED → ACCEPTED → IN_PROGRESS → COMPLETED
  │         │          │            └────→ PARTIALLY_COMPLETED
  └─────────┴──────────┴─────────────────→ CANCELED
```

O estado de cada delivery continua existindo e deve ser compatível com o estado da viagem.

## 5. Compatibilidade e agrupamento

Uma combinação candidata deve verificar:

- raio entre pickups e destinos;
- janelas de tempo;
- peso e tamanho total;
- tipo de veículo e restrições do produto;
- desvio máximo em distância e duração;
- pedidos/candidatos já reservados por outra rodada;
- consentimento quando a modalidade compartilhada for opt-in.

Na v1, limitar a no máximo 3 pedidos. Mesmo sem TSP avançado, avaliar todas as sequências válidas desse conjunto pequeno é preferível a usar cegamente a ordem de criação.

## 6. Preço e promessa ao cliente

O desconto não deve ser apenas percentual por posição. A cotação precisa comparar:

- preço individual congelado;
- custo estimado da viagem combinada;
- economia do cliente;
- repasse total e ganho por hora do motoboy;
- margem da plataforma;
- risco de atraso.

Restrições:

- cliente nunca paga acima da opção individual já apresentada sem nova confirmação;
- motoboy vê todas as paradas, carga total, km, prazo e repasse antes de aceitar;
- desconto e repasse são snapshots versionados;
- mudança de composição após aceite exige regra e auditoria próprias.

## 7. Fases

### `TRIP-00` — descoberta

- telemetria e simulador offline;
- relatório de densidade/economia/desvio;
- decisão explícita de seguir ou arquivar.

### `TRIP-01` — shadow mode

- schema aditivo;
- agrupador determinístico e testável;
- propostas gravadas para comparação, sem alterar despacho;
- dashboard interno de qualidade das combinações;
- teste de concorrência para impedir dupla alocação.

### `TRIP-02` — piloto controlado

- opt-in de cliente e motoboy;
- máximo de 3 pedidos e uma região operacional;
- tela de paradas e provas por pacote;
- acompanhamento do próprio pacote para o cliente;
- fallback seguro para corridas individuais;
- feature flag e possibilidade de desligar sem migration destrutiva.

### Depois do piloto

- precificação definitiva;
- múltiplos hubs/veículos;
- otimização avançada;
- expansão por região baseada em métricas.

## 8. Métricas de sucesso e guardrails

| Métrica de sucesso | Guardrail |
| --- | --- |
| custo médio por pedido menor | atraso p95 dentro do limite aprovado |
| ganho do motoboy por hora maior | cancelamento não piora além do limite |
| mais entregas por km | nenhuma perda de rastreabilidade/prova |
| boa taxa de aceite da viagem | incidentes e suporte não aumentam de forma material |

## 9. Decisões pendentes

1. Modalidade compartilhada opt-in ou automática — recomendação: opt-in no piloto.
2. Região e período do piloto.
3. Limites de raio, janela, desvio e capacidade.
4. Política de cancelamento parcial.
5. Responsabilidade por atraso adicional.
6. Como a economia é dividida entre cliente, motoboy e plataforma.

## 10. Fora de escopo inicial

- van/caminhão, múltiplos motoristas ou transferência entre hubs;
- otimização em escala nacional;
- rastreamento por caixa com hardware;
- construção de telas antes do gate `TRIP-00`;
- habilitação cloud ou pagamentos por consequência deste plano.
