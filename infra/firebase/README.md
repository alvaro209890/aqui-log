# Firebase — estrutura apenas (sem projeto vinculado)

Este diretório descreve o alvo de produção. **Nada aqui está conectado**
ao app em runtime até `FIREBASE_ENABLED=true` e credenciais reais.

## Serviços previstos

| Serviço | Uso no Aqui Log |
| --- | --- |
| **Firebase Storage** | Comprovantes e documentos (substituir adapter local) |
| **FCM** | Push para apps (tokens já em `device_tokens`) |
| **Firestore** (opcional) | Avaliar migração parcial de dados se Postgres sair do Render |
| **Firebase Auth** (opcional) | Alternativa futura ao JWT próprio — **não planejado no piloto** |

## Runtime atual vs alvo

- **Hoje (local / piloto):** PostgreSQL + Redis + storage filesystem
- **Alvo cloud (decisão Álvaro):** Backend **Render**, front **Vercel**,
  storage/push (**e eventualmente dados**) **Firebase**

A API Nest continua a fonte de verdade de negócio. Firebase entra como
storage/push primeiro; migração de Postgres → Firestore **não está feita**.

## Arquivos

- `README.md` (este)
- `storage.rules.example` — regras Storage
- `firestore.rules.example` — se Firestore for usado
- `.firebaserc.example` — project alias placeholder
- `firebase.json.example` — config CLI placeholder

## Como o próximo agente liga (checklist)

1. Criar projeto Firebase (console).
2. Gerar service account JSON (Render secret, **nunca no git**).
3. Habilitar Storage + FCM.
4. Setar env: `FIREBASE_ENABLED=true`, `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (ou path/JSON base64).
5. Implementar `FirebaseStorageAdapter` real em
   `apps/backend/src/firebase/` (stub já existe).
6. Implementar envio FCM lendo `device_tokens`.
7. Manter interface `StorageService` / presign compatível com mobile.
