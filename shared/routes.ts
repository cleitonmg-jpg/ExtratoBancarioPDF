import { z } from "zod";
import { statementRowSchema, statements } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  bankAccounts: {
    list: {
      method: 'GET' as const,
      path: '/api/bank-accounts' as const,
      responses: {
        200: z.array(z.custom<any>()),
      }
    }
  },
  statements: {
    upload: {
      method: 'POST' as const,
      path: '/api/statements/upload' as const,
      responses: {
        200: z.object({
          id: z.string(),
          filename: z.string(),
          data: z.array(statementRowSchema),
          createdAt: z.string().optional()
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      }
    },
    list: {
      method: 'GET' as const,
      path: '/api/statements' as const,
      responses: {
        200: z.array(z.custom<typeof statements.$inferSelect>()),
        500: errorSchemas.internal,
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/statements/:id' as const,
      responses: {
        200: z.custom<typeof statements.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/statements/:id' as const,
      input: z.object({
        data: z.array(statementRowSchema)
      }),
      responses: {
        200: z.custom<typeof statements.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
