# Runbook do Álvaro — o que só você pode fazer

> **Agentes escrevem aqui; agentes nunca executam daqui.** Se você é um agente e
> travou, adicione um item novo seguindo o modelo do final e **volte a trabalhar
> em outra tarefa** ([`00-COMO-USAR.md`](00-COMO-USAR.md) §5).
>
> **Álvaro:** cada item abaixo destrava uma ou mais tarefas. Nada aqui tem pressa
> por si só — a fila continua andando sem você. Faça na ordem que fizer sentido
> para o negócio; a coluna "destrava" diz o que volta a se mexer.

## Painel de situação

| # | Item | Custo | Destrava | Estado |
| ---: | --- | --- | --- | --- |
| 1 | Conta Pagar.me do Aqui Log | grátis abrir | `PAY-02`, `COUR-06` (saque) | ⬜ aberto |
| 2 | Projeto Firebase do Aqui Log | grátis no início | `OPS-02`, `OPS-DB-01` | ⬜ aberto |
| 3 | Conta Render | grátis / ~US$ 7 mês | `OPS-03` | ⬜ aberto |
| 4 | Conta Vercel | grátis | `OPS-03` | ⬜ aberto |
| 5 | MacBook + Apple Developer | US$ 99/ano | `IOS-03` | ⏳ Mac pedido |
| 6 | Google Play Console | US$ 25 uma vez | publicação Android | ⬜ aberto |
| 7 | CNPJ e enquadramento fiscal | varia | cobrança real | ⬜ aberto |
| 8 | Provedor de SMS/WhatsApp | varia | metade do `SUP-05` | ⬜ aberto |
| 9 | Confirmar decisões provisórias | grátis | nada (já estão adotadas) | ⬜ aberto |

---

## 1. Conta Pagar.me do Aqui Log

**Por que só você:** exige CNPJ, dados bancários e aceite de contrato.

⚠️ **Não dá para reusar a conta do AquiResolve.** São produtos diferentes, com
faturamento e conciliação separados; misturar transforma o extrato dos dois em
lixo e complica o fiscal.

1. Abrir conta em `dashboard.pagar.me` com o CNPJ do Aqui Log.
2. Pegar a **chave secreta** (`sk_...`). Comece pela de **teste** — o agente
   consegue provar o fluxo inteiro no sandbox antes de tocar em dinheiro real.
3. Cadastrar a URL do webhook:
   `https://aquilog-api.cursar.space/api/v1/payments/webhook`
4. Copiar o **secret do webhook** que a Pagar.me gera nessa tela. É ele que
   valida a assinatura HMAC-SHA256 — sem ele, qualquer um credita saldo fingindo
   ser a Pagar.me.
5. Colar as duas coisas em `~/.config/aqui-log/env` (**fora do repositório**):

   ```bash
   PAGARME_SECRET_KEY=sk_test_...
   PAGARME_WEBHOOK_SECRET=...
   ```

6. `systemctl --user restart aqui-log-api`
7. Avisar o próximo agente: "Pagar.me está configurada, pode fechar `PAY-02`".

**Destrava:** `PAY-02` (o cliente passa a conseguir pôr saldo sozinho — hoje só um
admin creditando à mão) e, depois dele, `COUR-06` (o motoboy saca).

---

## 2. Projeto Firebase do Aqui Log

**Por que só você:** exige conta Google e aceite de termos.

⚠️ **Não reusar o projeto Firebase do AquiResolve.**

1. `console.firebase.google.com` → criar projeto `aqui-log`.
2. Ativar **Firestore**, **Storage** e **Cloud Messaging (FCM)**.
3. Configurações → Contas de serviço → **Gerar nova chave privada** (baixa um JSON).
4. Salvar o JSON em `~/.config/aqui-log/firebase-service-account.json`
   (**fora do repositório**) e apontar em `~/.config/aqui-log/env`:

   ```bash
   FIREBASE_ENABLED=true
   GOOGLE_APPLICATION_CREDENTIALS=/home/acer/.config/aqui-log/firebase-service-account.json
   ```

5. `systemctl --user restart aqui-log-api`

**Destrava:** `OPS-02` (documento e prova saem do disco local; push nativo passa a
existir) e, depois, `OPS-DB-01`.

---

## 3 e 4. Render e Vercel

**Por que só você:** exige login, conexão com o GitHub e, no Render, cartão.

