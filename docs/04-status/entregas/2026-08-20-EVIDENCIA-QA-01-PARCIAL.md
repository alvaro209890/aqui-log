# Evidência — QA-01 parcial (2026-08-20)

> **PC:** acer. **Autor:** Hermes-server. **Estado:** `IN_PROGRESS` — **não é DONE.**
> O portão de app no emulador ainda falha depois de publicar o pedido.
> Widget tests e `flutter analyze` dos dois apps passaram nesta sessão.

## O que entrou no main

| Peça | Onde |
| --- | --- |
| AVD dedicado `aqui_log_qa` (x86_64, partition 8192) | criado neste PC; o `Medium_Phone_API_36.0` do AquiResolve **não é tocado** |
| `scripts/qa-mobile.sh` | sobe emulador headless, API+banco descartáveis, roda `flutter test integration_test`, derruba tudo no `trap` |
| `integration_test/app_test.dart` nos dois apps | fluxo dirigido; senha de admin só via `--dart-define` (não vai pro git) |
| `navigatorKey` em `customer_app` e `courier_app` | o botão *Criar conta* usava `Navigator.of(context)` **acima** do `MaterialApp` e quebrava no app real |
| `ValueKey` nos campos de cadastro/pedido + `QA_FIXTURE_PHOTO` | o `ListView` não monta campo fora da tela; o emulador não tem câmera |

## Medido de verdade no emulador (não suposto)

Rodadas `bash scripts/qa-mobile.sh customer_app` em 2026-08-20, AVD `aqui_log_qa`, API numa porta livre, `GEO_PROVIDER=local`, `PHONE_VERIFY_ADAPTER=local`.

| Passo | Resultado |
| --- | --- |
| Boot `sys.boot_completed` | ✅ ~90 s na 1ª subida do AVD novo |
| `flutter analyze` cliente | ✅ 0 issues (9,7 s) |
| `flutter test` cliente (widget) | ✅ **23 passed** |
| `flutter analyze` entregador | ✅ 0 issues (7,2 s) |
| `flutter test` entregador (widget) | ✅ **30 passed** |
| Cadastro + código de telefone + home | ✅ medido no e2e |
| Formulário de pedido + foto fixture | ✅ medido |
| Publicar pedido | ✅ depois de creditar com `customerId` (não `user.id`) |
| Completar corrida via API + código na tela | ❌ última falha: `scrollUntilVisible` arrastou o `Scrollable` do `TextField` (eixo horizontal) em vez da `ListView` |
| `QA-02` / `QA-03` | nem começaram — dependem disto |

O e2e **não é verde**. Marcar `DONE` agora mentiria o portão.

## Como retomar

```bash
cd ~/Documentos/aqui-log
bash scripts/qa-mobile.sh customer_app
bash scripts/qa-mobile.sh courier_app
```

Próximo conserto óbvio: no `fillKey`, passar `scrollable: find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable))`.

## O que NÃO vai no git

Pastas `docs/04-status/entregas/qa-01-<timestamp>/` (log da API, screencap). Estão no `.gitignore`.
