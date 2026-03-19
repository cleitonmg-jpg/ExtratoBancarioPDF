import { db } from "./db";
import {
  bankAccounts,
  statements,
  users,
  companies,
  type InsertStatement,
  type Statement,
  type BankAccount,
  type InsertBankAccount,
  type User,
  type InsertUser,
  type Company,
  type InsertCompany,
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";

const PostgresSessionStore = connectPg(session);
const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // Statements
  getStatements(companyId?: string | null): Promise<Statement[]>;
  getStatement(id: string): Promise<Statement | undefined>;
  createStatement(statement: InsertStatement): Promise<Statement>;
  updateStatement(id: string, data: any): Promise<Statement | undefined>;
  deleteStatement(id: string): Promise<void>;

  // Bank Accounts
  getBankAccounts(companyId?: string | null): Promise<BankAccount[]>;
  getBankAccount(id: string): Promise<BankAccount | undefined>;
  findBankAccount(bankName: string, accountNumber: string, companyId?: string | null): Promise<BankAccount | undefined>;
  createBankAccount(bankAccount: InsertBankAccount): Promise<BankAccount>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getUsers(companyId: string): Promise<User[]>;

  // Companies
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByCnpj(cnpj: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  setCompanyActive(id: string, isActive: boolean): Promise<Company | undefined>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  private database: NonNullable<typeof db>;

  constructor() {
    if (!process.env.DATABASE_URL || !db) {
      throw new Error("DATABASE_URL must be set to use DatabaseStorage.");
    }
    this.database = db;
    // Usa MemoryStore para sessões (evita dependência do table.sql do connect-pg-simple em produção)
    this.sessionStore = new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 });
  }

  // ─── Statements ────────────────────────────────────────────────────────────
  async getStatements(companyId?: string | null): Promise<Statement[]> {
    if (companyId === null || companyId === undefined) {
      return await this.database.select().from(statements).orderBy(desc(statements.createdAt));
    }
    return await this.database
      .select()
      .from(statements)
      .where(eq(statements.companyId, companyId))
      .orderBy(desc(statements.createdAt));
  }

  async getStatement(id: string): Promise<Statement | undefined> {
    const [s] = await this.database.select().from(statements).where(eq(statements.id, id));
    return s;
  }

  async createStatement(insertStatement: InsertStatement): Promise<Statement> {
    const [s] = await this.database.insert(statements).values(insertStatement).returning();
    return s;
  }

  async updateStatement(id: string, data: any): Promise<Statement | undefined> {
    const [s] = await this.database
      .update(statements)
      .set({ data })
      .where(eq(statements.id, id))
      .returning();
    return s;
  }

  async deleteStatement(id: string): Promise<void> {
    await this.database.delete(statements).where(eq(statements.id, id));
  }

  // ─── Bank Accounts ─────────────────────────────────────────────────────────
  async getBankAccounts(companyId?: string | null): Promise<BankAccount[]> {
    if (companyId === null || companyId === undefined) {
      return await this.database.select().from(bankAccounts);
    }
    return await this.database
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.companyId, companyId));
  }

  async getBankAccount(id: string): Promise<BankAccount | undefined> {
    const [a] = await this.database.select().from(bankAccounts).where(eq(bankAccounts.id, id));
    return a;
  }

  async findBankAccount(
    bankName: string,
    accountNumber: string,
    companyId?: string | null,
  ): Promise<BankAccount | undefined> {
    const conditions = [
      sql`LOWER(${bankAccounts.bankName}) = LOWER(${bankName})`,
      sql`LOWER(${bankAccounts.accountNumber}) = LOWER(${accountNumber})`,
    ];
    if (companyId) conditions.push(eq(bankAccounts.companyId, companyId));
    const [a] = await this.database
      .select()
      .from(bankAccounts)
      .where(and(...conditions));
    return a;
  }

  async createBankAccount(bankAccount: InsertBankAccount): Promise<BankAccount> {
    const [a] = await this.database.insert(bankAccounts).values(bankAccount).returning();
    return a;
  }

  // ─── Users ─────────────────────────────────────────────────────────────────
  async getUser(id: string): Promise<User | undefined> {
    const [u] = await this.database.select().from(users).where(eq(users.id, id));
    return u;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [u] = await this.database.select().from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`);
    return u;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [u] = await this.database.insert(users).values(insertUser).returning();
    return u;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [u] = await this.database
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return u;
  }

  async getUsers(companyId: string): Promise<User[]> {
    return await this.database
      .select()
      .from(users)
      .where(eq(users.companyId, companyId));
  }

  // ─── Companies ─────────────────────────────────────────────────────────────
  async getCompanies(): Promise<Company[]> {
    return await this.database.select().from(companies).orderBy(desc(companies.createdAt));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [c] = await this.database.select().from(companies).where(eq(companies.id, id));
    return c;
  }

  async getCompanyByCnpj(cnpj: string): Promise<Company | undefined> {
    const [c] = await this.database.select().from(companies).where(eq(companies.cnpj, cnpj));
    return c;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [c] = await this.database.insert(companies).values(company).returning();
    return c;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [c] = await this.database
      .update(companies)
      .set(data)
      .where(eq(companies.id, id))
      .returning();
    return c;
  }

  async setCompanyActive(id: string, isActive: boolean): Promise<Company | undefined> {
    const [c] = await this.database
      .update(companies)
      .set({ isActive })
      .where(eq(companies.id, id))
      .returning();
    return c;
  }
}

export class MemoryStorage implements IStorage {
  sessionStore: session.Store;

  private statementsData: Statement[] = [];
  private bankAccountsData: BankAccount[] = [];
  private usersData: User[] = [];
  private companiesData: Company[] = [];

  constructor() {
    this.sessionStore = new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 });
  }

  async getStatements(companyId?: string | null): Promise<Statement[]> {
    const rows =
      companyId === null || companyId === undefined
        ? this.statementsData
        : this.statementsData.filter((s) => s.companyId === companyId);
    return rows
      .slice()
      .sort(
        (a, b) =>
          (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
          (a.createdAt ? new Date(a.createdAt).getTime() : 0),
      );
  }

  async getStatement(id: string): Promise<Statement | undefined> {
    return this.statementsData.find((s) => s.id === id);
  }

  async createStatement(statement: InsertStatement): Promise<Statement> {
    const row: Statement = {
      id: randomUUID(),
      filename: statement.filename,
      bankAccountId: statement.bankAccountId ?? null,
      companyId: statement.companyId ?? null,
      data: statement.data as any,
      createdAt: new Date() as any,
    };
    this.statementsData.push(row);
    return row;
  }

  async updateStatement(id: string, data: any): Promise<Statement | undefined> {
    const row = this.statementsData.find((s) => s.id === id);
    if (!row) return undefined;
    (row as any).data = data;
    return row;
  }

  async deleteStatement(id: string): Promise<void> {
    this.statementsData = this.statementsData.filter((s) => s.id !== id);
  }

  async getBankAccounts(companyId?: string | null): Promise<BankAccount[]> {
    if (companyId === null || companyId === undefined) return this.bankAccountsData.slice();
    return this.bankAccountsData.filter((a) => a.companyId === companyId);
  }

  async getBankAccount(id: string): Promise<BankAccount | undefined> {
    return this.bankAccountsData.find((a) => a.id === id);
  }

  async findBankAccount(
    bankName: string,
    accountNumber: string,
    companyId?: string | null,
  ): Promise<BankAccount | undefined> {
    return this.bankAccountsData.find((a) => {
      const matchesBase =
        a.bankName?.toLowerCase() === bankName.toLowerCase() &&
        a.accountNumber?.toLowerCase() === accountNumber.toLowerCase();
      if (!matchesBase) return false;
      if (!companyId) return true;
      return a.companyId === companyId;
    });
  }

  async createBankAccount(bankAccount: InsertBankAccount): Promise<BankAccount> {
    const row: BankAccount = {
      id: randomUUID(),
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
      agency: bankAccount.agency ?? null,
      companyName: bankAccount.companyName ?? null,
      companyId: bankAccount.companyId ?? null,
      createdAt: new Date() as any,
    };
    this.bankAccountsData.push(row);
    return row;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.usersData.find((u) => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.usersData.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  async createUser(user: InsertUser): Promise<User> {
    const row: User = {
      id: randomUUID(),
      username: user.username,
      password: user.password,
      name: user.name ?? null,
      role: user.role ?? "user",
      companyId: user.companyId ?? null,
      isActive: user.isActive ?? true,
      createdAt: new Date() as any,
    };
    this.usersData.push(row);
    return row;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const row = this.usersData.find((u) => u.id === id);
    if (!row) return undefined;
    Object.assign(row as any, data);
    return row;
  }

  async getUsers(companyId: string): Promise<User[]> {
    return this.usersData.filter((u) => u.companyId === companyId);
  }

  async getCompanies(): Promise<Company[]> {
    return this.companiesData
      .slice()
      .sort(
        (a, b) =>
          (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
          (a.createdAt ? new Date(a.createdAt).getTime() : 0),
      );
  }

  async getCompany(id: string): Promise<Company | undefined> {
    return this.companiesData.find((c) => c.id === id);
  }

  async getCompanyByCnpj(cnpj: string): Promise<Company | undefined> {
    return this.companiesData.find((c) => c.cnpj === cnpj);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const row: Company = {
      id: randomUUID(),
      cnpj: company.cnpj,
      name: company.name,
      email: company.email ?? null,
      phone: company.phone ?? null,
      address: company.address ?? null,
      isActive: company.isActive ?? true,
      createdAt: new Date() as any,
    };
    this.companiesData.push(row);
    return row;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const row = this.companiesData.find((c) => c.id === id);
    if (!row) return undefined;
    Object.assign(row as any, data);
    return row;
  }

  async setCompanyActive(id: string, isActive: boolean): Promise<Company | undefined> {
    const row = this.companiesData.find((c) => c.id === id);
    if (!row) return undefined;
    (row as any).isActive = isActive;
    return row;
  }
}

export const storage: IStorage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemoryStorage();
