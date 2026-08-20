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

- **2026-08-19** · `—` · `<este commit>` · pasta de execução autônoma criada; as 7
  `DEC-*` pendentes fechadas pelo Álvaro e `DEC-27` (iOS sem compilar) registrada;
  `TRIP-00/01/02` cortados do roadmap pela `DEC-07`
  · portão: N/A — mudança documental, sem código tocado
  · runbook: criado com 9 itens abertos
  · próximo: `QA-01` ([`10-ONDA-1-QA-AUTOMATIZADO.md`](10-ONDA-1-QA-AUTOMATIZADO.md))
