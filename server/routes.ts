import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin, getCompanyId, hashPassword } from "./auth";
import { api } from "@shared/routes";
import multer from "multer";

type StatementRow = { date: string; description: string; amount: number; type: string };
type ParsedStatement = { bankName: string; accountNumber: string; agency: string; companyName: string; rows: StatementRow[] };

function parseSicoob(text: string): ParsedStatement {
  // Extrai ano do período (ex: "Periodo: 01/12/2025 - 31/12/2025")
  const periodMatch = text.match(/Per[ií]odo:\s*\d{2}\/\d{2}\/(\d{4})/i);
  const year = periodMatch ? periodMatch[1] : String(new Date().getFullYear());

  // Conta e empresa: "Conta: 11.507-0 / GRAFITE INDUSTRIA..."
  const contaMatch = text.match(/Conta:\s*([\d.\-\/]+)\s*\/\s*(.+)/i);
  const accountNumber = contaMatch ? contaMatch[1].trim() : "";
  const companyName = contaMatch ? contaMatch[2].trim() : "";

  // Cooperativa/Agência: "Cooperativa: 4030-4 / SICOOB DIVICRED"
  const agencyMatch = text.match(/Cooperativa:\s*([\d\-]+)/i);
  const agency = agencyMatch ? agencyMatch[1].trim() : "";

  const rows: StatementRow[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);

  // Linha de data Sicoob: começa com DD/MM seguido de espaço
  const dateLineRe = /^(\d{2}\/\d{2})\s+/;
  // Valor Sicoob: R$ 1.234,56C ou R$ 1.234,56D
  const amountRe = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})([DC])/;
  const skipRe = /^SALDO DO DIA|^SALDO ANTERIOR|^SALDO BLOQUEADO|^RESUMO|^HISTÓRICO/i;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(dateLineRe);

    if (!dateMatch) { i++; continue; }

    const date = `${dateMatch[1]}/${year}`;
    // Descrição começa após DD/MM (resto da linha, sem o doc number no meio se houver)
    let description = line.replace(dateLineRe, "").trim();

    // Procura o valor nas próximas linhas até encontrar ou chegar em nova data
    let amountMatch = line.match(amountRe);
    let j = i + 1;

    while (!amountMatch && j < lines.length) {
      const next = lines[j];
      if (dateLineRe.test(next)) break; // nova transação
      amountMatch = next.match(amountRe);
      if (!amountMatch && !skipRe.test(next)) {
        description += (description ? " " : "") + next;
      }
      j++;
    }

    if (amountMatch && !skipRe.test(description)) {
      const amount = parseFloat(amountMatch[1].replace(/\./g, "").replace(",", "."));
      const type = amountMatch[2] === "D" ? "debit" : "credit";
      rows.push({ date, description: description.trim(), amount, type });
    }

    i = amountMatch ? j : i + 1;
  }

  return { bankName: "Sicoob", accountNumber, agency, companyName, rows };
}

