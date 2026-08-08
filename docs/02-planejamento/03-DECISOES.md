# Registro canônico de decisões

> **Atualizado:** 2026-08-07
> **Fonte de verdade:** este arquivo é o único lugar para o estado de `DEC-*`.

Recomendação não é decisão. Um agente não pode mudar `PENDENTE` para `DECIDIDA`
sem resposta explícita do Álvaro. Ao decidir, registrar data, autor, escolha e
consequência; os planos passam apenas a apontar para este registro.

## 1. Invariantes já decididos

| ID | Estado | Decisão |
| --- | --- | --- |
| `INV-01` | `DECIDIDA` | Produto B2C direto; empresa/B2B removido |
| `INV-02` | `DECIDIDA` | PostgreSQL é fonte de verdade; Redis é auxiliar |
| `INV-03` | `DECIDIDA` | Preço calculado e congelado pelo servidor |
| `INV-04` | `DECIDIDA` | Mobile usa identidade laranja; dashboard ainda pendente |
| `INV-05` | `DECIDIDA` | Cloud, SMS e pagamentos exigem autorização explícita |
| `INV-06` | `DECIDIDA` | Persistência UTC; regras locais em `America/Sao_Paulo` |

## 2. Decisões pendentes do roadmap

| ID | Estado | Dono | Decisão necessária | Recomendação atual | Bloqueia |
| --- | --- | --- | --- | --- | --- |
| `DEC-01` | `PENDENTE` | Álvaro | Foto da encomenda obrigatória? | Obrigatória ao publicar; flag desligada durante transição | ativação da obrigatoriedade |
| `DEC-02` | `PENDENTE` | Álvaro | Faixas/adicionais de peso e tamanho | Configuração server-side versionada, calibrada no piloto | valores finais de `B2C-02` |
| `DEC-03` | `PENDENTE` | Álvaro | Sem aceite: raio, preço ou cancelamento? | Ampliar raio com limite; aumento só com consentimento | `DISP-01/02` |
| `DEC-04` | `PENDENTE` | Álvaro | Provedor de SMS | Avaliar custo, cobertura BR, webhook e sandbox | `B2C-04` |
| `DEC-05` | `PENDENTE` | Álvaro | Iniciar ledger sem gateway? | Sim, somente com autorização de pagamentos | `PAY-01` |
| `DEC-06` | `PENDENTE` | Álvaro | Gateway PIX | Avaliar Pagar.me, Asaas e Mercado Pago | `PAY-02` |
| `DEC-07` | `PENDENTE` | Álvaro | Rota automática compartilhada ou opt-in? | Opt-in no primeiro piloto | `TRIP-02` |
| `DEC-08` | `PENDENTE` | Álvaro | Lote manual convive com auto-dispatch? | Sim, com reserva única no banco | `LOT-01` |
| `DEC-09` | `PENDENTE` | Álvaro | Candidatura livre ou pré-alocação no lote agendado? | Publicação + candidatura ranqueada | `LOT-02` |
| `DEC-10` | `PENDENTE` | Álvaro | Janela de espera do lote | 5–15 min, cliente avisado | `LOT-01` |
| `DEC-11` | `PENDENTE` | Álvaro | Tolerâncias anti-atraso | Validar valores propostos no plano de lote | `LOT-01` |
| `DEC-12` | `PENDENTE` | Álvaro | Retenção da trilha de frota | crua 7 d, agregada 30 d, diária 90 d | `FROTA-01` |
| `DEC-13` | `PENDENTE` | Álvaro | Estorno após coleta | Proposta: automático até R$ 30; humano acima | `SUP-02`, `LOT-01` |
| `DEC-14` | `PENDENTE` | Álvaro | Posição de motoboy ocioso | Coarsificada na zona; oculta fora | `FROTA-01` |
| `DEC-15` | `PENDENTE` | Álvaro | Deadhead intermunicipal | Considerar ida+volta ou mínimo municipal | `LOT-02` |
| `DEC-16` | `PENDENTE` | Álvaro | Tetos do juiz rápido | Começar conservador e ajustar com dados | `SUP-02` |
| `DEC-17` | `PENDENTE` | Álvaro | Janela de contestação/clawback | Buffer de 48–72 h | `PAY-02` |

## 3. IDs de decisões específicas dos planos

Questões detalhadas que ainda não têm `DEC-*` usam prefixo global e estável:

- `LOT-DEC-*` — lote e viagem;
- `FROTA-DEC-*` — mapa, heartbeat e retenção;
- `ADMIN-DEC-*` — permissões e operação do painel;
- `SUP-DEC-*` — suporte e reclamações;
- `PAY-DEC-*` — ledger e pagamentos.

Quando uma questão específica for promovida ao roadmap, ela recebe novo `DEC-*` e
o plano registra o alias. Nunca referenciar apenas “decisão 3” ou “item 5”.

## 4. Como registrar uma decisão

1. Alterar o estado para `DECIDIDA` ou `REJEITADA`.
2. Substituir a recomendação pela escolha explícita, sem apagar o contexto anterior.
3. Adicionar data e autor no texto da decisão.
4. Atualizar gates no roadmap e estado no backlog.
5. Atualizar somente os planos afetados e incluir link para este registro.
