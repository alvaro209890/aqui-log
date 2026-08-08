# Backlog executável por agentes

> **Atualizado:** 2026-08-07
> **Papel:** converter o roadmap em pacotes pequenos, ordenados e verificáveis.
> **Regra:** um agente executa um único ID por sessão, salvo autorização explícita.

## 1. Fila vigente

| Ordem | ID | Estado | Prioridade | Resultado | Dependências/gates |
| ---: | --- | --- | --- | --- | --- |
| 1 | `BASE-04` | `READY` | P0 | Banco de teste migrado e smoke B2C vivo documentado | Docker/Postgres/Redis locais |
| 2 | `B2C-01B` | `BLOCKED` | P0 | Dashboard filtra e relata encomendas B2C | concluir `BASE-04` |
| 3 | `UX-01C` | `BLOCKED` | P1 | Dashboard usa tokens laranja equivalentes | concluir `BASE-04`; não misturar com `B2C-01B` |
| 4 | `UX-02` | `BLOCKED` | P1 | Fluxos principais passam por QA visual/acessibilidade | `UX-01C`, navegador e dispositivo/emulador |
| 5 | `B2C-02` | `BLOCKED` | P1 | Preço v2 versionado com breakdown | `B2C-01B`; `DEC-02` bloqueia valores finais |
| 6 | `B2C-03` | `BLOCKED` | P1 | Avaliação mútua por papel | baseline estável e migração de ratings definida |
| 7 | `DISP-01` | `BLOCKED` | P1 | Reoferta limitada por anéis e recusas | `B2C-02`, `DEC-03` |
| 8 | `PAY-01` | `BLOCKED` | P2 | Ledger interno sem gateway | autorização explícita + `B2C-02` |
| 9 | `OPS-01` | `BLOCKED` | P2 | Prontidão operacional local comprovada | `B2C-01B`, `B2C-02B`, `B2C-03A`, `DISP-03` |
| 10 | `LOT-01` | `BLOCKED` | P3 | Aceite atômico de lote manual | `B2C-01B`, `B2C-02B`, `B2C-03A`, `DISP-03`, `DEC-10`, `DEC-11` |

Cloud, SMS, PIX, lote automático e produção não entram na fila `READY` sem o gate
e a autorização definidos no roadmap.

## 2. Tarefa pronta — `BASE-04`

- **Objetivo:** provar o baseline atual em banco de teste real antes de novas features.
- **Dentro do escopo:** usar `.env` existente sem alterá-lo ou, se ele não existir,
  criar um a partir do exemplo sem commitar; subir Postgres/Redis apontando para
  banco explicitamente descartável; aplicar todas as migrations, incluindo
  `DeliveryPackageFields` e `RemoveCompanyModel`; criar admin; executar smoke B2C;
  verificar o fluxo cliente → oferta → aceite → entrega → avaliação.
- **Fora do escopo:** corrigir feature, refatorar código, ligar cloud ou alterar contrato.

### Passos

1. Registrar branch, commit, versões de Node/pnpm/Docker e portas disponíveis.
2. Confirmar que a conexão aponta para banco descartável; nunca apagar ou reutilizar
   banco existente sem identificar o alvo. Não sobrescrever `.env` existente.
3. Subir Postgres/Redis e registrar o nome do banco de teste.
4. Rodar `pnpm db:migrate` e registrar a lista de migrations aplicadas.
5. Em banco descartável, reverter a última migration, reaplicá-la e confirmar o
   schema final; não fazer esse ensaio em dados persistentes.
6. Rodar `pnpm build`, iniciar `pnpm --filter backend start:prod` em processo
   controlado e aguardar `/api/v1/health` confirmar Postgres + Redis saudáveis.
7. Rodar `pnpm db:admin` e `pnpm smoke` duas vezes contra a API real para detectar replay óbvio.
8. Encerrar o processo da API iniciado para o teste.
9. Executar `pnpm lint` e `pnpm test`.
10. Se algo falhar, documentar erro e abrir tarefa separada; não ampliar escopo.
11. Atualizar estado, backlog, handoff e changelog com comando, resultado, data e ambiente.

### Critérios de aceite

- [ ] Nome/host do banco descartável e commit inicial ficam registrados.
- [ ] Todas as migrations sobem sem `synchronize=true`.
- [ ] Última migration reverte e reaplica em banco descartável; schema final é conferido.
- [ ] Tabelas/colunas B2B removidas e dados B2C estruturados presentes.
- [ ] Health confirma API, Postgres e Redis saudáveis.
- [ ] Duas execuções do smoke B2C concluem o fluxo ponta a ponta.
- [ ] Build, lint e testes Node passam.
- [ ] Comandos, saídas observadas, data, ambiente e limitações ficam no handoff/changelog.

## 3. Próxima tarefa — `B2C-01B`

- **Objetivo:** tornar os campos B2C consultáveis no painel sem mudar o fluxo mobile.
- **Plano:** `docs/02-planejamento/planos/PLANO_B2C.md` e
  `docs/02-planejamento/01-ROADMAP.md`.
- **Dependência:** `BASE-04 = DONE`.
- **Fora do escopo:** tema visual, preço v2, pagamentos, cloud e remoção do fallback legado.

### Passos

1. Congelar filtros e contrato de relatório: cliente, categoria, tamanho e faixa de peso.
2. Especificar query params, paginação e combinação de filtros.
3. Implementar backend com autorização admin e testes de integração.
4. Implementar filtros/colunas no dashboard, incluindo vazio, loading e erro.
5. Validar pedidos novos e legados sem expor dados pessoais indevidos.
6. Rodar qualidade Node e QA real no navegador.
7. Atualizar API, cobertura, backlog, handoff e changelog.

### Critérios de aceite

- [ ] Cada filtro isolado e uma combinação relevante retornam o conjunto esperado.
- [ ] Paginação mantém total e filtros.
- [ ] Apenas papéis administrativos autorizados acessam os dados.
- [ ] Pedido legado continua visível com fallback documentado.
- [ ] Dashboard trata zero resultados, erro e carregamento.
- [ ] Testes e QA do navegador têm evidência.

## 4. Regras para promover uma tarefa

1. Dependências devem estar `DONE` com evidência.
2. Gates de decisão devem estar fechados no roadmap.
3. Credenciais/serviços necessários devem estar disponíveis e autorizados.
4. O pacote deve caber em uma sessão com critérios verificáveis.
5. Somente então o estado muda de `BLOCKED` para `READY`.
