import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Building2, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Power, Search, UserPlus, Users } from "lucide-react";

type Company = { id: string; cnpj: string; name: string; email?: string; phone?: string; address?: string; isActive: boolean; createdAt: string };
type CompanyUser = { id: string; username: string; name?: string; role: string; isActive: boolean };

function cnpjFmt(v: string) { return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); }
function parseErr(err: any) { const raw = err?.message?.includes(":") ? err.message.split(":").slice(1).join(":").trim() : err?.message; let t = raw; try { t = JSON.parse(raw)?.message || raw; } catch {} return t || "Erro desconhecido."; }

// ─── Dialogs ────────────────────────────────────────────────────────────────

function AddUserDialog({ open, onClose, companyId }: { open: boolean; onClose: () => void; companyId: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "user" });
  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/users", { ...form, companyId }),
    onSuccess: () => { toast({ title: "Usuário criado." }); queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", companyId, "users"] }); onClose(); setForm({ username: "", password: "", name: "", role: "user" }); },
    onError: (e: any) => toast({ title: "Erro", description: parseErr(e), variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Usuário</DialogTitle><DialogDescription>Criar usuário vinculado à empresa.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nome</Label><Input placeholder="Nome completo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>Usuário *</Label><Input placeholder="login" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="rounded-xl" /></div>
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
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.username || !form.password}>{mut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCompanyDialog({ open, onClose, company, onSuccess }: { open: boolean; onClose: () => void; company: Company; onSuccess: () => void }) {
  const { toast } = useToast();
  const [cnpjDisplay, setCnpjDisplay] = useState(cnpjFmt(company.cnpj));
  const [form, setForm] = useState({ cnpj: company.cnpj, name: company.name, email: company.email || "", phone: company.phone || "", address: company.address || "", isActive: company.isActive });
  useEffect(() => { setForm({ cnpj: company.cnpj, name: company.name, email: company.email || "", phone: company.phone || "", address: company.address || "", isActive: company.isActive }); setCnpjDisplay(cnpjFmt(company.cnpj)); }, [company]);

  const handleCnpj = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 14); setForm(f => ({ ...f, cnpj: d })); setCnpjDisplay(d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")); };
  const mut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/companies/${company.id}`, form),
    onSuccess: () => { toast({ title: "Empresa atualizada." }); onSuccess(); onClose(); },
    onError: (e: any) => toast({ title: "Erro", description: parseErr(e), variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Empresa</DialogTitle><DialogDescription>Atualizar dados da empresa.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>CNPJ *</Label><Input value={cnpjDisplay} onChange={e => handleCnpj(e.target.value)} className="rounded-xl" /><p className="text-[11px] text-muted-foreground">Somente números</p></div>
          <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="rounded-xl" /></div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
            <div><p className="text-sm font-medium">Status</p><p className="text-xs text-muted-foreground">{form.isActive ? "Empresa ativa" : "Empresa inativa"}</p></div>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))} className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-muted-foreground/30"}`} data-testid="toggle-company-active">
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.name || form.cnpj.length !== 14} data-testid="button-save-company-edit">{mut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ cnpj: "", name: "", email: "", phone: "", address: "", isActive: true });
  const [cnpjDisplay, setCnpjDisplay] = useState("");
  const handleCnpj = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 14); setForm(f => ({ ...f, cnpj: d })); setCnpjDisplay(d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")); };
  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/companies", form),
    onSuccess: () => { toast({ title: "Empresa criada." }); queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] }); onClose(); setForm({ cnpj: "", name: "", email: "", phone: "", address: "", isActive: true }); setCnpjDisplay(""); },
    onError: (e: any) => toast({ title: "Erro", description: parseErr(e), variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova Empresa</DialogTitle><DialogDescription>Cadastrar empresa no sistema.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>CNPJ *</Label><Input data-testid="input-cnpj" placeholder="00.000.000/0000-00" value={cnpjDisplay} onChange={e => handleCnpj(e.target.value)} className="rounded-xl" /><p className="text-[11px] text-muted-foreground">Somente números</p></div>
          <div className="space-y-1"><Label>Nome *</Label><Input data-testid="input-company-name" placeholder="Razão social" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="rounded-xl" /></div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
            <div><p className="text-sm font-medium">Status inicial</p><p className="text-xs text-muted-foreground">{form.isActive ? "Ativa" : "Inativa"}</p></div>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))} className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-muted-foreground/30"}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button data-testid="button-create-company" onClick={() => mut.mutate()} disabled={mut.isPending || form.cnpj.length !== 14 || !form.name}>{mut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Criar Empresa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompanyRow({ company }: { company: Company }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);

  const { data: users = [], refetch } = useQuery<CompanyUser[]>({
    queryKey: ["/api/admin/companies", company.id, "users"],
    queryFn: async () => { const r = await fetch(`/api/admin/companies/${company.id}/users`, { credentials: "include" }); return r.json(); },
    enabled: expanded,
  });

  const toggleUser = useMutation({
    mutationFn: (u: CompanyUser) => apiRequest("PATCH", `/api/admin/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: () => refetch(),
    onError: (e: any) => toast({ title: "Erro", description: parseErr(e), variant: "destructive" }),
  });

  const toggleCompany = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/companies/${company.id}`, { isActive: !company.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] }),
    onError: (e: any) => toast({ title: "Erro", description: parseErr(e), variant: "destructive" }),
  });

  return (
    <>
      <div className={`rounded-2xl border border-border p-4 space-y-2 transition-all ${!company.isActive ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setExpanded(e => !e)} className="flex-1 flex items-center gap-3 text-left min-w-0">
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <Building2 className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold truncate">{company.name}</p>
              <p className="text-xs text-muted-foreground">{cnpjFmt(company.cnpj)}</p>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={company.isActive ? "default" : "secondary"}>{company.isActive ? "Ativa" : "Inativa"}</Badge>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditOpen(true)} title="Editar empresa" data-testid={`button-edit-company-${company.id}`}><Pencil className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className={`h-8 w-8 ${company.isActive ? "text-destructive" : "text-green-600"}`} onClick={() => toggleCompany.mutate()} title={company.isActive ? "Desativar" : "Ativar"} data-testid={`button-toggle-company-${company.id}`} disabled={toggleCompany.isPending}>{toggleCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}</Button>
          </div>
        </div>

        {(company.email || company.phone || company.address) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-12 text-xs text-muted-foreground">
            {company.email && <span>{company.email}</span>}
            {company.phone && <span>{company.phone}</span>}
            {company.address && <span>{company.address}</span>}
          </div>
        )}

        {expanded && (
          <div className="pl-12 mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3" /> Usuários</p>
              <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => setAddUserOpen(true)} data-testid={`button-add-user-${company.id}`}><UserPlus className="w-3 h-3 mr-1" />Novo usuário</Button>
            </div>
            {users.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum usuário cadastrado.</p>
            ) : users.map(u => (
              <div key={u.id} className={`flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 ${!u.isActive ? "opacity-50" : ""}`}>
                <div>
                  <span className="text-sm font-medium">{u.username}</span>
                  {u.name && <span className="text-xs text-muted-foreground ml-2">({u.name})</span>}
                  <Badge variant="outline" className="ml-2 text-[10px] h-4">{u.role === "company_admin" ? "Admin" : "Usuário"}</Badge>
                </div>
                <Button size="icon" variant="ghost" className={`h-7 w-7 ${u.isActive ? "text-destructive" : "text-green-600"}`} onClick={() => toggleUser.mutate(u)} title={u.isActive ? "Desativar" : "Ativar"} data-testid={`button-toggle-user-${u.id}`} disabled={toggleUser.isPending}><Power className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditCompanyDialog open={editOpen} onClose={() => setEditOpen(false)} company={company} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] })} />
      <AddUserDialog open={addUserOpen} onClose={() => setAddUserOpen(false)} companyId={company.id} />
    </>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { if (user && (user as any).role !== "admin") setLocation("/"); }, [user]);

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
    enabled: !!(user && (user as any).role === "admin"),
  });

  if (user && (user as any).role !== "admin") return null;

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search.replace(/\D/g, ""))
  );

  const active = companies.filter(c => c.isActive).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Building2 className="w-8 h-8 text-primary" /> Painel Administrativo</h1>
            <p className="text-muted-foreground mt-1">Gerencie todas as empresas e usuários do sistema</p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="rounded-xl gap-2" data-testid="button-new-company"><Plus className="w-4 h-4" />Nova Empresa</Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total de Empresas", value: companies.length, color: "text-primary" },
            { label: "Empresas Ativas", value: active, color: "text-green-600" },
            { label: "Empresas Inativas", value: companies.length - active, color: "text-destructive" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
              <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar empresa por nome ou CNPJ..." className="pl-9 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-companies" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{search ? "Nenhuma empresa encontrada." : "Nenhuma empresa cadastrada ainda."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => <CompanyRow key={c.id} company={c} />)}
          </div>
        )}
      </div>

      <AddCompanyDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </Layout>
  );
}