function parseCaixa(text: string): ParsedStatement {
  const clienteMatch = text.match(/Cliente\s+([^\n\r]+)/i);
  const companyName = clienteMatch ? clienteMatch[1].trim() : "";
  const contaFullMatch = text.match(/Conta\s+([\d]+)\s*\/\s*([\d.\/\-]+)/i);
  const agency = contaFullMatch ? contaFullMatch[1].trim() : "";
  const accountNumber = contaFullMatch ? contaFullMatch[2].trim() : "";

  // ── Correcoes de OCR ────────────────────────────────────────────────────────
  const fixed = text
    // 1) Espaco antes do ponto de milhar: "1 .408,25" → "1.408,25"
    .replace(/(\d)\s+\.(\d{3}[,\d])/g, "$1.$2")
    // 2) OCR fragmenta o valor: "1, / 408,25 D" ou "1, 408,25 D" ou "1,408,25 D"
    //    → reconstroi "1.408,25 D"
    //    Padrao: 1-3 digitos + virgula + lixo opcional (espacos/barras) + 3 digitos + virgula + 2 digitos + espaco + C/D
    .replace(/(\d{1,3}),[\s\/\-–]*(\d{3},\d{2}\s*[CD])\b/g, "$1.$2")
    // 3) Digito mal lido apos virgula: "873,A7" → "873,47"
    .replace(/(\d+),([A-Za-z€£])(\d)/g, (_, p1, p2, p3) => {
      const map: Record<string, string> = { A:"4",a:"4",O:"0",o:"0",l:"1",I:"1",S:"5",s:"5",B:"8",b:"8",G:"6",g:"6",Z:"2",z:"2","€":"6","£":"5" };
      return `${p1},${map[p2] ?? "0"}${p3}`;
    })
    // 4) OCR le "C" como "€" ou "£" apos valor: "555,17 €" → "555,17 C"
    .replace(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*[€£](?=\s|$)/gm, "$1 C");

  // ── Processamento coluna a coluna ────────────────────────────────────────────
  // Colunas CEF: Data-Hora | NrDoc | Historico | Favorecido | CPF/CNPJ | Valor[C/D] | Saldo[C/D]
  // Regras:
  //   - Ignorar hora, CPF/CNPJ e coluna Saldo
  //   - Descricao = NrDoc + Historico + Favorecido (unidos)
  //   - Valor = PRIMEIRO numero+[CD] encontrado (coluna Valor — o Saldo fica apos e e ignorado)
  //   - Ignorar SALDO DIA e lancamentos 0,00
  //
  // Grupos: 1=data  2=NrDoc+Historico+Favorecido+CPF(lazy)  3=valor  4=C ou D
  const lineRe = /(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*\d{2}:\d{2}:\d{2}\s+(\d{3,8}\s+.*?)(\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD])\b/gs;

  const rows: StatementRow[] = [];

  for (const m of fixed.matchAll(lineRe)) {
    const date   = m[1];
    const amount = parseFloat(m[3].replace(/\./g, "").replace(",", "."));
    const type   = m[4] === "C" ? "credit" : "debit";

    // Ignora SALDO DIA (0,00) e SALDO ANTERIOR
    if (amount === 0) continue;

    // Descricao: NrDoc + Historico + Favorecido — remove CPF/CNPJ mascarados (**xxx***)
    const description = m[2]
      .replace(/\*+[\d*.\/\-]+\**/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (/SALDO\s+DIA|SALDO\s+ANTERIOR/i.test(description) || !description) continue;

    rows.push({ date, description, amount, type });
  }

  return { bankName: "Caixa Econômica", accountNumber, agency, companyName, rows };
}

function parseBradesco(text: string): ParsedStatement {
  const accountMatch = text.match(/(?:conta|n[uú]mero da conta)[^\d]*(\d[\d.\-\/]+)/i);
  const accountNumber = accountMatch ? accountMatch[1].trim() : "";
  const agencyMatch = text.match(/(?:ag[eê]ncia|ag\.?)[^\d]*(\d{3,6})/i);
  const agency = agencyMatch ? agencyMatch[1].trim() : "";
  const companyMatch = text.match(/(?:titular|cliente|correntista|nome)[:\s]+([^\n]{3,60})/i);
  const companyName = companyMatch ? companyMatch[1].trim() : "";

  const rows: StatementRow[] = [];

  const dateRe = /\b(\d{2}\/\d{2}\/\d{2,4})\b/;

  // Captura valor (com sinal opcional) seguido opcionalmente de D ou C (notação débito/crédito)
  // Ex: -1.234,56 | 1.234,56 | 1.234,56 D | 1.234,56 C
  const amountRe = /(-?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s*([DC])(?!\w))?/g;

  // Linhas de cabeçalho, rodapé ou resumo que não são transações
  // "saldo anterior" é tratado separadamente (atualiza prevSaldo)
  const skipRe = /saldo\s*(do\s*dia|bloqueado|atual|final|dispon[ií]vel|por\s*transa|inicial|invest)|resumo|per[ií]odo\s*:|total\s*(cr[eé]dito|d[eé]bito|\(r\$\))|^\s*total\b|data\s+da\s+opera[çc][ãa]o|folha\s+\d|nome\s+do\s+usu[áa]rio|extrato\s+(mensal|de:|anual|por\s+per[ií]odo)|os\s+dados\s+acima|cnpj:/i;

  // saldo anterior: atualizado a cada seção para calcular corretamente crédito/débito por variação
  let prevSaldo = NaN;

  let currentDate = "";
  let pendingDesc = "";

  console.log("[BRADESCO parser] texto recebido (50 linhas):\n" +
    text.split("\n").slice(0, 50).map((l, i) => `  ${i}: ${JSON.stringify(l)}`).join("\n"));

  for (const line of text.split("\n")) {
    // Linha "SALDO ANTERIOR": atualiza prevSaldo e pula (não é transação)
    if (/\bsaldo\s+anterior\b/i.test(line)) {
      const m = [...line.matchAll(amountRe)];
      if (m.length >= 1) prevSaldo = parseFloat(m[m.length - 1][1].replace(/\./g, "").replace(",", "."));
      console.log(`[BRADESCO] SALDO ANTERIOR → prevSaldo=${prevSaldo}`);
      continue;
    }

    if (skipRe.test(line)) {
      console.log(`[BRADESCO] SKIP: ${JSON.stringify(line)}`);
      continue;
    }

    const dateMatch = line.match(dateRe);
    if (dateMatch) {
      const parts = dateMatch[1].split("/");
      if (parts[2].length === 2) parts[2] = "20" + parts[2];
      currentDate = parts.join("/");
      pendingDesc = "";
    }

    if (!currentDate) continue;

    const matches = [...line.matchAll(amountRe)];

    if (matches.length < 2) {
      // Linha apenas descritiva: acumula para próxima linha de valor
      const descPart = line.replace(dateRe, "").replace(/\s+/g, " ").trim();
      if (descPart) pendingDesc = descPart;
      continue;
    }

    // Colunas Bradesco: ... | Crédito (R$) | Débito (R$) | Saldo (R$)
    // Último valor = saldo corrente; penúltimo = valor da transação
    const txMatch   = matches[matches.length - 2];
    const saldoMatch = matches[matches.length - 1];

    const saldoValue = parseFloat(saldoMatch[1].replace(/\./g, "").replace(",", "."));
    let numValue     = parseFloat(txMatch[1].replace(/\./g, "").replace(",", "."));
    const dcFlag     = txMatch[2]; // "D", "C" ou undefined

    // Notação D/C explícita sobrescreve sinal numérico
    if (dcFlag === "D") numValue = -Math.abs(numValue);
    else if (dcFlag === "C") numValue = Math.abs(numValue);

    // Determina tipo: sinal > variação do saldo > padrão crédito
    let type: "debit" | "credit";
    if (numValue < 0) {
      type = "debit";
    } else if (!isNaN(prevSaldo)) {
      type = saldoValue < prevSaldo ? "debit" : "credit";
    } else {
      type = "credit";
    }
    console.log(`[BRADESCO] tx: ${currentDate} | val=${txMatch[1]} dc=${dcFlag??"-"} num=${numValue} saldo=${saldoValue} prevSaldo=${prevSaldo} → ${type}`);
    prevSaldo = saldoValue;

    // Descrição = remove data + valor da transação (com D/C) + saldo da linha
    const descLine = line
      .replace(dateRe, "")
      .replace(txMatch[0], "")
      .replace(saldoMatch[0], "")
      .replace(/\s+/g, " ")
      .trim();

    const description = (pendingDesc ? pendingDesc + " " : "") + descLine;
    pendingDesc = "";

    rows.push({
      date: currentDate,
      description: description.replace(/\s+/g, " ").trim(),
      amount: Math.abs(numValue),
      type,
    });
  }

  return { bankName: "Bradesco", accountNumber, agency, companyName, rows };
}

function parseAsaas(text: string): ParsedStatement {
  const companyMatch = text.match(/(?:titular|cliente|correntista|nome)[:\s]+([^\n]{3,60})/i);
  const companyName = companyMatch ? companyMatch[1].trim() : "";

  const rows: StatementRow[] = [];
  const dateRe = /\b(\d{2}\/\d{2}\/\d{4})\b/;
  const amountRe = /(-?\d{1,3}(?:\.\d{3})*,\d{2})/g;

  for (const line of text.split("\n")) {
    const dateMatch = line.match(dateRe);
    if (!dateMatch) continue;
    const amounts = [...line.matchAll(amountRe)];
    if (!amounts.length) continue;
    const raw = amounts[amounts.length - 1][0];
    const numValue = parseFloat(raw.replace(/\./g, "").replace(",", "."));
    rows.push({
      date: dateMatch[1],
      description: line.replace(dateRe, "").replace(raw, "").replace(/\s+/g, " ").trim(),
      amount: Math.abs(numValue),
      type: numValue < 0 ? "debit" : "credit",
    });
  }

  return { bankName: "Asaas", accountNumber: "", agency: "", companyName, rows };
}

function parseBancoInter(text: string): ParsedStatement {
  // Cabeçalho: "Conta: 8818846-9", "Agência: 0001-9", nome do titular na 1ª linha
  const accountMatch = text.match(/Conta:\s*([\d\-]+)/i);
  const accountNumber = accountMatch ? accountMatch[1].trim() : "";
  const agencyMatch = text.match(/Ag[eê]ncia:\s*([\d\-]+)/i);
  const agency = agencyMatch ? agencyMatch[1].trim() : "";
  const companyMatch = text.match(/^([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][^\n]+)/m);
  const companyName = companyMatch ? companyMatch[1].trim() : "";

  const monthMap: Record<string, string> = {
    janeiro: "01", fevereiro: "02", marco: "03",
    abril: "04", maio: "05", junho: "06", julho: "07",
    agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
  };
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Linha de cabeçalho de data: "15 de Fevereiro de 2026 Saldo do dia: R$ X"
  const dateHeaderRe = /^(\d{1,2})\s+de\s+([A-Za-zÀ-ú]+)\s+de\s+(\d{4})/i;
  // Valores Inter: -R$ 24,99 (débito) ou R$ 220,00 (crédito)
  const amountRe = /(-?R\$\s*\d{1,3}(?:\.\d{3})*,\d{2})/g;

  const rows: StatementRow[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);
  let currentDate = "";

  for (const line of lines) {
    // Detecta cabeçalho de grupo de data
    const dh = line.match(dateHeaderRe);
    if (dh) {
      const day = dh[1].padStart(2, "0");
      const monthNum = monthMap[norm(dh[2])] ?? "01";
      currentDate = `${day}/${monthNum}/${dh[3]}`;
      continue;
    }

    if (!currentDate) continue;

    // Linha de transação: precisa ter pelo menos 1 valor R$
    const allAmounts = [...line.matchAll(amountRe)];
    if (allAmounts.length === 0) continue;

    // 1º valor = transação (−R$ débito / R$ crédito), último valor = saldo corrente (ignorar)
    const firstAmountStr = allAmounts[0][0];
    const isDebit = firstAmountStr.startsWith("-");
    const cleanAmt = firstAmountStr.replace(/[-R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(cleanAmt);
    if (isNaN(amount) || amount === 0) continue;

    // Descrição: linha sem os valores R$
    let description = line;
    for (const m of allAmounts) description = description.replace(m[0], "");
    description = description.replace(/\s+/g, " ").trim();
    if (!description) continue;

    rows.push({ date: currentDate, description, amount, type: isDebit ? "debit" : "credit" });
  }

  return { bankName: "Banco Inter", accountNumber, agency, companyName, rows };
}

function parseGeneric(text: string, bankName: string): ParsedStatement {
  const accountMatch = text.match(/(?:conta|n[uú]mero da conta|account)[^\d]*(\d[\d.\-\/]+)/i);
  const accountNumber = accountMatch ? accountMatch[1].trim() : "";
  const agencyMatch = text.match(/(?:ag[eê]ncia|ag\.?)[^\d]*(\d{3,6})/i);
  const agency = agencyMatch ? agencyMatch[1].trim() : "";
  const companyMatch = text.match(/(?:titular|cliente|correntista|nome)[:\s]+([^\n]{3,60})/i);
  const companyName = companyMatch ? companyMatch[1].trim() : "";

  const rows: StatementRow[] = [];
  const dateRe = /\b(\d{2}\/\d{2}\/\d{4})\b/;
  const amountRe = /(-?\d{1,3}(?:\.\d{3})*,\d{2})/g;

  for (const line of text.split("\n")) {
    const dateMatch = line.match(dateRe);
    if (!dateMatch) continue;
    const amounts = [...line.matchAll(amountRe)];
    if (!amounts.length) continue;
    const raw = amounts[amounts.length - 1][0];
    const numValue = parseFloat(raw.replace(/\./g, "").replace(",", "."));
    rows.push({
      date: dateMatch[1],
      description: line.replace(dateRe, "").replace(raw, "").replace(/\s+/g, " ").trim(),
      amount: Math.abs(numValue),
      type: numValue < 0 ? "debit" : "credit",
    });
  }

  return { bankName, accountNumber, agency, companyName, rows };
}

function parseBankStatement(text: string): ParsedStatement {
  if (/sicoob/i.test(text))   return parseSicoob(text);
  if (/caixa\s+econ[oô]mica|caixa\s+federal|CEFBR/i.test(text) ||
      (/\bCAIXA\b/i.test(text) && /Nr\.\s*Doc|Hist.rico.*Complemento|Extrato por per/i.test(text)))
    return parseCaixa(text);
  // Inter ANTES de Itaú — extratos Inter podem conter "ITAU" em descrições de Pix
  if (/\bbanco\s+inter\b|institui[çc][ãa]o.*\binter\b/i.test(text)) return parseBancoInter(text);
  if (/bradesco|\bDcto\.\b|Total\s+Dispon[ií]vel.*Bloqueado/i.test(text)) return parseBradesco(text);
  if (/asaas/i.test(text))    return parseAsaas(text);
  if (/ita[uú]/i.test(text))  return parseGeneric(text, "Itaú");
  if (/santander/i.test(text)) return parseGeneric(text, "Santander");
  if (/nubank/i.test(text))   return parseGeneric(text, "Nubank");
  return parseGeneric(text, "");
}

const upload = multer({ storage: multer.memoryStorage() });

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

async function seedDatabase() {
  let masterUser = await storage.getUserByUsername("master");
  if (!masterUser) {
    const hashed = await hashPassword("master");
    masterUser = await storage.createUser({ username: "master", password: hashed, role: "admin", isActive: true });
    console.log("Master user created");
  } else if ((masterUser as any).role !== "admin") {
    await storage.updateUser(masterUser.id, { role: "admin", isActive: true });
  }

  let cleitonUser = await storage.getUserByUsername("cleiton");
  if (!cleitonUser) {
    const hashed = await hashPassword("cleiton");
    await storage.createUser({ username: "cleiton", password: hashed, role: "admin", isActive: true });
    console.log("Cleiton user created");
  } else if ((cleitonUser as any).role !== "admin") {
    await storage.updateUser(cleitonUser.id, { role: "admin", isActive: true });
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  // ─── Public: Self-registration ─────────────────────────────────────────────
  app.post("/api/register", async (req, res) => {
    try {
      const { cnpj, companyName, email, phone, address, username, password } = req.body;
      if (!cnpj || !companyName || !username || !password) {
        return res.status(400).json({ message: "CNPJ, nome da empresa, usuário e senha são obrigatórios." });
      }
      const cleanCnpj = cnpj.replace(/\D/g, "");
      if (cleanCnpj.length !== 14) return res.status(400).json({ message: "CNPJ deve ter 14 dígitos." });
      const existing = await storage.getCompanyByCnpj(cleanCnpj);
      if (existing) return res.status(400).json({ message: "CNPJ já cadastrado." });
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) return res.status(400).json({ message: "Nome de usuário já em uso." });

      const company = await storage.createCompany({ cnpj: cleanCnpj, name: companyName, email, phone, address, isActive: true });
      const hashed = await hashPassword(password);
      await storage.createUser({ username, password: hashed, role: "company_admin", companyId: company.id, isActive: true });
      res.status(201).json({ message: "Empresa cadastrada com sucesso." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Falha ao cadastrar empresa." });
    }
  });

  // ─── Admin: Empresas ───────────────────────────────────────────────────────
  app.get("/api/admin/companies", requireAdmin, async (req, res) => {
    try { res.json(await storage.getCompanies()); }
    catch { res.status(500).json({ message: "Erro ao buscar empresas." }); }
  });

  app.post("/api/admin/companies", requireAdmin, async (req, res) => {
    try {
      const { cnpj, name, email, phone, address, isActive } = req.body;
      if (!cnpj || !name) return res.status(400).json({ message: "CNPJ e nome são obrigatórios." });
      const clean = cnpj.replace(/\D/g, "");
      if (clean.length !== 14) return res.status(400).json({ message: "CNPJ deve ter 14 dígitos." });
      if (await storage.getCompanyByCnpj(clean)) return res.status(400).json({ message: "CNPJ já cadastrado." });
      res.status(201).json(await storage.createCompany({ cnpj: clean, name, email, phone, address, isActive: isActive !== false }));
    } catch { res.status(500).json({ message: "Erro ao criar empresa." }); }
  });

  app.patch("/api/admin/companies/:id", requireAdmin, async (req, res) => {
    try {
      const companyId = firstParam(req.params.id);
      const { cnpj, name, email, phone, address, isActive } = req.body;
      const updates: any = { name, email, phone, address };
      if (isActive !== undefined) updates.isActive = isActive;
      if (cnpj !== undefined) {
        const clean = String(cnpj).replace(/\D/g, "");
        if (clean.length !== 14) return res.status(400).json({ message: "CNPJ deve ter 14 dígitos." });
        const existing = await storage.getCompanyByCnpj(clean);
        if (existing && existing.id !== companyId) return res.status(400).json({ message: "CNPJ já usado por outra empresa." });
        updates.cnpj = clean;
      }
      res.json(await storage.updateCompany(companyId, updates));
    } catch { res.status(500).json({ message: "Erro ao atualizar empresa." }); }
  });

  app.delete("/api/admin/companies/:id", requireAdmin, async (req, res) => {
    try {
      await storage.updateCompany(firstParam(req.params.id), { isActive: false });
      res.status(204).end();
    } catch { res.status(500).json({ message: "Erro ao remover empresa." }); }
  });

  // ─── Admin: Usuários de uma empresa ────────────────────────────────────────
  app.get("/api/admin/companies/:id/users", requireAdmin, async (req, res) => {
    try {
      const list = await storage.getUsers(firstParam(req.params.id));
      res.json(list.map(({ password, ...u }) => u));
    } catch { res.status(500).json({ message: "Erro ao buscar usuários." }); }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, name, role, companyId } = req.body;
      if (!username || !password || !companyId) return res.status(400).json({ message: "Usuário, senha e empresa são obrigatórios." });
      if (await storage.getUserByUsername(username)) return res.status(400).json({ message: "Usuário já existe." });
      const hashed = await hashPassword(password);
      const user = await storage.createUser({ username, password: hashed, name, role: role || "user", companyId, isActive: true });
      const { password: _, ...safe } = user;
      res.status(201).json(safe);
    } catch { res.status(500).json({ message: "Erro ao criar usuário." }); }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { name, role, isActive, password } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (isActive !== undefined) updates.isActive = isActive;
      if (password) updates.password = await hashPassword(password);
      const user = await storage.updateUser(firstParam(req.params.id), updates);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
      const { password: _, ...safe } = user;
      res.json(safe);
    } catch { res.status(500).json({ message: "Erro ao atualizar usuário." }); }
  });

  // ─── Company Admin: própria empresa ────────────────────────────────────────
  app.get("/api/company", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user.companyId) return res.status(404).json({ message: "Sem empresa vinculada." });
      res.json(await storage.getCompany(user.companyId));
    } catch { res.status(500).json({ message: "Erro ao buscar empresa." }); }
  });

  app.patch("/api/company", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user.companyId) return res.status(403).json({ message: "Sem empresa vinculada." });
      if (user.role === "user") return res.status(403).json({ message: "Sem permissão." });
      const { name, email, phone, address } = req.body;
      res.json(await storage.updateCompany(user.companyId, { name, email, phone, address }));
    } catch { res.status(500).json({ message: "Erro ao atualizar empresa." }); }
  });

  app.get("/api/company/users", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user.companyId) return res.status(404).json({ message: "Sem empresa vinculada." });
      if (user.role === "user") return res.status(403).json({ message: "Sem permissão." });
      const list = await storage.getUsers(user.companyId);
      res.json(list.map(({ password, ...u }) => u));
    } catch { res.status(500).json({ message: "Erro ao buscar usuários." }); }
  });

  app.post("/api/company/users", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser.companyId || currentUser.role === "user") return res.status(403).json({ message: "Sem permissão." });
      const { username, password, name, role } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Usuário e senha obrigatórios." });
      if (await storage.getUserByUsername(username)) return res.status(400).json({ message: "Usuário já existe." });
      const hashed = await hashPassword(password);
      const newUser = await storage.createUser({ username, password: hashed, name, role: role || "user", companyId: currentUser.companyId, isActive: true });
      const { password: _, ...safe } = newUser;
      res.status(201).json(safe);
    } catch { res.status(500).json({ message: "Erro ao criar usuário." }); }
  });

  app.patch("/api/company/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser.companyId || currentUser.role === "user") return res.status(403).json({ message: "Sem permissão." });
      const targetUserId = firstParam(req.params.id);
      const target = await storage.getUser(targetUserId);
      if (!target || target.companyId !== currentUser.companyId) return res.status(403).json({ message: "Sem permissão." });
      const { name, role, isActive, password } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (isActive !== undefined) updates.isActive = isActive;
      if (password) updates.password = await hashPassword(password);
      const user = await storage.updateUser(targetUserId, updates);
      const { password: _, ...safe } = user!;
      res.json(safe);
    } catch { res.status(500).json({ message: "Erro ao atualizar usuário." }); }
  });

  // ─── PDF Upload ────────────────────────────────────────────────────────────
  app.post(api.statements.upload.path, requireAuth, upload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Nenhum PDF enviado." });
      const companyId = getCompanyId(req);

      let pdfData: { text: string } | undefined;

      const parseWithPdfjs = async (buffer: Buffer) => {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const data = new Uint8Array(buffer);
        const pdfDocument = await (pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true, verbosity: 0 })).promise;
        let fullText = "";
        for (let i = 1; i <= pdfDocument.numPages; i++) {
          const page = await pdfDocument.getPage(i);
          const tc = await page.getTextContent();
          // Threshold de 5 pontos: agrupa itens na mesma linha visual mesmo com leve
        // variacao de Y entre colunas (ex: Valor e Saldo na mesma linha do extrato CEF).
        // Dentro da mesma linha, ordena por X (esquerda → direita).
        const Y_THRESHOLD = 5;
        const items = (tc.items as any[]).sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5];
            if (Math.abs(yDiff) > Y_THRESHOLD) return yDiff;
            return a.transform[4] - b.transform[4];
          });
          let lastY = -1, currentLine = "";
          const pageLines: string[] = [];
          for (const item of items) {
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > Y_THRESHOLD) { pageLines.push(currentLine); currentLine = ""; }
            if (item.str !== undefined) currentLine += (currentLine && !currentLine.endsWith(" ") && !item.str.startsWith("-") ? " " : "") + item.str;
            lastY = item.transform[5];
          }
          if (currentLine) pageLines.push(currentLine);
          fullText += pageLines.join("\n") + "\n";
        }
        return { text: fullText };
      };

      // Tenta extrair texto com pdfjs e pdf-parse
      let pdfjsText = "";
      let pdfParseText = "";

      try {
        const result = await parseWithPdfjs(req.file.buffer);
        pdfjsText = result.text || "";
      } catch { /* ignora */ }

      try {
        // pdf-parse: API correta — exporta função default
        const pdfParseMod = await import("pdf-parse");
        const pdfParseFn: (buf: Buffer) => Promise<{ text: string }> =
          (pdfParseMod as any).default ?? (pdfParseMod as any);
        const result = await pdfParseFn(req.file.buffer);
        pdfParseText = result.text || "";
      } catch { /* ignora */ }

      // Verifica se extraiu texto útil (ignora marcadores tipo "-- 1 of 8 --")
      const usefulText = (t: string) => t.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
      let extractedText = usefulText(pdfParseText) ? pdfParseText : usefulText(pdfjsText) ? pdfjsText : "";

      // ── Extração coluna a coluna para CEF ─────────────────────────────────────
      // Se for CEF, re-extrai usando pdfjs COM posições X,Y para montar cada linha
      // coluna por coluna (esq→dir) e já descarta a última coluna (Saldo).
      const isCef = /caixa\s+econ[oô]mica|caixa\s+federal|CEFBR|alô\s+caixa|alo\s+caixa/i.test(extractedText);
      console.log("[CEF detect] isCef=", isCef, "| trecho texto:", extractedText.slice(0, 200).replace(/\n/g, "↵"));
      if (isCef) {
        try {
          const pdfjs2 = await import("pdfjs-dist/legacy/build/pdf.mjs");
          const pdfDoc = await (pdfjs2.getDocument({ data: new Uint8Array(req.file.buffer), verbosity: 0 })).promise;
          let cefText = "";

          for (let p = 1; p <= pdfDoc.numPages; p++) {
            const page  = await pdfDoc.getPage(p);
            const tc    = await page.getTextContent();

            // 1) Coleta itens com posição
            const allItems = (tc.items as any[])
              .filter(i => i.str?.trim())
              .map(i => ({ x: Math.round(i.transform[4]), y: Math.round(i.transform[5]), str: (i.str as string).trim() }));

            // 2) Agrupa por linha visual (Y com tolerância 8pt)
            const rowBuckets: { y: number; items: { x: number; str: string }[] }[] = [];
            for (const item of allItems) {
              const bucket = rowBuckets.find(b => Math.abs(b.y - item.y) <= 8);
              if (bucket) bucket.items.push(item);
              else rowBuckets.push({ y: item.y, items: [item] });
            }

            // 3) Ordena linhas de cima para baixo; dentro de cada linha, da esquerda para direita
            rowBuckets.sort((a, b) => b.y - a.y);
            for (const row of rowBuckets) {
              row.items.sort((a, b) => a.x - b.x);

              // 4) Monta texto da linha (todas as colunas em ordem X)
              const lineText = row.items.map(i => i.str).join(" ");

              // 5) Remove ÚLTIMA ocorrência de "valor [CD]" = coluna Saldo
              const amtRe = /\d{1,3}(?:\.\d{3})*,\d{2}\s*[CD]\b/g;
              const hits  = [...lineText.matchAll(amtRe)];
              const clean = hits.length >= 2
                ? lineText.slice(0, hits[hits.length - 1].index!).trimEnd()
                : lineText;

              cefText += clean + "\n";
            }
          }
          extractedText = cefText;
          // LOG: primeiras 20 linhas do texto CEF extraído coluna a coluna
          const preview = cefText.split("\n").filter(l => l.trim()).slice(0, 20).join("\n");
          console.log("\n[CEF colunas extraídas]\n" + preview + "\n");
        } catch (cefErr: any) {
          console.error("[CEF extração erro]", cefErr?.message);
          /* mantém extractedText original se falhar */
        }
      }

      // ── Extração coluna a coluna para Bradesco ────────────────────────────────
      // Detecta posição X das colunas Crédito / Débito / Saldo no cabeçalho e
      // etiqueta cada valor monetário com "C" (crédito) ou "D" (débito).
      // A coluna Saldo fica sem etiqueta — parseBradesco trata como último valor.
      const isBradesco = !isCef && /bradesco|\bDcto\.\b|Total\s+Dispon[ií]vel.*Bloqueado/i.test(extractedText);
      console.log("[BRADESCO detect] isBradesco=", isBradesco, "| trecho:", extractedText.slice(0, 200).replace(/\n/g, "↵"));
      if (isBradesco) {
        try {
          const pdfjs3 = await import("pdfjs-dist/legacy/build/pdf.mjs");
          const pdfDoc3 = await (pdfjs3.getDocument({ data: new Uint8Array(req.file.buffer), verbosity: 0 })).promise;
          let bradText = "";
          // X das colunas — detectados no cabeçalho, persistem entre páginas
          let xCredito = -1, xDebito = -1, xSaldo = -1;

          for (let p = 1; p <= pdfDoc3.numPages; p++) {
            const page = await pdfDoc3.getPage(p);
            const tc   = await page.getTextContent();

            // Coleta todos os itens com posição X,Y
            const allItems = (tc.items as any[])
              .filter(i => i.str?.trim())
              .map(i => ({
                x: Math.round(i.transform[4]),
                y: Math.round(i.transform[5]),
                str: (i.str as string).trim(),
              }));

            // Agrupa por linha visual (tolerância 8pt em Y)
            const rowBuckets: { y: number; items: { x: number; str: string }[] }[] = [];
            for (const item of allItems) {
              const bucket = rowBuckets.find(b => Math.abs(b.y - item.y) <= 8);
              if (bucket) bucket.items.push(item);
              else rowBuckets.push({ y: item.y, items: [item] });
            }
            rowBuckets.sort((a, b) => b.y - a.y); // cima → baixo

            for (const row of rowBuckets) {
              row.items.sort((a, b) => a.x - b.x); // esquerda → direita
              const lineText = row.items.map(i => i.str).join(" ");

              // Linha de cabeçalho: detecta X das colunas
              if (/cr[eé]dito/i.test(lineText) && /d[eé]bito/i.test(lineText) && /saldo/i.test(lineText)) {
                for (const item of row.items) {
                  if (/cr[eé]dito/i.test(item.str) && xCredito < 0) xCredito = item.x;
                  if (/d[eé]bito/i.test(item.str)  && xDebito  < 0) xDebito  = item.x;
                  if (/saldo/i.test(item.str)       && xSaldo   < 0) xSaldo   = item.x;
                }
                console.log(`[BRADESCO p${p}] header detectado | xCrédito=${xCredito} xDébito=${xDebito} xSaldo=${xSaldo}`);
                bradText += lineText + "\n";
                continue;
              }

              // Sem cabeçalho detectado ainda: emite linha sem etiqueta
              if (xCredito < 0 || xDebito < 0 || xSaldo < 0) {
                bradText += lineText + "\n";
                continue;
              }

              // Limites de coluna: ponto médio entre cabeçalhos
              const midCD = (xCredito + xDebito) / 2;
              const midDS = (xDebito  + xSaldo)  / 2;
              const moneyRe = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;

              const parts: string[] = [];
              for (const item of row.items) {
                if (moneyRe.test(item.str)) {
                  const absVal = item.str.replace(/^-/, "");
                  if (item.x < midCD) {
                    parts.push(absVal + " C");  // coluna Crédito
                  } else if (item.x < midDS) {
                    parts.push(absVal + " D");  // coluna Débito
                  } else {
                    parts.push(item.str);        // coluna Saldo (sem etiqueta)
                  }
                } else {
                  parts.push(item.str);
                }
              }
              const taggedLine = parts.join(" ");
              bradText += taggedLine + "\n";
            }
          }

          extractedText = bradText;
          const preview = bradText.split("\n").filter(l => l.trim()).slice(0, 30).join("\n");
          console.log("\n[BRADESCO colunas extraídas — primeiras 30 linhas]\n" + preview + "\n");
        } catch (bradErr: any) {
          console.error("[BRADESCO extração erro]", bradErr?.message);
          // mantém extractedText original
        }
      }

      // Se nenhum parser extraiu texto, é um PDF de imagem — extrai JPEGs embutidos e usa OCR
      if (!usefulText(extractedText)) {
        console.log("PDF sem texto — extraindo imagens para OCR...");
        try {
          const tesseractMod = await import("tesseract.js");
          const recognize = (tesseractMod as any).recognize ?? (tesseractMod as any).default?.recognize;
          const os = await import("os");
          const fs = await import("fs");
          const nodePath = await import("path");

          // Extrai JPEGs embutidos diretamente do binário do PDF (DCTDecode)
          const pdfBuf = req.file.buffer;
          const jpegImages: Buffer[] = [];
          let pos = 0;
          while (pos < pdfBuf.length - 3) {
            // Marcador SOI do JPEG: FF D8 FF
            if (pdfBuf[pos] === 0xFF && pdfBuf[pos + 1] === 0xD8 && pdfBuf[pos + 2] === 0xFF) {
              let end = pos + 3;
              while (end < pdfBuf.length - 1) {
                if (pdfBuf[end] === 0xFF && pdfBuf[end + 1] === 0xD9) { end += 2; break; }
                end++;
              }
              if (end - pos > 1000) { // descarta JEPGs muito pequenos (ícones/logos)
                jpegImages.push(pdfBuf.slice(pos, end));
              }
              pos = end;
            } else {
              pos++;
            }
          }

          console.log(`Encontradas ${jpegImages.length} imagens JPEG no PDF`);

          if (jpegImages.length === 0) {
            return res.status(400).json({ message: "PDF de imagem sem JPEGs extraíveis. Envie um PDF com texto." });
          }

          let fullOcrText = "";
          for (let idx = 0; idx < jpegImages.length; idx++) {
            const tmpFile = nodePath.join(os.tmpdir(), `ocr_${Date.now()}_${idx}.jpg`);
            fs.writeFileSync(tmpFile, jpegImages[idx]);
            try {
              const { data: ocrResult } = await recognize(tmpFile, "por", { logger: () => {} });
              fullOcrText += ocrResult.text + "\n";
            } finally {
              fs.unlinkSync(tmpFile);
            }
            console.log(`OCR imagem ${idx + 1}/${jpegImages.length} concluída`);
          }
          extractedText = fullOcrText;

          // ── Pós-OCR: se for CEF, remove última coluna (Saldo) de cada linha ────
          const isCefOcr = /caixa\s+econ[oô]mica|caixa\s+federal|CEFBR/i.test(fullOcrText) ||
            (/\bCAIXA\b/i.test(fullOcrText) && /Nr\.\s*Doc|Hist.rico.*Complemento|Extrato por per/i.test(fullOcrText));
          console.log("[CEF OCR detect] isCefOcr=", isCefOcr, "| trecho OCR:", fullOcrText.slice(0, 300).replace(/\n/g, "↵"));
          if (isCefOcr) {
            // [CD€£] — € e £ sao leituras OCR erradas de C/D
            const amtRe = /\d{1,3}(?:\.\d{3})*,\d{2}\s*(?:[CD]\b|[€£])/g;
            extractedText = fullOcrText.split("\n").map(line => {
              // Fix OCR que cola valor sem virgula: "2.17248C" → "2.172,48 C"
              line = line.replace(/(\d{1,3}(?:\.\d{3})*)(\d{2})([CD€£])(?=[\s,]|$)/g, "$1,$2 $3");
              const hits = [...line.matchAll(amtRe)];
              if (hits.length >= 2) {
                const last = hits[hits.length - 1];
                return line.slice(0, last.index!).trimEnd();
              }
              return line;
            }).join("\n");
            const preview = extractedText.split("\n").filter(l => l.trim()).slice(0, 15).join("\n");
            console.log("\n[CEF OCR saldo removido]\n" + preview + "\n");
          }
        } catch (ocrErr: any) {
          console.error("OCR error:", ocrErr);
          return res.status(400).json({ message: "OCR falhou: " + ocrErr.message });
        }
      }

      const text = extractedText;
      if (!text?.trim()) return res.status(400).json({ message: "Não foi possível extrair texto do PDF." });

      const parsed = parseBankStatement(text);
      const rows = parsed.rows || [];

      let bankAccountId: string | null = null;
      if (parsed.bankName && parsed.accountNumber) {
        let account = await storage.findBankAccount(parsed.bankName, parsed.accountNumber, companyId);
        if (!account) {
          account = await storage.createBankAccount({ bankName: parsed.bankName, accountNumber: parsed.accountNumber, agency: parsed.agency || "", companyName: parsed.companyName || "", companyId });
        }
        bankAccountId = account.id;
      }

      const statement = await storage.createStatement({ filename: req.file.originalname, bankAccountId, companyId, data: rows });
      res.status(200).json(statement);
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Falha ao processar o PDF." });
    }
  });

  // ─── Statements ────────────────────────────────────────────────────────────
  app.get(api.statements.list.path, requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      res.json(await storage.getStatements(companyId));
    } catch { res.status(500).json({ message: "Erro ao buscar extratos." }); }
  });

  app.get(api.statements.get.path, requireAuth, async (req, res) => {
    try {
      const s = await storage.getStatement(firstParam(req.params.id));
      if (!s) return res.status(404).json({ message: "Extrato não encontrado." });
      res.json(s);
    } catch { res.status(500).json({ message: "Erro ao buscar extrato." }); }
  });

  app.patch(api.statements.update.path, requireAuth, async (req, res) => {
    try {
      const s = await storage.updateStatement(firstParam(req.params.id), req.body.data);
      if (!s) return res.status(404).json({ message: "Extrato não encontrado." });
      res.json(s);
    } catch { res.status(500).json({ message: "Erro ao atualizar extrato." }); }
  });

  app.delete(api.statements.get.path, requireAuth, async (req, res) => {
    try {
      await storage.deleteStatement(firstParam(req.params.id));
      res.status(204).end();
    } catch { res.status(500).json({ message: "Erro ao excluir extrato." }); }
  });

  // ─── Bank Accounts ─────────────────────────────────────────────────────────
  app.get(api.bankAccounts.list.path, requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      res.json(await storage.getBankAccounts(companyId));
    } catch { res.status(500).json({ message: "Erro ao buscar contas." }); }
  });

  await seedDatabase();
  return httpServer;
}
