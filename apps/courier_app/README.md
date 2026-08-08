# App do motoboy — Aqui Log

Aplicativo Flutter do prestador (`COURIER`). Leia [`AGENTS.md`](../../AGENTS.md)
e o [estado atual](../../docs/04-status/01-ESTADO-ATUAL.md) antes de editar.

## Fluxos existentes

- cadastro/login, perfil e disponibilidade;
- ofertas, aceite/recusa e entregas em andamento;
- coleta, prova, trânsito e entrega;
- carteira básica e tema laranja compartilhado.

## Comandos

```bash
cd apps/courier_app
flutter pub get
flutter analyze
flutter test
flutter run
```

## Invariantes

- Aceite respeita lock/transação do servidor; UI não presume sucesso.
- Custódia após coleta nunca some por cancelamento/redespacho.
- Identidade do heartbeat vem do JWT/socket, não de `courierId` confiado no payload.
- GPS, câmera e prova exigem QA em emulador/dispositivo; teste de widget não basta.
