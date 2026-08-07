# Aqui Log — Roadmap executivo B2C

> **Atualizado:** 2026-08-07
> **Status:** fonte de verdade para prioridade, dependências e ordem de execução
> **Produto principal:** cliente pessoa física → motoboy, sem empresa no fluxo
> **Regra operacional:** desenvolvimento e validação local primeiro; nenhuma cloud é ligada sem pedido explícito do Álvaro

## 1. Objetivo atual

Transformar o MVP B2C já funcional em um piloto confiável, mensurável e preparado para cobrança, sem antecipar complexidade de gateway, cloud ou rotas compartilhadas.

O fluxo que precisa permanecer íntegro em todas as fases é:

```text
cliente cadastra → descreve encomenda → recebe preço do servidor → cria pedido
→ sistema oferece → motoboy aceita → coleta/prova → trânsito → entrega/prova
→ cliente e motoboy avaliam
```

## 2. Como os documentos se relacionam

| Documento | Papel | Pode definir prioridade? |
| --- | --- | --- |
| `ROADMAP.md` | Ordem executiva, dependências, gates e Definition of Done | **Sim — fonte principal** |
| `PLANO_B2C.md` | Estado funcional e visão do domínio B2C | Não; segue este roadmap |
| `PLANO_CONFIANCA_E_PRECO.md` | Especificação de encomenda, preço, avaliações, SMS e oferta | Não; detalha `B2C-01` a `B2C-04` |
| `DIRETRIZES_VISUAIS.md` | Paleta e regras da futura identidade laranja | Não; detalha `UX-01` |
| `PLANO_PAGAMENTOS.md` | Ledger, reserva, estorno e gateway | Não; detalha `PAY-01` e `PAY-02` |
| `PLANO_TRANSPORTADORA.md` | Descoberta e execução de rotas multi-pedido | Não; só depois do gate `TRIP-00` |
| `MVP_COVERAGE.md` | Evidência do que existe e limitações atuais | Não |
| `CHANGELOG_SPRINTS.md` / `SESSAO_IMPLEMENTACAO.md` | Histórico das entregas anteriores | Não |
| `PLANO_IMPLEMENTACOES.md` | Plano histórico de julho de 2026 | **Não executar** |

## 3. Legenda de status

| Símbolo | Significado |
| --- | --- |
| ✅ | Entregue e anteriormente validado |
| ▶️ | Próximo trabalho pronto para execução |
| ⏸️ | Depende de decisão, credencial ou autorização externa |
| ⏳ | Planejado, mas bloqueado por uma fase anterior |
| 🔬 | Descoberta/medição antes de autorizar implementação |

## 4. Decisões vigentes

| Tema | Decisão atual |
| --- | --- |
| Produto | O produto principal é **B2C**. Empresa/B2B permanece apenas por compatibilidade até existir plano de remoção ou reativação. |
| Preço | Calculado e congelado pelo servidor. O cliente nunca define `priceCents` ou `courierFeeCents`. |
| Persistência | PostgreSQL continua fonte de verdade; Redis continua suporte para locks, jobs e settings. |
| Encomenda | Campos próprios entregues em 2026-08-07; manter fallback de `notes` até medir que o legado não é mais usado. |
| Mapas | OSM/Leaflet/`flutter_map` continuam no piloto; provedor pago permanece em aberto. |
| Storage e push | Firebase é o alvo futuro, mas o adapter local deve continuar funcionando. |
| Identidade | Tema laranja inspirado no AquiResolve implementado nos dois apps Flutter; dashboard ainda segue a identidade anterior. |
| Pagamentos | Nenhuma cobrança real está autorizada. Primeiro desenhar e testar o ledger interno; gateway exige decisão própria. |
| Cloud | Render/Vercel/Firebase possuem somente estrutura. Não provisionar, conectar nem publicar sem pedido explícito. |
| Tempo | Persistência em UTC; janelas de negócio em `America/Sao_Paulo`. |

## 5. Estado atual confirmado

| Capacidade | Estado | Limitação que orienta o próximo passo |
| --- | --- | --- |
| Cadastro/login de cliente | ✅ | Telefone ainda não é verificado por SMS |
| Pedido B2C e auto-dispatch | ✅ | Pedidos novos usam campos próprios; `notes` permanece como fallback legado |
| Oferta/aceite do motoboy | ✅ | Apenas um candidato por rodada; baixa transparência quando ninguém aceita |
| Preço server-side | ✅ básico | Não considera peso/tamanho e não expõe versão/breakdown persistido |
| Provas, GPS e tracking | ✅ piloto | Storage local; retenção e push real pendentes |
| Avaliação | ✅ unilateral | Falta avaliação mútua com origem explícita |
| Carteira do motoboy | ✅ básica | Não equivale a pagamento/repasse financeiro real |
| Carteira/pagamento do cliente | Não existe | Exige ledger, política de cancelamento e idempotência antes de gateway |
| Dashboard | ✅ operacional | Falta gestão B2C por cliente/categoria/peso e futura identidade visual |
| Cloud | Estrutura apenas | Sem projeto ou credencial conectado segundo a documentação e o Segundo Cérebro |

