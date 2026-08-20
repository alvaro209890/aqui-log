# Onda 9 — iOS

> **Objetivo:** quando o MacBook chegar, compilar tem que ser um comando — não um
> projeto.

## A decisão

**`DEC-27` (2026-08-19):** o código iOS é desenvolvido **agora**, junto com o
Android. A **compilação fica para quando o MacBook do Álvaro chegar** — ele já foi
pedido. Este PC é Linux: `flutter build ios` e `flutter build ipa` **não rodam
aqui**, e isso não é defeito nem falta de tentativa.

Nenhum agente deve tentar compilar iOS, nem instalar toolchain, nem propor
alternativa paga de CI sem o Álvaro pedir.

## O que já existe

Os dois apps têm projeto iOS scaffoldado e correto:

| Item | `customer_app` | `courier_app` |
| --- | --- | --- |
| Bundle id | `br.com.aquilog.aquiLogCliente` | `br.com.aquilog.aquiLogEntregador` |
| `NSCameraUsageDescription` | ✅ | ✅ |
| `NSLocationWhenInUseUsageDescription` | ✅ | ✅ |
| `NSPhotoLibraryUsageDescription` | ✅ | ✅ |

⚠️ `ios/Flutter/*` é gitignored (arquivo gerado); o `flutter_export_environment.sh`
se regenera sozinho. Não versione.

---

## `IOS-01` — paridade de configuração

**Depende de:** `QA-03`.

- [ ] Conferir, para cada capacidade que o Android já usa, se o iOS tem o
      equivalente declarado — e se o texto da permissão está **em português e
      explica o porquê** (a App Store rejeita descrição genérica).
- [ ] App do prestador precisa de localização **em segundo plano**
      (`NSLocationAlwaysAndWhenInUseUsageDescription` + `UIBackgroundModes`), senão
      o heartbeat morre com a tela desligada. O app do cliente **não** precisa —
      não peça permissão que não usa.
- [ ] Push: entitlement de notificação preparado para o FCM do `OPS-02`.
- [ ] Ícones e splash nas resoluções do iOS, com a identidade laranja.
- [ ] `Info.plist` completo: nome de exibição, versão espelhando o Android, ATS
      configurado para o domínio da API.
- [ ] Nenhuma dependência Flutter usada pelos apps que seja **Android-only** — se
      houver, registre e proponha a alternativa multiplataforma.

**Aceite:** `flutter analyze` verde nos dois apps; revisão item a item registrada
na evidência (é revisão de configuração — não há como executar aqui, e dizer isso
é a resposta honesta); nenhum `TODO` deixado no `Info.plist`.

---

## `IOS-02` — CI pronto para o dia do Mac

**Depende de:** `IOS-01`.

- [ ] Workflow de build iOS **escrito e comentado**, desabilitado por padrão
      (`workflow_dispatch`), pronto para rodar sem edição.
- [ ] Documento curto de "primeira compilação": comandos na ordem, o que vai
      pedir senha, o que vai falhar na primeira vez e por quê.
- [ ] Ordem de assinatura registrada: certificado, provisioning profile, team id —
      sem nenhum valor real no repo.

---

## `IOS-03` — compilar e publicar *(bloqueada)*

**Depende de:** item "MacBook + conta Apple Developer" do
[`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md).

- [ ] `flutter build ipa` dos dois apps.
- [ ] Assinatura e envio para o TestFlight.
- [ ] QA no aparelho e paridade com o Android.

Enquanto o Mac não chega, esta tarefa fica `BLOCKED` e **não segura nada** — é a
última da fila de propósito.
