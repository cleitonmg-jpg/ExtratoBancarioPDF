import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, Building2 } from "lucide-react";
import { Link } from "wouter";
import { useLocation } from "wouter";

/** Format a raw digit string as XX.XXX.XXX/XXXX-XX */
function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export default function LoginPage() {
  const { user, loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [cnpj, setCnpj] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatCnpj(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password, cnpj: cnpj.replace(/\D/g, "") });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-2xl rounded-3xl overflow-hidden" data-testid="card-login">
        <div className="bg-primary p-6 text-primary-foreground text-center relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-90" />
          <CardTitle className="text-2xl font-bold">V9 INFORMÁTICA</CardTitle>
          <CardDescription className="text-primary-foreground/80 mt-1">Acesse sua conta para gerenciar extratos</CardDescription>
        </div>
        <CardHeader className="pt-8 pb-2">
          <CardTitle className="text-xl text-center">Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ da Empresa</Label>
              <Input
                id="cnpj"
                data-testid="input-cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={handleCnpjChange}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Administradores podem deixar em branco</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                data-testid="input-username"
                placeholder="Seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full rounded-xl h-12 text-base font-bold mt-2"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : null}
              Entrar
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">Ainda não tem conta?</p>
            <Link href="/register" className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium mt-1" data-testid="link-register">
              <Building2 className="w-4 h-4" /> Faça seu cadastro
            </Link>
          </div>

          <div className="mt-6 pt-4 border-t border-border text-center text-xs text-muted-foreground">
            © 2026 V9 INFORMÁTICA - Todos os direitos reservados
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