## 6. Caminho crítico de implementação

### Fase 0 — baseline e gates de produto

| ID | Status | Entrega | Saída obrigatória |
| --- | --- | --- | --- |
| BASE-01 | ✅ | MVP B2C ponta a ponta | Smoke e testes anteriores documentados em `PLANO_B2C.md` |
| BASE-02 | ▶️ | Fechar decisões mínimas de produto | Registrar respostas de `DEC-01` a `DEC-03` na seção 8 |
| BASE-03 | ▶️ | Congelar contratos antes de migrar dados | DTO, resposta da API, compatibilidade e rollback descritos em `PLANO_CONFIANCA_E_PRECO.md` |

`BASE-02` não impede preparar código aditivo, mas impede ativar obrigatoriedade de foto, aumento de preço ou cobrança.

### Fase 1 — fundação da encomenda

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| B2C-01 | ✅ | `BASE-03` | Colunas próprias para tipo, tamanho, peso, alcance e fotos; leitura compatível com `notes` legado |
| B2C-01A | ✅ | `B2C-01` | Apps e core consomem campos próprios com fallback legado |
| B2C-01B | ▶️ | `B2C-01` | Dashboard filtra/relata por cliente, categoria, tamanho e peso |

**Estratégia de migração:** mudança aditiva, leitura dupla durante a transição e remoção do parser legado somente em uma versão posterior, após medir que não existem pedidos antigos dependentes dele.

**Gate de saída:** pedido novo e pedido legado precisam abrir nos dois apps e no dashboard; migration precisa subir e reverter em banco de teste.

### Fase 2 — preço v2 e transparência

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| B2C-02 | ⏳ | `B2C-01` | Preço com faixas de peso/tamanho e configuração server-side |
| B2C-02A | ⏳ | `B2C-02` | Persistir breakdown e versão da regra usada no pedido |
| B2C-02B | ⏳ | `B2C-02` | Prévia de preço antes da confirmação, sem confiar em valores enviados pelo app |

O preço de uma oferta aceita é imutável. Qualquer aumento posterior exige nova oferta e consentimento do cliente; não deve ser aplicado silenciosamente.

**Gate de saída:** invariantes `price = courierFee + platformFee`, arredondamento, mínimo, faixas limítrofes e replay da regra antiga cobertos por testes.

### Fase 3 — confiança e segurança do piloto

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| B2C-03 | ⏳ | `B2C-01` | Avaliação mútua, uma por papel e entrega |
| B2C-03A | ⏳ | `B2C-03` | Exibir média, contagem e contexto sem revelar dados sensíveis |
| B2C-04 | ⏸️ | Escolha de provedor | Verificação de telefone com expiração, limite de tentativas e ambiente local seguro |

SMS não bloqueia a fundação de dados nem o preço v2, mas é gate para abrir cadastro público em produção.

### Fase 4 — oferta resiliente

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| DISP-01 | ⏳ | `B2C-02`, `DEC-03` | Busca por anéis de raio, exclusão de recusas e limite de rodadas |
| DISP-02 | ⏳ | `DISP-01` | Notificar cliente sobre demora e oferecer ação explícita |
| DISP-03 | ⏳ | `DISP-02` | Telemetria de tempo até aceite, recusas, expiração e ausência de candidato |

Falha de aceite deve terminar em estado recuperável e compreensível, nunca em loop infinito de reofertas.

### Fase 5 — carteira interna do cliente

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| PAY-01 | ⏸️ | Autorização de pagamentos, `B2C-02` | Ledger imutável, saldo disponível/reservado, reserva e estorno sem gateway |
| PAY-01A | ⏳ | `PAY-01` | Políticas de cancelamento e liquidação idempotente ao concluir entrega |
| PAY-01B | ⏳ | `PAY-01A` | Operação administrativa auditada para crédito manual de ambiente de teste |

Nenhuma integração PIX/cartão entra nesta fase. O objetivo é provar a contabilidade e as transições.

### Fase 6 — prontidão operacional e publicação

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| OPS-01 | ⏳ | Fases 1–4 | FKs, índices, logs estruturados, auditoria, retenção, backup e restauração testada |
| OPS-02 | ⏸️ | Pedido explícito + credenciais | Firebase Storage e FCM reais, mantendo fallback local |
| OPS-03 | ⏸️ | Pedido explícito + `OPS-01/02` | Deploy Render/Vercel e smoke público |
| PAY-02 | ⏸️ | Gateway escolhido + `PAY-01` | PIX por gateway, webhook assinado e reconciliação |

Build verde não comprova deploy. `OPS-03` só fecha com health real, fluxo B2C público, upload privado e push em dispositivo/emulador.

