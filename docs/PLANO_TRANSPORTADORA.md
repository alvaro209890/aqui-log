# Plano — Transportadora (múltiplos pedidos por motoboy)

> **Status:** FUTURO — nada desenvolvido
> **Data:** 2026-08-04
> **Objetivo:** o motoboy pega **vários pedidos** que saem de um local próximo e
> leva para outro local próximo, estilo transportadora/rota — em vez de 1 corrida = 1 pedido.

---

## 1. Problema que resolve

Hoje (básico B2C): 1 pedido → 1 oferta → 1 motoboy → 1 corrida.
Isso é caro e lento quando vários pedidos compartilham origem/destino próximos
(ex.: 3 encomendas do mesmo bairro para o mesmo centro comercial).

A transportadora **agrupa** pedidos compatíveis numa única rota e reparte o
ganho entre cliente (frete menor) e motoboy (mais entrega por viagem).

## 2. Conceito

| Termo | Definição |
|---|---|
| **Rota** | Conjunto de pedidos executados numa mesma viagem por 1 motoboy |
| **Hub de origem** | Raio em torno do ponto de retirada (ex.: 1 km) |
| **Hub de destino** | Raio em torno do ponto de entrega (ex.: 1 km) |
| **Capacidade** | Limites do motoboy (volume, peso total, nº de pacotes) |
| **Janela** | Tempo máximo de espera para fechar a rota (ex.: 15 min) |

## 3. Fluxo futuro

1. Cliente cria pedido normalmente (tipo, peso, tamanho já existem).
2. **Agregador** mantém uma fila de pedidos `REQUESTED` por região de retirada.
3. Quando um motoboy fica disponível numa região, o sistema oferece:
   - **(a) Rota pronta**: pedidos já agrupados que compartilham origem/destino próximos, ou
   - **(b) Oferta simples** (comportamento atual) enquanto a rota não fecha.
4. Motoboy aceita a rota → executa os pedidos em sequência (GPS por pedido).
5. Entrega concluída → prova por pedido → repasse proporcional ao motoboy.

## 4. Modelo de dados (esboço)

- `trips` (nova): id, courier_id, status, origem hub, destino hub, janela.
- `trips_deliveries` (nova): trip_id, delivery_id, ordem de entrega.
- `deliveries`: ganha `trip_id` (nullable).
- Motor de agrupamento: job periódico (ex.: 30s) que casa `REQUESTED` por
  proximidade de pickup (Haversine) + raio configurável via Settings.

## 5. Precificação da rota

- Soma dos preços individuais com **desconto progressivo** por pedido na mesma rota
  (ex.: 1º 100%, 2º 85%, 3º 70%... — configurável em Settings Redis).
- Repasse ao motoboy: base + km total da rota + bônus por pedido extra.
- Regra de negócio: **nunca** o valor da rota pode ser menor que o custo individual
  do maior pedido (evita rota que não compensa).

## 6. Fases de implementação

| Fase | Entrega | Esforço |
|---|---|---|
| 1 | Tabelas `trips`/`trips_deliveries` + API CRUD mínima | Médio |
| 2 | Agregador por proximidade (job) + regras de capacidade | Alto |
| 3 | App motoboy: tela de rota (lista de paradas, GPS por parada) | Alto |
| 4 | App cliente: visão da rota (posição do seu pacote na rota) | Médio |
| 5 | Precificação de rota + reparte de repasse | Médio |
| 6 | Dashboard: métricas de rota (pedidos/viagem, ocupação) | Baixo |

## 7. Fora de escopo (por enquanto)

- Otimização de rotas com algoritmo (TSP) — v1 usa ordem de criação/inserção.
- Veículos grandes (van/caminhão) com múltiplos hubs.
- Rastreamento de carga fracionada por caixa.

## 8. Decisões pendentes (para o Álvaro)

1. Raio padrão dos hubs (1 km? 2 km?) — recomendo começar com 1 km.
2. Desconto máximo por rota (ex.: cap de 30%).
3. Quantos pedidos por rota no início (recomendo máx. 3).
4. O cliente escolhe "quero rota compartilhada (mais barato)" ou é automático?
