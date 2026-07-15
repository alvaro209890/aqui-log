# Cobertura funcional do MVP

Legenda: **funcional** = fluxo exercitado pela API/smoke test; **fundacao** = contrato/cliente ou interface existe, mas falta completar a experiencia; **planejado** = fora desta entrega.

## Empresa

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Cadastro, aprovacao e login | Funcional | API, perfis e cliente mobile prontos |
| Usuarios da empresa | Funcional | Proprietario lista e cria operadores |
| Solicitar e agendar entrega | Funcional | Enderecos, coordenadas e agenda |
| Rastreamento em tempo real | Funcional no backend | Falta integrar mapa real no app |
| Historico | Funcional | Eventos cronologicos protegidos |
| Financeiro e relatorios | Funcional basico | Totais e KPIs; telas mobile ainda demonstrativas |
| Notificacoes | Funcional na API | Push nativo ainda planejado |
| Avaliacao | Funcional | Uma avaliacao por entrega concluida |
| Configuracoes | Planejado | Politicas e preferencias ainda sem modelo |

## Entregador

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Cadastro, veiculo e documentos | Funcional | URLs persistidas; upload privado pendente |
| Aprovacao e disponibilidade | Funcional | Integrado ao despacho |
| Oferta, aceite e recusa | Funcional | Oferta persistida com expiracao |
| Navegacao GPS | Fundacao | Coordenadas/cliente prontos; abrir app de mapas pendente |
| Coleta, entrega e comprovantes | Funcional | Maquina de estados exige URLs de prova |
| Historico | Funcional na API | Tela detalhada pendente |
| Carteira e extrato | Funcional basico | Credito idempotente na conclusao |
| Avaliacoes, perfil e suporte | Fundacao | Avaliacao persistida; telas/fluxo de suporte pendentes |

## Dashboard e plataforma

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Login, KPIs e entregas | Funcional | Painel consome a API real |
| Empresas, entregadores e usuarios | Funcional na API | Paginas completas do sidebar pendentes |
| Mapa em tempo real | Funcional no backend | Componente visual ainda ilustrativo |
| Financeiro, relatorios e auditoria | Funcional basico | Endpoints persistidos |
| Permissoes | Funcional basico | Seis perfis; permissoes granulares futuras |
| Notificacoes e logs | Funcional basico | Caixa e auditoria; central web pendente |
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
