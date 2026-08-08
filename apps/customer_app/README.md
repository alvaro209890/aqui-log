# App do cliente — Aqui Log

Aplicativo Flutter do cliente pessoa física (`CUSTOMER`). Não é app de empresa.
Leia [`AGENTS.md`](../../AGENTS.md) antes de editar.

## Fluxos existentes

- cadastro/login de cliente;
- criação de pedido com encomenda estruturada;
- lista, detalhe, acompanhamento, cancelamento permitido e avaliação;
- tema laranja compartilhado por `aqui_log_ui`.

## Comandos

```bash
cd apps/customer_app
flutter pub get
flutter analyze
flutter test
flutter run
```

## Invariantes

- Nunca enviar ou confiar em preço definido pelo app.
- Manter leitura de pedido histórico pelo fallback de `notes`.
- Cliente só acessa os próprios pedidos.
- Cloud, SMS e pagamento real dependem de gates e autorização.

Fluxo completo: [produto](../../docs/01-produto/01-FLUXO-DO-PRODUTO.md).
