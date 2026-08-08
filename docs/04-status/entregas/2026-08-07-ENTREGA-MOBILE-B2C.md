# Entrega mobile B2C — 2026-08-07

## Resultado

Esta entrega desenvolve a fundação da encomenda B2C e aproxima os dois apps mobile da identidade visual laranja do AquiResolve. O trabalho foi encerrado a pedido do usuário e enviado sem ativar cloud, pagamentos, SMS ou obrigatoriedade de foto.

## Escopo entregue

### Backend e banco

- migration aditiva `1785100000000-DeliveryPackageFields`;
- colunas `product_type`, `package_size`, `weight_kg`, `delivery_scope` e `product_photo_urls`;
- índices para tipo e tamanho;
- DTO com catálogos estáveis, peso maior que zero e até 1000 kg, precisão de 3 casas e até 3 fotos sem repetição;
- validação de que fotos pertencem ao storage permitido;
- finalidade `product` no presign, separada das provas de coleta/entrega;
- auditoria de criação registra os metadados estruturados.

### Core e apps Flutter

- `OrderMeta.toApiJson()` envia os campos próprios;
- `OrderMeta.fromDeliveryJson()` prioriza o contrato novo e cai para `fromNotes()` em pedido legado;
- `DeliverySummary` expõe `orderMeta` normalizado;
- app cliente envia observação livre em `notes` e foto com finalidade `product`;
- listas e detalhes do cliente usam o contrato estruturado;
- ofertas, lista e detalhe do motoboy mostram tipo, tamanho, peso, alcance, observação e foto;
- parser legado permanece disponível e não houve backfill arriscado de texto.

### Identidade visual mobile

- marca principal `#F97316`, hover `#EA580C`, escuro `#C2410C` e suave `#FFF7ED`;
- fundos, texto e bordas neutros;
- verde reservado a sucesso, vermelho a erro/cancelamento, âmbar a pendência e azul a trânsito/informação;
- tokens antigos verde-floresta/menta removidos do código mobile;
- app cliente e app motoboy usam os tokens compartilhados em CTA, navegação e destaques.

## Compatibilidade da API

Pedidos novos usam `productType`, `packageSize`, `weightKg`, `deliveryScope`, `productPhotoUrls` e `notes` livre.

Catálogos:

- `productType`: `DOCUMENT`, `FOOD`, `ELECTRONICS`, `FRAGILE`, `CLOTHING`, `MEDICINE`, `OTHER`;
- `packageSize`: `SMALL`, `MEDIUM`, `LARGE`;
- `deliveryScope`: `SAME_CITY`, `OTHER_CITY`.

Todos os novos campos são opcionais durante a transição. Isso preserva pedidos
B2C antigos pelo fallback de `notes`; o modelo empresa/B2B foi removido depois.

## Evidência executada

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | ✅ backend Nest + dashboard Vite |
| backend Jest | ✅ 10 suites, 32 testes |
| core `dart analyze` / `dart test` | ✅ sem issues, 6 testes |
| UI `flutter analyze` / `flutter test` | ✅ sem issues, 2 testes |
| app cliente `flutter analyze` / `flutter test` | ✅ sem issues, 10 testes |
| app motoboy `flutter analyze` / `flutter test` | ✅ sem issues, 7 testes |
| migration `up/down` | ✅ SQL e ordem de rollback cobertos por teste unitário |
| build Android release | ⏹️ interrompido ao encerrar; nenhum APK novo foi produzido |
| execução/QA em emulador | ⚠️ não concluída; AVD `Medium_Phone_API_36.0` permaneceu `offline` no ADB |
| migration e smoke em runtime | ⚠️ não executados; checkout sem `.env` e host sem comando Docker disponível |

Toolchain usada nos testes Flutter: Flutter 3.44.9 e Dart 3.12.2.

## Decisões preservadas

- preço continua exclusivamente server-side;
- foto continua opcional até `DEC-01`;
- `notes` legado não será removido nesta versão;
- cloud Render/Vercel/Firebase continua somente estruturada;
- pagamentos, PIX, SMS e rotas multi-pedido permanecem fora desta entrega.

## Próxima retomada

1. aplicar e reverter a migration em banco de teste, reaplicar e executar o smoke vivo;
2. concluir `B2C-01B` no dashboard com filtros/relatórios por cliente, tipo, tamanho e peso;
3. aplicar a identidade laranja ao dashboard;
4. gerar APKs dos dois apps e fazer QA visual/funcional em emulador ou dispositivo online;
5. decidir `DEC-01` antes de tornar foto obrigatória.