**Render (API):**
1. `render.com` → New → Web Service → conectar `github.com/alvaro209890/aqui-log`.
2. Root: `apps/backend`. Build: `pnpm install && pnpm --filter backend build`.
   Start: `pnpm --filter backend start:prod`.
3. Copiar as variáveis do `~/.config/aqui-log/env` para o painel do Render.

**Vercel (painel):**
1. `vercel.com` → Import → mesmo repositório.
2. Root directory: `apps/dashboard`.
3. ⚠️ Definir **`VITE_API_URL`** com a URL da API do Render. Sem isso o painel
   publica apontando para `localhost` e parece quebrado sem dar erro — já
   aconteceu aqui.

**Destrava:** `OPS-03`.

> Isto é **evolução posterior**, não urgência: pela `DEC-26` a distribuição
> inicial é o runtime deste PC via Cloudflare Tunnel, que está no ar desde
> 2026-08-11 e funciona.

---

## 5. MacBook e conta Apple Developer

**Estado:** ⏳ **MacBook já pedido** (2026-08-19). Registrado na `DEC-27`.

Quando chegar:
1. Instalar Xcode e Flutter no Mac.
2. Assinar o Apple Developer Program (US$ 99/ano).
3. Clonar o repo e rodar o workflow que o `IOS-02` deixou pronto.
4. Certificado + provisioning profile dos dois bundle ids:
   `br.com.aquilog.aquiLogCliente` e `br.com.aquilog.aquiLogEntregador`.

**Destrava:** `IOS-03`. Nada mais depende disso — a onda 9 é a última de propósito.

---

## 6. Google Play Console

1. `play.google.com/console` → conta de desenvolvedor (US$ 25, pagamento único).
2. Criar os dois apps (cliente e entregador).
3. **Política de privacidade em URL pública** — é obrigatória, e os dois apps
   pedem câmera e localização. Pode ser uma página no domínio `cursar.space`.
4. Preencher o formulário de segurança de dados declarando o que os apps coletam:
   localização, fotos, telefone.
5. Subir os APKs de `dist/` (ou gerar AAB, que a Play prefere).

**Destrava:** distribuição pública Android. Hoje o APK é instalado à mão.

---

## 7. CNPJ e enquadramento fiscal

Só vira obrigatório quando o dinheiro for real (`PAY-02` em produção). Envolve
emissão de nota, tratamento do repasse ao motoboy e o vínculo dele. **Converse
com contador antes de ligar a cobrança de verdade** — isto não é decisão de
agente nem de programador.

**Destrava:** operação comercial.

---

## 8. Provedor de SMS / WhatsApp

A `DEC-04` decidiu que a verificação de telefone é por **código no app**, sem
SMS — então isto **não bloqueia o produto**. Só a metade externa do `SUP-05`
(fallback de comunicação fora do app) depende.

---

## 9. Confirmar as decisões provisórias

Nada aqui está travado: os agentes adotaram um valor e seguiram, e **tudo é
editável no painel sem deploy**. Confirme quando tiver dados reais de operação.

| Origem | Adotado | Onde muda |
| --- | --- | --- |
| `DEC-02` | preços, multas e cutoffs provisórios | painel → configurações |
| `DEC-13` | estorno automático até R$ 30, só do frete | painel (`ADMIN-07`) |
| `DEC-15` | longa distância: 15 km, +20% | painel (`ADMIN-07`) |
| `DEC-16` | juiz rápido até R$ 25; acumulado R$ 100/30 d | painel (`ADMIN-07`) |
| `ADMIN-DEC-01` | gate 🔒 por reautenticação simples (sem OTP) | configuração |
| `ADMIN-DEC-02` | `SUPER_ADMIN` só você | dado |
| `ADMIN-DEC-03` | `audit_logs` por 2 anos | job |
| `PAY-DEC-03` | recarga mínima R$ 10, saldo máximo R$ 500 | painel |
| `PAY-DEC-05` | plataforma absorve a taxa do gateway | painel |

---

## Modelo para o agente acrescentar item

```markdown
## N. <título curto>

**Descoberto em:** <ID da tarefa>, <data>
**Por que só o Álvaro:** <credencial / conta / dinheiro / decisão de negócio>

1. <passo>
2. <passo — diga exatamente o que colar e em qual arquivo>

**Destrava:** `<ID>`
```

Regras de quem escreve aqui: um item por bloqueio, sem repetir item existente,
sempre com o passo concreto (não "configurar a integração"), e **nunca** com
segredo escrito dentro.