### Fase 7 — transportadora multi-pedido

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| TRIP-00 | 🔬 | Telemetria `DISP-03` + operação estável | Medir densidade de pedidos compatíveis, desvio e economia potencial |
| TRIP-01 | ⏳ | Gate econômico aprovado | Modelo de viagens e agrupador em shadow mode, sem afetar ofertas reais |
| TRIP-02 | ⏳ | `TRIP-01` validado | Piloto com no máximo 3 pedidos, capacidade e prova por pacote |

Não implementar CRUD/telas de rota antes de `TRIP-00` demonstrar demanda suficiente.

## 7. Trilha paralela de experiência

Esta trilha pode ocorrer em paralelo às Fases 1–4 quando houver autorização, mas não deve alterar contratos de negócio.

| ID | Status | Entrega | Referência |
| --- | --- | --- | --- |
| UX-01 | ✅ | Tokens laranja e cores semânticas no `aqui_log_ui` | `DIRETRIZES_VISUAIS.md` |
| UX-01A | ✅ | Aplicar tema no app cliente e cobrir por testes | `DIRETRIZES_VISUAIS.md` |
| UX-01B | ✅ | Aplicar tema no app motoboy e cobrir por testes | `DIRETRIZES_VISUAIS.md` |
| UX-01C | ▶️ | Aplicar os tokens equivalentes no dashboard | `DIRETRIZES_VISUAIS.md` |
| UX-02 | ▶️ | Acessibilidade, estados, responsividade e QA visual em dispositivo | Critérios do documento visual |

## 8. Registro de decisões pendentes

| ID | Decisão necessária | Recomendação | Bloqueia |
| --- | --- | --- | --- |
| DEC-01 | Foto da encomenda obrigatória? | Sim para publicar oferta; feature flag desligada durante migração | Ativação final de `B2C-01` |
| DEC-02 | Faixas e adicionais de peso/tamanho | Configuração server-side versionada; definir valores com dados do piloto | Valores de `B2C-02`, não sua estrutura |
| DEC-03 | Sem aceite: aumentar preço, ampliar raio ou cancelar? | Ampliar raio com limite, avisar cliente e exigir consentimento para qualquer aumento | `DISP-01/02` |
| DEC-04 | Provedor de SMS | Escolher por custo, cobertura BR, webhook e sandbox | `B2C-04` |
| DEC-05 | Iniciar carteira interna sem gateway? | Sim, mas somente após autorização explícita de pagamentos | `PAY-01` |
| DEC-06 | Gateway PIX | Avaliar Pagar.me, Asaas e Mercado Pago com sandbox/webhooks | `PAY-02` |
| DEC-07 | Rota compartilhada automática ou opt-in? | Opt-in no primeiro piloto | `TRIP-02` |

Toda decisão fechada deve registrar data, autor e consequência nos planos afetados.

## 9. Definition of Done comum

Uma fase só pode mudar para ✅ quando cumprir o que for aplicável:

- migration aditiva testada para frente e para trás, sem `synchronize=true`;
- contrato da API e compatibilidade documentados;
- autorização e isolamento por papel testados;
- unitários para regras puras e integração para persistência/transações;
- `pnpm build`, `pnpm lint`, `pnpm test` e `pnpm smoke` verdes;
- `flutter analyze` e `flutter test` nos dois apps e testes do `aqui_log_core`;
- fluxo real exercitado, incluindo pelo menos um erro/rollback relevante;
- validação visual em app/painel quando houver UI;
- `MVP_COVERAGE.md`, `HANDOFF.md` e changelog atualizados com evidência;
- estado comunicado corretamente como local, validado, commitado, enviado ou publicado.

## 10. Riscos controlados pelo plano

| Risco | Controle |
| --- | --- |
| Quebrar pedidos antigos ao sair de `notes` | Leitura dupla, migração aditiva e telemetria de fallback |
| Divergir preço entre app, oferta e cobrança | Servidor único, breakdown persistido e versão da regra |
| Crédito/estorno duplicado | Ledger imutável, chave idempotente e transação de banco |
| Reoferta infinita | Limite de anéis/rodadas e estado terminal recuperável |
| Misturar cor de marca com status | Tokens semânticos e QA conforme `DIRETRIZES_VISUAIS.md` |
| Ligar cloud cedo demais | Gates `OPS-02/03` dependem de pedido explícito e credenciais |
| Construir transportadora sem densidade | Gate de descoberta `TRIP-00` antes de código operacional |

## 11. Próximo pacote recomendado

Próximo trabalho técnico: **`B2C-01B — filtros e relatórios B2C no dashboard`**.

Ao retomar:

1. aplicar a migration `1785100000000-DeliveryPackageFields` em banco de teste e executar o smoke vivo;
2. adicionar filtros/relatórios por cliente, categoria, tamanho e peso no dashboard;
3. manter `notes` como fallback de leitura e foto opcional até `DEC-01` ser confirmada;
4. concluir `UX-01C/UX-02` com dashboard laranja e QA visual em dispositivo.

Não iniciar Firebase, deploy, gateway ou transportadora como parte desse pacote.
