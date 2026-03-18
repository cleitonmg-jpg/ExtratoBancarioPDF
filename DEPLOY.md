# Deploy no Coolify — extrato.v9informatica.cloud

## Visão Geral

| Item | Valor |
|------|-------|
| URL de produção | `https://extrato.v9informatica.cloud` |
| Plataforma | Coolify (self-hosted) |
| Banco de dados | PostgreSQL 16 |
| Runtime | Node.js |
| Porta da aplicação | 5000 |
| Build command | `npm run build` |
| Start command | `node dist/index.cjs` |

---

## 1. Pré-requisitos

- Servidor com Coolify instalado e acessível
- Domínio `v9informatica.cloud` com acesso ao painel DNS
- Repositório git conectado ao Coolify (GitHub, GitLab ou Gitea)

---

## 2. Criar o Banco PostgreSQL no Coolify

1. No painel Coolify → **New Resource → Database → PostgreSQL 16**
2. Defina um nome, ex: `extratoai-db`
3. Coolify vai gerar automaticamente:
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DB`
   - `DATABASE_URL` (connection string completa)
4. **Copie a `DATABASE_URL`** exibida na tela — você vai precisar dela no passo 4

> Formato da URL gerada pelo Coolify:
> `postgres://USUARIO:SENHA@nome-do-servico:5432/NOME_DO_BANCO`

---

## 3. Criar o Serviço da Aplicação no Coolify

1. **New Resource → Application**
2. Conecte ao repositório git do projeto
3. Coolify vai detectar automaticamente que é Node.js

Configure os campos:

| Campo | Valor |
|-------|-------|
| **Build Command** | `npm run build` |
| **Start Command** | `node dist/index.cjs` |
| **Port** | `5000` |
| **Base Directory** | `/` (raiz do projeto) |

---

## 4. Configurar as Variáveis de Ambiente

Na aba **Environment Variables** do serviço da aplicação, adicione:

```env
# Servidor
PORT=5000
HOST=0.0.0.0

# Banco de dados
DB_TYPE=postgres
DATABASE_URL=postgres://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO

# Sessão (gere um valor aleatório forte)
SESSION_SECRET=TROQUE_POR_UMA_SENHA_FORTE_ALEATORIA

# OpenAI (escolha uma das opções abaixo)
OPENAI_API_KEY=sk-...
# OPENAI_BASE_URL=https://...  (opcional, se usar proxy)
```

> **IMPORTANTE:** Cole a `DATABASE_URL` copiada no passo 2.
> Não use os valores de exemplo acima literalmente.

### Como gerar um SESSION_SECRET seguro

Execute localmente ou no terminal do servidor:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. Configurar o Domínio

1. Na aba **Domains** do serviço → adicione:
   ```
   https://extrato.v9informatica.cloud
   ```
2. Coolify configura HTTPS (Let's Encrypt) automaticamente

### Configuração DNS

No painel DNS do domínio `v9informatica.cloud`, crie um registro:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| `A` | `extrato` | `IP_DO_SEU_SERVIDOR` | 300 |

> Substitua `IP_DO_SEU_SERVIDOR` pelo IP público do seu servidor Coolify.

---

## 6. Inicializar o Banco de Dados (Migrations)

Após o primeiro deploy, execute o comando de migração para criar as tabelas:

### Opção A — pelo terminal do Coolify

No painel do serviço → aba **Terminal** (ou via SSH no servidor):
```bash
npm run db:push
```

### Opção B — localmente apontando para o banco remoto

No seu `.env` local, troque temporariamente a `DATABASE_URL` pela URL do banco do Coolify e execute:
```bash
npm run db:push
```

---

## 7. Checklist de Deploy

- [ ] Banco PostgreSQL criado no Coolify
- [ ] Variável `DATABASE_URL` configurada no serviço
- [ ] Variável `DB_TYPE=postgres` configurada
- [ ] `SESSION_SECRET` com valor forte e único
- [ ] `OPENAI_API_KEY` configurada
- [ ] `HOST=0.0.0.0` e `PORT=5000` configurados
- [ ] Domínio `extrato.v9informatica.cloud` adicionado no Coolify
- [ ] Registro DNS tipo `A` criado apontando para o IP do servidor
- [ ] Build e deploy executados com sucesso
- [ ] `npm run db:push` executado (cria as tabelas no banco)
- [ ] Acesso via `https://extrato.v9informatica.cloud` funcionando

---

## 8. Variáveis Resumidas (template para copiar no Coolify)

```
PORT=5000
HOST=0.0.0.0
DB_TYPE=postgres
DATABASE_URL=<colar a URL gerada pelo Coolify>
SESSION_SECRET=<gerar valor aleatório>
OPENAI_API_KEY=<sua chave OpenAI>
```

---

## 9. Observações Importantes

- O arquivo `.env` é **apenas para desenvolvimento local** e está no `.gitignore` — nunca sobe para o git
- No Coolify, todas as variáveis são gerenciadas pelo painel, não pelo `.env`
- O Coolify reinicia automaticamente o container se a aplicação cair
- Os dados do PostgreSQL ficam persistidos em volume Docker gerenciado pelo Coolify
- Para ver logs em tempo real: painel do serviço → aba **Logs**
