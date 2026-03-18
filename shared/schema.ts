import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cnpj: text("cnpj").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role").notNull().default("user"),
  companyId: varchar("company_id").references(() => companies.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  agency: text("agency"),
  companyName: text("company_name"),
  companyId: varchar("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const statements = pgTable("statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  bankAccountId: varchar("bank_account_id").references(() => bankAccounts.id),
  companyId: varchar("company_id").references(() => companies.id),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true, createdAt: true });
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;

export const statementRowSchema = z.object({
  date: z.string().optional(),
  description: z.string(),
  amount: z.number(),
  type: z.enum(["debit", "credit"]),
});
export type StatementRow = z.infer<typeof statementRowSchema>;

export const insertStatementSchema = createInsertSchema(statements).omit({ id: true, createdAt: true });
export const updateStatementSchema = z.object({ data: z.array(statementRowSchema) });
export type InsertStatement = z.infer<typeof insertStatementSchema>;
export type UpdateStatement = z.infer<typeof updateStatementSchema>;
export type Statement = typeof statements.$inferSelect;
