import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Building2, Loader2, Pencil, Power, Save, UserPlus, Users } from "lucide-react";

type Company = { id: string; cnpj: string; name: string; email?: string; phone?: string; address?: string; isActive: boolean };
type CompanyUser = { id: string; username: string; name?: string; role: string; isActive: boolean };

function cnpjFmt(v: string) { return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); }
function parseErr(err: any) { const raw = err?.message?.includes(":") ? err.message.split(":").slice(1).join(":").trim() : err?.message; let t = raw; try { t = JSON.parse(raw)?.message || raw; } catch {} return t || "Erro."; }

function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "user" });
  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/company/users", form),
    onSuccess: () => { toast({ title: "Usuário criado." }); queryClient.invalidateQueries({ queryKey: ["/api/company/users"] }); onClose(); setForm({ username: "", password: "", name: "", role: "user" }); },
    onError: (e: any) => toast({ title: "Erro", description: parseErr(e), variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Usuário</DialogTitle><DialogDescription>Criar usuário para sua empresa.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nome</Label><Input placeholder="Nome completo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>Usuário *</Label><Input placeholder="login" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="rounded-xl" data-testid="input-new-username" /></div>
          <div className="space-y-1"><Label>Senha *</Label><Input type="password" placeholder="••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>Perfil</Label>
            <select className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="user">Usuário</option>
              <option value="company_admin">Admin da Empresa</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.username || !form.password} data-testid="button-create-user">{mut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CompanyProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = (user as any)?.role;
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);

  const { data: company, isLoading: loadingCompany } = useQuery<Company>({
    queryKey: ["/api/company"],
    enabled: !!(user as any)?.companyId,
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery<CompanyUser[]>({
    queryKey: ["/api/company/users"],
    enabled: !!(user as any)?.companyId && role !== "user",
  });

  const [companyForm, setCompanyForm] = useState({ name: "", email: "", phone: "", address: "" });

  const saveCompany = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/company", companyForm),
    onSuccess: () => { toast({ title: "Dados atualizados." }); queryClient.invalidateQueries({ queryKey: ["/api/company"] }); setEditingCompany(false); },
    onError: (e: any) => toast({ title: "Erro", description: parseErr(e), variant: "destructive" }),
  });

  const toggleUser = useMutation({
    mutationFn: (u: CompanyUser) => apiRequest("PATCH", `/api/company/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/company/users"] }),
    onError: (e: any) => toast({ title: "Erro", description: parseErr(e), variant: "destructive" }),
  });

  const startEdit = () => {
    if (company) setCompanyForm({ name: company.name, email: company.email || "", phone: company.phone || "", address: company.address || "" });
    setEditingCompany(true);
  };

  if (!(user as any)?.companyId) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
          <Building2 className="w-12 h-12 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">Usuário administrador não está vinculado a uma empresa.</p>
          <p className="text-sm text-muted-foreground">Use o Painel Admin para gerenciar empresas.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Building2 className="w-8 h-8 text-primary" /> Perfil da Empresa</h1>
          <p className="text-muted-foreground mt-1">Gerencie os dados da sua empresa e usuários</p>
        </div>

        {/* Company Data */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Dados Cadastrais</h2>
            {role !== "user" && !editingCompany && (
              <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={startEdit} data-testid="button-edit-company"><Pencil className="w-4 h-4" />Editar</Button>
            )}
          </div>

          {loadingCompany ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : company ? (
            editingCompany ? (
              <div className="space-y-3">
                <div className="space-y-1"><Label>Nome *</Label><Input value={companyForm.name} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" data-testid="input-company-name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={companyForm.email} onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))} className="rounded-xl" /></div>
                  <div className="space-y-1"><Label>Telefone</Label><Input value={companyForm.phone} onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl" /></div>
                </div>
                <div className="space-y-1"><Label>Endereço</Label><Input value={companyForm.address} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))} className="rounded-xl" /></div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending || !companyForm.name} className="rounded-xl gap-2" data-testid="button-save-company">{saveCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar</Button>
                  <Button variant="outline" onClick={() => setEditingCompany(false)} className="rounded-xl">Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "CNPJ", value: cnpjFmt(company.cnpj) },
                  { label: "Razão Social", value: company.name },
                  { label: "E-mail", value: company.email || "—" },
                  { label: "Telefone", value: company.phone || "—" },
                  { label: "Endereço", value: company.address || "—" },
                  { label: "Status", value: company.isActive ? "Ativa" : "Inativa" },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{f.label}</p>
                    <p className="font-medium">{f.value}</p>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>

        {/* Users */}
        {role !== "user" && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Usuários da Empresa</h2>
              <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={() => setAddUserOpen(true)} data-testid="button-add-user"><UserPlus className="w-4 h-4" />Novo Usuário</Button>
            </div>

            {loadingUsers ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : users.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className={`flex items-center justify-between px-4 py-3 rounded-xl bg-muted/40 border border-border ${!u.isActive ? "opacity-50" : ""}`}>
                    <div>
                      <span className="font-medium">{u.username}</span>
                      {u.name && <span className="text-sm text-muted-foreground ml-2">({u.name})</span>}
                      <Badge variant="outline" className="ml-2 text-[10px]">{u.role === "company_admin" ? "Admin" : "Usuário"}</Badge>
                      {!u.isActive && <Badge variant="secondary" className="ml-1 text-[10px]">Inativo</Badge>}
                    </div>
                    <Button size="icon" variant="ghost" className={`h-8 w-8 ${u.isActive ? "text-destructive" : "text-green-600"}`} onClick={() => toggleUser.mutate(u)} title={u.isActive ? "Desativar" : "Ativar"} disabled={toggleUser.isPending} data-testid={`button-toggle-user-${u.id}`}>{toggleUser.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-4 h-4" />}</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AddUserDialog open={addUserOpen} onClose={() => setAddUserOpen(false)} />
    </Layout>
  );
}
