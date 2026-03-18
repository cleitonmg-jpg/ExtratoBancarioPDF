# ExtratoAI (V9 Informática)

App full-stack (React/Vite + Express) para extrair transações de extratos bancários em PDF e organizar em histórico por conta.

## Rodar no localhost

### 1) Instalar dependências
```bash
npm install
```
Se o PowerShell bloquear `npm` (ExecutionPolicy), use `npm.cmd install` ou rode o atalho `dev-windows.cmd` / `dev-windows.ps1`.

### 2) Configurar variáveis de ambiente
Crie um arquivo `.env` a partir do `.env.example`.

- Sem Postgres: rode sem `DATABASE_URL` (modo em memória, sem persistência).
- Com Postgres (recomendado): suba o banco e aplique o schema:
  ```bash
  docker compose up -d
  npm run db:push
  ```

### 3) Subir a aplicação
```bash
npm run dev
```
Se necessário, use `npm.cmd run dev`.

Acesse: `http://localhost:5000`

Login padrão (criado no primeiro boot): `master` / `master`

## Observações
- Para processar PDFs via IA, configure `OPENAI_API_KEY` (ou `AI_INTEGRATIONS_OPENAI_API_KEY` no Replit).
- Para expor na rede local, use `HOST=0.0.0.0` no `.env`.

## Windows (atalhos)
- CMD: `dev-windows.cmd`
- PowerShell (sem mexer no ExecutionPolicy global): `powershell -ExecutionPolicy Bypass -File .\\dev-windows.ps1 -Port 5000 -Host 127.0.0.1`
