# Cobertura funcional do MVP

Legenda: **funcional** = fluxo exercitado pela API/smoke test ou painel/apps; **fundacao** = contrato/cliente ou interface existe, mas falta completar a experiencia; **planejado** = fora desta entrega.

## Empresa

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Cadastro, aprovacao e login | Funcional | API, perfis e app Flutter com tela de login |
| Usuarios da empresa | Funcional | Proprietario lista e cria operadores |
| Solicitar e agendar entrega | Funcional | App: tela `new_delivery` + API |
| Rastreamento em tempo real | Funcional no backend | Painel com mapa Leaflet; app empresa sem mapa GPS nativo |
| Historico | Funcional | Eventos cronologicos; detalhe no app |
| Financeiro e relatorios | Funcional basico | Totais API + tela `reports` no app empresa |
| Notificacoes | Funcional na API | Push nativo ainda planejado |
| Avaliacao | Funcional | Uma avaliacao por entrega concluida |
| Configuracoes | Fundacao | Tela `settings` no app; politicas avancadas ainda leves |

## Entregador

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Cadastro, veiculo e documentos | Funcional | URLs persistidas; upload privado pendente |
| Aprovacao e disponibilidade | Funcional | App com toggle + API |
| Oferta, aceite e recusa | Funcional | Tela `available_deliveries` com mapa UI |
| Navegacao GPS | Fundacao | Mapa ilustrativo no app; abrir app de mapas externo pendente |
| Coleta, entrega e comprovantes | Funcional | Tela `proof` (camera simulada) + maquina de estados |
| Historico | Funcional | Tela `my_deliveries` + detalhe |
| Carteira e extrato | Funcional basico | Tela `wallet` + credito idempotente |
| Avaliacoes, perfil e suporte | Fundacao | Perfil no app; suporte ainda informativo |

## Dashboard e plataforma

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Login, KPIs e entregas | Funcional | 7 metricas com variacao % + tabela |
| Graficos (hora, status, gauge) | Funcional | recharts + endpoints `/dashboard/charts/*` e `/performance` |
| Empresas, entregadores e usuarios | Funcional | Paginas Companies e Couriers no sidebar |
| Entregas com filtros | Funcional | Pagina Deliveries + query params na API |
| Mapa em tempo real | Funcional | Leaflet + WebSocket no painel |
| Financeiro, relatorios e avaliacoes | Funcional basico | Paginas Finance, Reports, Ratings |
| Alertas / notificacoes | Funcional basico | Pagina Alerts + badge no topbar |
| Permissoes | Funcional basico | Seis perfis; permissoes granulares futuras |
| Motor de despacho | Funcional MVP | Proximidade, disponibilidade e exclusao de recusas |
| API publica e integracoes | Planejado | ERP, e-commerce e marketplaces ficam para fase futura |
| IA, BI, calor, roteirizacao e agrupamento | Planejado | Explicitamente fora do MVP estrutural |

## Bloqueios antes de producao

- Upload privado e validacao de documentos/comprovantes.
- Push notification, provedor de mapas/geocoding e observabilidade.
- Gateway de pagamento, conciliacao, saque e regras fiscais.
- Refresh token, recuperacao de senha, MFA administrativo e gestao de sessoes.
- Locks/filas Redis no despacho para alta concorrencia.
- Chaves estrangeiras, politica de retencao e rotinas de saneamento do banco.
- Testes de carga, pentest, LGPD, backups e infraestrutura AWS/GCP.
