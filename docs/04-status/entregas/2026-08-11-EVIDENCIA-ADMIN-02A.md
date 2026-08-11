# Evidência — `ADMIN-02A`: fila de aprovação de entregadores no painel

> **Data:** 2026-08-11
> **Agente:** Claude (Opus 5)
> **Ambiente:** PC `acer`; runtime de distribuição no ar
> (`https://aquilog-api.cursar.space/api/v1` + `https://aquilog.cursar.space`),
> Node v22.22.2, Postgres 17 / Redis 7 em Docker
> **Base:** `main` @ `49deec0`
> **Escopo:** somente `ADMIN-02A` — fatia urgente do `ADMIN-02`
> (`PLANO_ADMIN` §2.3: "aprovar/rejeitar cadastro")

---

## 0. Resumo

| Item | Resultado |
| --- | --- |
| Fila de aprovação no painel | ✅ entregue |
| Identidade do candidato no payload | ✅ nome e e-mail passaram a vir de `users` |
| Filtro por status + contador da fila | ✅ `?status=` e `GET /couriers/pending-count` |
| Confirmação individual com resumo | ✅ (aprovação em lote continua proibida) |
| Efeito real da aprovação | ✅ medido e documentado (§4) |
| QA de navegador **logado** | ❌ **NÃO EXECUTADO** — ver §6 |

---

## 1. O problema real (o backlog subestimou)

O backlog dizia "rota já existe; é só tela". A rota existia e a página até já
tinha os botões **Aprovar/Recusar** — mas a fila era inutilizável por três
motivos, todos confirmados contra a API viva antes de mexer no código:

### 1.1 O painel não sabia quem era o candidato

`GET /couriers` devolvia apenas as colunas de `couriers`. Era isto que a tela
recebia:

```json
{
  "id": "67e23e78-…", "userId": "d5eb025f-…", "document": "01786419269",
  "vehicleType": "MOTORCYCLE", "vehiclePlate": "AQL2T34", "status": "ACTIVE"
}
```

Sem **nome** e sem **e-mail**: o operador aprovava um UUID. E aprovar cadastro é
decisão de revisão humana — o `PLANO_ADMIN` §7 proíbe explicitamente "aprovação
em lote de cadastros sem revisão individual (documentos exigem olho humano)".
Não dá para revisar quem não se consegue identificar.

### 1.2 Não havia fila

A lista era de **todos** os entregadores, ordenada por `createdAt DESC` e
paginada em 20. No banco havia **87 registros** no momento da checagem. Um
cadastro novo entra no topo hoje e afunda amanhã; nada sinalizava que alguém
estava esperando.

### 1.3 A tela ignorava o que já tinha

`documentUrls` e `createdAt` **já vinham** no payload e a tabela não mostrava
nenhum dos dois — nem os documentos enviados, nem há quanto tempo o cadastro
espera.

---

## 2. O que foi feito

### Backend (`apps/backend/src/couriers/`)

- `findAll(page, limit, status?)` reescrito com query builder e **junção
  explícita com `users`** (a entidade `Courier` não declara relação), somando
  `name` e `email` ao payload. Paginação e o formato de retorno anteriores
  preservados — a lista sem paginação continua devolvendo array.
- Filtro `?status=` aceitando qualquer `AccountStatus`, em qualquer caixa.
  **Status inválido é ignorado** em vez de virar erro do Postgres: um enum
  inexistente no `WHERE` derrubaria a página do painel com 500 e a tela ficaria
  vazia sem explicação.
- `GET /couriers/pending-count` — o número da fila. Declarado **antes** das
  rotas `:id/...` para não ser capturado como um id.
- Nada de novo em `approve`/`reject`/`suspend`: já gravavam auditoria e
  notificação. Não foram tocados.

### Painel (`apps/dashboard/`)

- **Seção "Fila de aprovação"** no topo da página de Entregadores, carregada
  separada da lista geral (`status=PENDING`), em cartões — não linha de tabela,
  porque nome, e-mail, CPF, veículo, placa, tempo de espera e documentos
  precisam caber lado a lado sem o operador abrir nada.
