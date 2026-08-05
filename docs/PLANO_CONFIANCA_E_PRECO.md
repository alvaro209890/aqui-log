# Plano — Confiança e Preço (avaliações, SMS, foto, valor da corrida)

> **Status:** FUTURO — decisões pendentes do PLANO_B2C.md §5 (#1, #3, #6, #8, #9).
> **Data:** 2026-08-04

---

## 1. Preço da corrida (#1 do plano B2C)

**Decisão recomendada: (a) sistema calcula sempre** — estilo Uber.
Motoboy aceita/recusa com base no valor; sem negociação de preço na v1.

### Implementação futura
- Já existe `PricingService` server-side (base + km + % plataforma).
- Evoluir para **faixas de peso/tamanho** somando ao preço (ver §2 do plano B2C).
- Opção futura: **aumento automático** se ninguém aceitar em X minutos
  (configurável: ex. +15% por rodada, teto de +60%).

### Regras
| Item | Regra |
|---|---|
| Preço exibido ao cliente | Antes de publicar (estimativa do servidor) |
| Preço no aceite | Congelado no momento da oferta |
| Mudança de rota | Recalcular (só com consentimento) |
| Reembolso | Proporcional ao trecho não executado |

## 2. Foto do produto (#3)

**Decisão recomendada: obrigatória** — é o que dá confiança pro motoboy aceitar.

### Implementação futura
- Front já envia foto (upload no storage, URL no `notes`).
- Backend: campo `product_photo_urls` (array) com validação de host (mesma
  policy do `proofUrl`).
- Regra: sem foto → não publica oferta (ou status `AWAITING_PHOTO`).

## 3. Validação de telefone (#8)

**Decisão recomendada: código SMS no cadastro** pra reduzir lixo/bots.

### Implementação futura
- Enviar código de 6 dígitos via SMS (provedor a escolher — Twilio/TotalVoice/Zenvia).
- `customers.phone_verified_at`; pedido só com telefone verificado.
- Fallback local: log do código (como o reset de senha) enquanto não há provedor.

## 4. Avaliação mútua (#9)

**Decisão recomendada: mútua** — cliente avalia motoboy e motoboy avalia cliente.

### Implementação futura
- `ratings` hoje: 1 registro por delivery (quem avaliou = dono do pedido).
- Evoluir: `ratings.from_role` (CUSTOMER/COURIER) + 2 registros por delivery
  (unique: delivery_id + from_role).
- Perfis: média de avaliação no perfil do motoboy (card da oferta) e no do cliente.

## 5. Oferta sem aceite (#6 e #7)

**Decisões recomendadas:** avisar o cliente na 1ª versão; re-oferecer com raio
maior uma vez, depois cancelar.

### Implementação futura
- Job `offerSweep`: pedido sem aceite há X min → notificação push pro cliente
  ("Ninguém aceitou ainda — quer aumentar o valor ou ampliar a área?").
- **Raio maior**: despacho hoje é "courier mais próximo com localização"; evoluir
  para candidatos num raio configurável com fallback em anéis crescentes.

## 6. Fases

| Fase | Entrega | Esforço |
|---|---|---|
| 1 | Colunas de encomenda no backend (weight_kg, product_type, photos) + validação foto | Médio |
| 2 | Preço com faixas de peso/tamanho + teto de aumento automático | Médio |
| 3 | Avaliação mútua (ratings por papel) | Baixo |
| 4 | Validação de telefone por SMS | Médio |
| 5 | Notificação de oferta sem aceite + anéis de raio | Médio |

## 7. Fora de escopo

- Seguro de carga, verificações biométricas, score de risco avançado.
