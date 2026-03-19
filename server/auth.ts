import express, { type Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { type User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export { hashPassword, comparePasswords };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado." });
  const user = req.user as any;
  if (!user.isActive) return res.status(403).json({ message: "Usuário inativo." });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado." });
  const user = req.user as any;
  if (user.role !== "admin") return res.status(403).json({ message: "Acesso restrito ao administrador." });
  next();
}

export function getCompanyId(req: Request): string | null {
  const user = req.user as any;
  if (!user) return null;
  if (user.role === "admin") return null;
  return user.companyId || null;
}

export function setupAuth(app: express.Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "v9-informatica-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: app.get("env") === "production",
      maxAge: 24 * 60 * 60 * 1000,
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ passReqToCallback: true }, async (req, username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        if (!user.isActive) return done(null, false);

        if (user.companyId) {
          const company = await storage.getCompany(user.companyId);
          if (company && !company.isActive) return done(null, false);

          // Non-admin users must provide the correct CNPJ
          if (user.role !== "admin") {
            const cnpj = (req.body.cnpj || "").replace(/\D/g, "");
            if (!cnpj) return done(null, false);
            if (!company || company.cnpj !== cnpj) return done(null, false);
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    const { password, ...safeUser } = req.user as any;
    res.status(200).json(safeUser);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...safeUser } = req.user as any;
    res.json(safeUser);
  });
}