- **Documentos enviados** viram links abríveis; sem documento, a tela diz
  "Nenhum documento enviado" em vez de ficar em branco.
- **Tempo de espera** ("há 3 h", "há 2 dias") ao lado da data do cadastro.
- **Contador** no cabeçalho da página ("2 aguardando aprovação").
- **Confirmação individual** antes de aprovar ou recusar, repetindo o resumo do
  cadastro e o que a ação provoca. É o oposto de aprovação em lote.
- **Lista completa** ganhou filtro por status e as colunas de identidade
  (nome + e-mail, CPF formatado, data de cadastro).
- **Estados** de loading, vazio (distinguindo "nenhum cadastro" de "nenhum com
  esse filtro") e **erro com botão de tentar de novo** — antes o erro só virava
  um toast e a tabela ficava vazia sem explicação.
- CSS novo só com tokens; nenhum hexadecimal de marca fora de `styles.css`
  (regra do `UX-01C`).

---

## 3. Verificação contra a API viva

```
$ curl "$API/couriers?page=1&limit=2" -H "Bearer <admin>"
{ "id": "67e23e78-…", "name": "Entregador Anel 2",
  "email": "entregador2.1786419268@aquilog.test",
  "document": "01786419269", "vehicleType": "MOTORCYCLE",
  "vehiclePlate": "AQL2T34", "status": "ACTIVE",
  "createdAt": "2026-08-11T03:34:43.068Z",
  "documentUrls": ["https://example.com/documento-teste.pdf"] }

$ curl "$API/couriers/pending-count"            → {"pending":2}
$ curl "$API/couriers?status=PENDING&limit=10"  → os 2, com nome e e-mail
$ curl "$API/couriers?status=BANANA&limit=2"    → {"total":87}  (ignora o filtro)
```

Dois cadastros pendentes foram criados de propósito para exercitar os dois
caminhos da tela: **Motoboy Fila 1** (moto, com placa e um documento enviado) e
**Motoboy Fila 2** (bicicleta, sem placa e sem documento). Eles **continuam
pendentes no banco** — quem for fazer o QA logado (§6) encontra a fila montada.

O `pnpm smoke` roda logo depois e **não polui a fila**: os entregadores do smoke
são aprovados durante a própria execução. Conferido: `pending` continuou 2
depois do smoke.

---

## 4. O que a aprovação faz de verdade (critério 4)

Medido com um terceiro cadastro, criado só para isso:

```
ANTES  do approve: {"status":"PENDING","available":false,"lastLatitude":null}
PATCH /couriers/<id>/approve → 200
DEPOIS do approve: {"status":"ACTIVE", "available":false,"lastLatitude":null}

login do motoboy → 200
PATCH /couriers/me/availability {"available":true} → {"status":"ACTIVE","available":true}

GET /audit → {"action":"COURIER_APPROVED","resourceType":"courier","resourceId":"6576b798-…"}
```

**Aprovar é necessário, mas não é suficiente para receber oferta.** O `approve`
muda o status e libera o login; `available` continua `false` e a posição
continua `null` até o entregador **abrir o app e ficar online** — é o app que
manda disponibilidade e localização, e o despacho precisa das duas. Isso é
comportamento correto (quem decide quando trabalhar é ele), mas era fácil o
operador aprovar e achar que colocou alguém na rua. Por isso a confirmação da
tela diz, com essas palavras: *"aprovar não coloca ninguém na rua"*.

A aprovação também gera **notificação** ao entregador ("Cadastro aprovado") e
entra na **auditoria** — os dois já existiam no serviço e continuam.

---

## 5. Comandos e contagens

| Comando | Antes | Depois |
| --- | --- | --- |
| `pnpm --filter backend test` | 25 suítes / 219 testes | ✅ **26 suítes / 224 testes** |
| `pnpm build` | ✅ | ✅ |
| `pnpm lint` | ✅ | ✅ (0 erros, 0 avisos) |
| `pnpm smoke` (domínio público) | ✅ | ✅ `AQL-MSO4RLTG0WI` + agendado `AQL-MSO4RPYEZNH` + reoferta `2c31bf7a-…` |

Teste novo: `apps/backend/src/couriers/courier-queue.contract.spec.ts` (5 casos)
— trava o contrato de que a tela depende: nome e e-mail no payload, campos de
revisão preservados (documento, veículo, placa, `documentUrls`, `createdAt`),
entregador sem usuário correspondente não quebra a lista, e o filtro de status
aceita os válidos e ignora o inválido.

Flutter/Dart **não executados**: nenhum arquivo Dart foi tocado nesta rodada.

---

## 6. QA de navegador — parcial, com o principal **NÃO EXECUTADO**

Feito, sem credencial:

- a página pública carrega e o React monta (`Aqui Log | Operacoes`, tela de
  login renderizada) em Chrome real, pelo domínio;
- o **bundle publicado** contém a fila nova — `Fila de aprovação`,
  `aguardando aprovação`, `Nenhum cadastro aguardando aprovação`,
  `pending-count`, `Aprovar entregador?`, `Recusar cadastro?` (1 ocorrência
  cada);
- o **CSS publicado** contém `approval-queue`, `approval-card`,
  `approval-facts` e `modal-summary`.

**Não executado — e é a parte que importa:** ver a fila renderizada logada,
aprovar pela tela e conferir a mudança de status no navegador. O painel exige
login de admin, e digitar senha em formulário está fora do que este agente faz.
O Álvaro optou por fechar a tarefa sem esse passo.

**Como completar (5 minutos):** abrir <https://aquilog.cursar.space>, entrar com
o admin, ir em *Entregadores* e conferir:

1. o cabeçalho mostra "2 aguardando aprovação";
2. a fila traz **Motoboy Fila 1** (moto, placa `FIL1A23`, 1 documento com link)
   e **Motoboy Fila 2** (bicicleta, sem placa, "Nenhum documento enviado");
3. os dois mostram CPF formatado e "há … " de espera;
4. **Aprovar** abre a confirmação com o resumo → confirmar → toast de sucesso,
   o cartão sai da fila e o contador cai para 1;
5. o filtro *Status → Ativos* mostra o aprovado com `ACTIVE`;
6. **Recusar** no que sobrou → status `REJECTED`, fila vazia com
   "Nenhum cadastro aguardando aprovação".

Registrado como pendência em `01-ESTADO-ATUAL.md` §4.

---

## 7. Limitações e o que **não** foi feito

- **Recusa sem motivo.** O `PLANO_ADMIN` §2.3 pede "motivo ao rejeitar", mas
  `PATCH /couriers/:id/reject` **não aceita motivo** hoje e a auditoria grava só
  o status. Adicionar o campo mexeria em DTO, serviço e auditoria — é
  `ADMIN-02`, não esta fatia. A tela **não finge**: não pede um motivo que o
  servidor descartaria.
- **Suspender/reativar** continuam como estavam, na lista completa, sem
  confirmação — não foram tocados (fora do escopo).
- **Sem paginação na fila**: ela busca até 50 pendentes. Acima disso o operador
  precisa do filtro da lista completa. Com a base atual (2 pendentes de 87
  cadastros) não é problema; vira um se a operação crescer.
- **Sem visualização embutida dos documentos** — os links abrem em aba nova. O
  visualizador é `ADMIN-02`.
- **Sem tempo real**: a fila atualiza ao carregar a página e depois de cada
  ação. Não há push de "novo cadastro chegou".
- **LGPD:** CPF e e-mail aparecem para papéis administrativos, que é onde a rota
  já estava travada (`SUPER_ADMIN`/`ADMIN`). Nada foi afrouxado; nenhum dado
  pessoal novo passou a ser exposto a papéis que não o tinham.
- Fora de escopo por instrução: `ADMIN-02` completo, `COUR-02`, `PAY-02`,
  `B2C-03`, `DISP-03`, cloud e rebuild de APK.
