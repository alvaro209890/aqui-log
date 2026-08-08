# Checklist de sessão

Marque apenas o que foi realmente verificado. Use `N/A` com justificativa quando
um item não se aplicar.

## 1. Antes de editar

- [ ] Li `AGENTS.md`, estado atual, backlog e roadmap.
- [ ] Registrei o ID da única tarefa da sessão.
- [ ] Confirmei escopo, fora de escopo, dependências e gates.
- [ ] Verifiquei branch e worktree; preservei mudanças preexistentes.
- [ ] Confirmei no disco os paths e fatos relevantes.
- [ ] Identifiquei ações externas que exigem autorização.

## 2. Durante o trabalho

- [ ] Mantive a mudança ligada ao ID escolhido.
- [ ] Preservei contratos e fallbacks declarados.
- [ ] Não introduzi segredo, dado pessoal ou credencial.
- [ ] Não liguei cloud, SMS ou pagamento sem autorização explícita.
- [ ] Criei ou atualizei testes proporcionais ao risco.
- [ ] Registrei bloqueios em vez de adivinhar decisões de produto.

## 3. Validação técnica aplicável

- [ ] Testes focados da regra alterada.
- [ ] `pnpm build`.
- [ ] `pnpm lint`.
- [ ] `pnpm test`.
- [ ] `pnpm smoke` com Postgres e Redis reais.
- [ ] `flutter analyze` e `flutter test` no app cliente.
- [ ] `flutter analyze` e `flutter test` no app motoboy.
- [ ] `dart analyze` e `dart test` no `aqui_log_core`, quando afetado.
- [ ] `flutter analyze` e `flutter test` no `aqui_log_ui`, quando afetado.
- [ ] Migration para frente e rollback em banco de teste.
- [ ] QA visual em navegador, emulador ou dispositivo real.
- [ ] Caso de erro, autorização ou rollback exercitado.

## 4. Documentação e encerramento

- [ ] Critérios de aceite foram comprovados um a um.
- [ ] `01-ESTADO-ATUAL.md` reflete o estado observado.
- [ ] Backlog/roadmap foram atualizados se houve transição de estado.
- [ ] API/arquitetura foram atualizadas se contratos mudaram.
- [ ] Changelog contém data, ID e evidência.
- [ ] Handoff informa feito, não feito, evidência, risco e próximo ID.
- [ ] `git diff --check` está limpo.
- [ ] Links internos alterados apontam para arquivos existentes.
- [ ] O diff não contém mudança lateral.
- [ ] Commit/push/deploy correspondem exatamente à autorização recebida.
