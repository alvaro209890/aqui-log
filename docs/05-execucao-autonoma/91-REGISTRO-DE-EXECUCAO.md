# Registro de execução

> A memória da cadeia entre sessões. **Mais recente no topo.**
>
> Leia a última linha no início da sessão — ela diz onde a anterior parou e por
> quê. Escreva a sua no fim, **depois** do portão e **antes** do commit.

## Formato

Uma linha por tarefa fechada, nesta forma:

```
- **AAAA-MM-DD** · `<ID>` · `<commit>` · <resultado em uma frase>
  · portão: <números reais> · runbook: <item novo, ou "—"> · próximo: `<ID>`
```

Regras:

- **Uma linha por tarefa**, não um diário. Detalhe fica na evidência em
  `../04-status/entregas/`.
- Números reais no portão (`26 suítes / 224 testes`), nunca "tudo verde".
- Se a sessão **não fechou tarefa**, registre assim mesmo dizendo o porquê — uma
  sessão sem linha aqui é uma sessão que a próxima não consegue reconstruir.
- Se a fila secou, escreva `fila seca` e qual item do runbook destrava a primeira
  bloqueada.

## Registro

- **2026-08-20** · `QA-01` · *(este commit)* · aparato no main: AVD `aqui_log_qa`, `scripts/qa-mobile.sh`, `integration_test` nos dois apps, `navigatorKey` (botao Criar conta estava quebrado). Widget tests 23+30 e analyze verdes. **E2E no emulador ainda falha** depois de publicar (scroll no TextField, nao na ListView). **Nao e DONE.**
  · portao: customer analyze 0 issues + flutter test 23 passed; courier analyze 0 issues + flutter test 30 passed; qa-mobile.sh customer_app exit 1
  · runbook: —
  · proximo: `QA-01` (fechar o e2e; depois `QA-02`)

- **2026-08-19** · `—` · `<este commit>` · pasta de execução autônoma criada; as 7
  `DEC-*` pendentes fechadas pelo Álvaro e `DEC-27` (iOS sem compilar) registrada;
  `TRIP-00/01/02` cortados do roadmap pela `DEC-07`
  · portão: N/A — mudança documental, sem código tocado. **Mas a cadeia de QA da
  onda 1 foi medida de verdade:** emulador headless sobe em 53 s (`device`,
  API 36), `flutter devices` o vê como `android-x64`, `flutter build apk --debug`
  com JDK 17 compila em 242 s — e a instalação **falhou**, revelando 2 bloqueios
  registrados no plano da onda 1 (APK arm64 × emulador x86_64; AVD atual sem
  espaço e compartilhado com o AquiResolve)
  · runbook: criado com 9 itens abertos
  · próximo: `QA-01` ([`10-ONDA-1-QA-AUTOMATIZADO.md`](10-ONDA-1-QA-AUTOMATIZADO.md))
