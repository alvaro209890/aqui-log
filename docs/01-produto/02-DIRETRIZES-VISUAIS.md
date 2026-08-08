# Aqui Log — Diretrizes visuais e tema de cores

> **Status:** identidade implementada nas TRÊS interfaces — mobile em 2026-08-07,
> dashboard em 2026-08-08 (`UX-01C`); QA visual em dispositivo ainda pendente
> **Referência visual:** [AquiResolve](https://github.com/alvaro209890/AquiResolve)
> **Escopo futuro:** dashboard React, app do cliente, app do motoboy e pacote compartilhado `aqui_log_ui`

## 1. Decisão de identidade

O tema geral do Aqui Log deverá seguir uma linguagem visual **próxima à do AquiResolve**, com o **laranja como cor principal da marca**. A referência deve orientar a sensação de produto, a hierarquia visual e a família de cores, sem exigir uma cópia literal de cada tela ou componente.

O laranja deverá identificar principalmente:

- ações primárias e botões de maior importância;
- item ativo de navegação, links e estados de foco;
- elementos de marca, destaques e indicadores selecionados;
- dados principais de gráficos, quando não representarem um estado semântico;
- detalhes visuais que hoje usam verde/menta apenas como cor de marca.

O fundo geral deve permanecer claro e neutro, com cards brancos, texto em cinza-azulado escuro e bordas discretas. O resultado esperado é uma interface acolhedora, urbana, moderna e funcional.

## 2. Paleta de referência

A base abaixo foi extraída dos temas públicos do AquiResolve e deve orientar a futura consolidação dos tokens do Aqui Log.

| Papel | Claro | Escuro | Uso esperado |
| --- | --- | --- | --- |
| Laranja principal | `#F97316` | `#FB923C` | Marca, CTA, seleção e foco |
| Laranja principal no app de referência | `#FF7A00` | — | Referência complementar da identidade mobile |
| Laranja pressionado/hover | `#EA580C` | `#F97316` | Hover, pressed e ênfase forte |
| Laranja suave | `#FFF7ED` | `#1F1208` | Fundo de item ativo, chips e destaques leves |
| Texto sobre laranja | `#FFFFFF` | `#FFFFFF` | Conteúdo sobre a cor principal |
| Fundo da aplicação | `#F9FAFB` | `#0A0B0D` | Superfície mais externa |
| Card/superfície | `#FFFFFF` | `#181A1E` | Cards, modais e painéis |
| Texto principal | `#111827` | `#E5E7EB` | Títulos e conteúdo principal |
| Texto secundário | `#6B7280` | `#9CA3AF` | Descrições, metadados e placeholders |
| Borda | `#E5E7EB` | `#2A2D33` | Divisores, inputs e contornos |
| Sucesso | `#10B981` | `#34D399` | Confirmações e estados positivos |
| Alerta | `#F59E0B` | `#FBBF24` | Atenção e pendências |
| Erro | `#EF4444` | `#EF4444` | Falha, cancelamento e ação destrutiva |
| Informação | `#3B82F6` | `#60A5FA` | Informação neutra e acompanhamento |

Para unificar as três interfaces do Aqui Log, a implementação futura deverá adotar `#F97316` como **laranja principal canônico**. O `#FF7A00` pode servir como referência de proximidade com o app do AquiResolve, mas não deve originar um segundo sistema de marca paralelo.

## 3. Regras de aplicação

1. **Laranja é marca, não status.** Entrega concluída continua verde; cancelamento/erro continua vermelho; alerta continua âmbar; informação e rastreamento podem usar azul.
2. **Não pintar tudo de laranja.** A cor deve criar hierarquia sobre bases neutras. Áreas grandes devem priorizar fundos claros/escuros e superfícies legíveis.
3. **Centralizar em tokens semânticos.** Evitar novos hexadecimais soltos nas telas. Dashboard e Flutter devem consumir equivalentes de `primary`, `primaryHover`, `primaryLight`, `surface`, `textPrimary`, `textSecondary`, `border`, `success`, `warning`, `error` e `info`.
4. **Preservar contraste e acessibilidade.** Texto sobre o laranja principal deve ser branco quando atingir contraste adequado; textos longos não devem usar laranja claro. Estados de foco não podem depender apenas de mudança sutil de cor.
5. **Manter consistência entre produtos.** App do cliente, app do motoboy e dashboard pertencem à mesma marca, embora possam variar densidade, navegação e componentes conforme a plataforma.
6. **Mapas e gráficos mantêm semântica.** O laranja identifica a série principal ou uma entrega ativa; outras séries e estados usam a paleta semântica para continuar distinguíveis.
7. **Modo escuro é derivado, não invertido automaticamente.** Se implementado, deve usar os tokens escuros da tabela e conservar o laranja como identidade.

## 4. Direção por superfície

### App do cliente

- CTA de pedir entrega, seleção de tipo/tamanho e navegação ativa em laranja.
- Cards e formulários em superfícies neutras, com destaques suaves em `#FFF7ED`.
- Progresso da entrega usa cores de estado; o laranja representa a etapa ativa quando não houver significado de sucesso/erro.

### App do motoboy

- Disponibilidade, oferta ativa e ação de aceitar devem ter hierarquia clara; sucesso operacional permanece verde.
- Ganhos, carteira e status não devem ser todos convertidos para laranja se a cor já tiver significado próprio.
- Elementos sobre o mapa precisam manter contraste independentemente dos tiles.

### Dashboard administrativo

- Navegação ativa, botões primários, links, foco e série principal dos gráficos em laranja.
- Sidebar pode ser clara como no painel AquiResolve ou escura/neutra, desde que o destaque ativo seja laranja e não verde-floresta.
- Tabelas, filtros e cards devem continuar predominantemente neutros para preservar densidade e leitura.

## 5. Estado atual

Em 2026-08-07, a identidade mobile passou a usar os tokens canônicos deste documento:

- `packages/aqui_log_ui/lib/src/theme.dart`: `primary #F97316`, `primaryHover #EA580C`, `primaryDark #C2410C` e `primarySoft #FFF7ED`;
- app cliente e app motoboy consomem a marca laranja em CTA, navegação, cards de destaque e elementos de mapa;
- `StatusPill` preserva verde para sucesso, vermelho para erro/cancelamento, âmbar para pendência e azul para trânsito/informação;
- testes do pacote compartilhado validam a cor primária, rótulos pt-BR e cores semânticas;
- os antigos tokens `#123A31`, `#0D2A24` e `#62D6A9` foram removidos do código mobile.

Em 2026-08-08 (`UX-01C`) o dashboard fechou o ciclo:

- `apps/dashboard/src/styles.css` ganhou uma camada de tokens em `:root` e é a
  **fonte única** de cor de marca do painel; o verde/menta saiu por completo,
  incluindo os neutros que eram tingidos de verde;
- `apps/dashboard/src/theme.ts` leva os tokens para Recharts e Leaflet exportando
  **nome** de token (`var(--...)`), nunca valor — zero hexadecimal fora do tema;
- a sidebar passou a ser escura **neutra**, com o destaque ativo em laranja.

**Dois laranjas, um só sistema de marca.** Branco sobre o `#F97316` canônico dá
2,8:1 e reprova no AA. Por isso `--color-primary` (`#F97316`) vale para acentos,
ícones e séries de gráfico, e `--color-primary-strong` (`#C54B07`, 4,8:1 sobre
branco) carrega botões, links e texto laranja. Escurecer mais começa a ler como
vermelho — foi testado e revertido.

Permanece pendente:

- QA visual real em dispositivo/emulador para os **apps** (`UX-02`), pois o AVD
  disponível continua indisponível;
- modo escuro do dashboard, que a regra 7 trata como opcional.

## 6. Critérios para concluir a implementação

Quando a mudança visual for autorizada, considerar concluída somente após:

- substituir a identidade verde/menta de marca por tokens laranja no dashboard, completando as três interfaces;
- preservar as cores semânticas de sucesso, alerta, erro e informação;
- remover ou justificar cores de marca literais fora dos arquivos de tema;
- validar contraste de texto, foco de teclado e estados disabled/hover/pressed;
- revisar visualmente login, navegação, formulários, cards, tabelas, mapas, gráficos e principais fluxos B2C;
- executar build, análise/testes e validação visual real em tamanhos de tela representativos.

## 7. Fora do escopo desta entrega mobile

- alterar CSS, componentes ou gráficos do dashboard;
- copiar logotipo, nome, ilustrações ou componentes proprietários do AquiResolve;
- redesenhar fluxos funcionais ou mudar regras de negócio;
- definir uma nova tipografia ou iconografia sem uma etapa própria de design.
