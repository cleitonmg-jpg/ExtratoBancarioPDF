import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

// Define a type for the uploaded statement response based on the API contract
export type UploadedStatementResponse = {
  id: string;
  filename: string;
  data: Array<{
    date?: string;
    description: string;
    amount: number;
    type: "debit" | "credit";
  }>;
  createdAt?: string;
};

export function useBankAccounts() {
  return useQuery({
    queryKey: [api.bankAccounts.list.path],
    queryFn: async () => {
      const res = await fetch(api.bankAccounts.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar contas bancárias");
      return res.json();
    },
  });
}

export function useStatements() {
  return useQuery({
    queryKey: [api.statements.list.path],
    queryFn: async () => {
      const res = await fetch(api.statements.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar extratos");
      const data = await res.json();
      // Parsing through Zod ensures runtime safety
      return api.statements.list.responses[200].parse(data);
    },
  });
}

export function useStatement(id: string) {
  return useQuery({
    queryKey: [api.statements.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.statements.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Falha ao carregar o extrato");
      const data = await res.json();
      return api.statements.get.responses[200].parse(data);
    },
    enabled: !!id,
  });
}

export function useUploadStatement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (file: File): Promise<UploadedStatementResponse> => {
      const formData = new FormData();
      formData.append("pdf", file);

      const res = await fetch(api.statements.upload.path, {
        method: api.statements.upload.method,
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        let errorMessage = "Falha ao processar o extrato";
        try {
          const errorData = await res.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const data = await res.json();
      return api.statements.upload.responses[200].parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.statements.list.path] });
    },
  });
}

export function useUpdateStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const url = buildUrl(api.statements.update.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Falha ao atualizar o extrato");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.statements.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.statements.get.path, variables.id] });
    },
  });
}

export function useDeleteStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const url = buildUrl(api.statements.get.path, { id });
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Falha ao excluir o extrato");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.statements.list.path] });
    },
  });
}
