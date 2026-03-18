import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, Building2, CheckCircle } from "lucide-react";
import logoV9 from "@assets/v92026_1772051277435.png";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cnpjDisplay, setCnpjDisplay] = useState("");
  const [form, setForm] = useState({
    cnpj: "", companyName: "", email: "", phone: "", address: "",
    username: "", password: "", confirmPassword: "",
  });

  const handleCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    setForm(f => ({ ...f, cnpj: d }));
    setCnpjDisplay(d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.cnpj.length !== 14) { toast({ title: "CNPJ inválido", description: "Digite 14 dígitos.", variant: "destructive" }); return; }
    if (form.password !== form.confirmPassword) { toast({ title: "Senhas não coincidem", variant: "destructive" }); return; }
    if (form.password.length < 4) { toast({ title: "Senha muito curta", description: "Mínimo 4 caracteres.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Erro", description: data.message, variant: "destructive" }); return; }
      setDone(true);
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-3xl shadow-xl">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h2 className="text-2xl font-bold">Cadastro realizado!</h2>
            <p className="text-muted-foreground">Sua empresa foi cadastrada com sucesso. Faça login para começar.</p>
            <Button className="w-full mt-2 rounded-xl" onClick={() => setLocation("/login")} data-testid="button-go-login">
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg rounded-3xl shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="p-2 bg-white rounded-2xl border border-border shadow-sm">
              <img src={logoV9} alt="V9 Informática" className="w-12 h-12 object-contain" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Cadastro de Nova Empresa
          </CardTitle>
          <CardDescription>Preencha os dados para criar sua conta no ExtratoAI</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-muted/40 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</p>
              <div className="space-y-1">
                <Label>CNPJ *</Label>
                <Input data-testid="input-cnpj" placeholder="00.000.000/0000-00" value={cnpjDisplay} onChange={e => handleCnpj(e.target.value)} className="rounded-xl" required />
              </div>
              <div className="space-y-1">
                <Label>Nome / Razão Social *</Label>
                <Input data-testid="input-company-name" placeholder="Empresa LTDA" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} className="rounded-xl" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <Input type="email" placeholder="contato@empresa.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label>Telefone</Label>
                  <Input placeholder="(00) 00000-0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Endereço</Label>
                <Input placeholder="Rua, número, cidade" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            <div className="bg-muted/40 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados de Acesso (Admin)</p>
              <div className="space-y-1">
                <Label>Usuário *</Label>
                <Input data-testid="input-username" placeholder="login" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="rounded-xl" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Senha *</Label>
                  <Input data-testid="input-password" type="password" placeholder="••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="rounded-xl" required />
                </div>
                <div className="space-y-1">
                  <Label>Confirmar Senha *</Label>
                  <Input data-testid="input-confirm-password" type="password" placeholder="••••••" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} className="rounded-xl" required />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl" disabled={loading} data-testid="button-register">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cadastrar Empresa
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <button type="button" onClick={() => setLocation("/login")} className="text-primary hover:underline font-medium">
                Fazer login
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
