import { Link, useLocation } from "wouter";
import { FileText, LayoutDashboard, History, LogOut, Menu, X, User as UserIcon, Shield, Building2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoV9 from "@assets/v92026_1772051277435.png";

interface LayoutProps { children: React.ReactNode; }

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logoutMutation } = useAuth();
  const role = (user as any)?.role;

  const { data: company } = useQuery<{ name: string } | null>({
    queryKey: ["/api/company"],
    enabled: !!(user as any)?.companyId,
    retry: false,
  });

  const mainNav = [
    { name: "Painel", path: "/", icon: LayoutDashboard },
    { name: "Histórico", path: "/history", icon: History },
  ];

  const handleLogout = () => logoutMutation.mutate();

  const NavLink = ({ item, onClick }: { item: { name: string; path: string; icon: any }; onClick?: () => void }) => (
    <Link
      href={item.path}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group relative overflow-hidden",
        location === item.path
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
      )}
      onClick={onClick}
      data-testid={`nav-${item.path.replace("/", "") || "home"}`}
    >
      {location !== item.path && <div className="absolute inset-0 bg-primary/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-out" />}
      <item.icon className="w-5 h-5 relative z-10" />
      <span className="relative z-10">{item.name}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border shadow-sm z-20 relative">
        <div className="flex items-center gap-2 text-primary font-bold text-xl">
          <FileText className="w-6 h-6" /><span>ExtratoAI</span>
        </div>
        <div className="flex items-center gap-2">
          {user && <span className="text-xs font-medium text-muted-foreground mr-2">{(user as any).username}</span>}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-muted-foreground hover:bg-muted rounded-md transition-colors">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[73px] z-10 bg-background/80 backdrop-blur-sm">
          <div className="bg-card p-4 flex flex-col gap-2 shadow-lg">
            {mainNav.map(item => <NavLink key={item.path} item={item} onClick={() => setIsMobileMenuOpen(false)} />)}
            {role === "admin" && (
              <Link href="/admin" className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all", location === "/admin" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-primary/5 hover:text-primary")} onClick={() => setIsMobileMenuOpen(false)}>
                <Shield className="w-5 h-5" />Painel Admin
              </Link>
            )}
            {(user as any)?.companyId && (
              <Link href="/company" className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all", location === "/company" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-primary/5 hover:text-primary")} onClick={() => setIsMobileMenuOpen(false)}>
                <Building2 className="w-5 h-5" />Minha Empresa
              </Link>
            )}
            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-destructive hover:bg-destructive/10 transition-all mt-2 border-t border-border pt-4" data-testid="button-logout-mobile">
              <LogOut className="w-5 h-5" />Sair
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-col bg-card border-r border-border min-h-screen shadow-sm sticky top-0 print:hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 text-primary font-bold text-2xl tracking-tight">
            <div className="p-1 bg-white rounded-lg border border-border overflow-hidden">
              <img src={logoV9} alt="V9 Informática" className="w-10 h-10 object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="leading-tight text-lg">ExtratoAI</span>
              <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-widest">por V9 Informática</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 flex flex-col gap-1">
          <p className="text-xs font-semibold text-muted-foreground mb-2 px-4 uppercase tracking-wider">Menu Principal</p>
          {mainNav.map(item => <NavLink key={item.path} item={item} />)}

          {role === "admin" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground mt-4 mb-2 px-4 uppercase tracking-wider">Administração</p>
              <Link
                href="/admin"
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group relative overflow-hidden", location === "/admin" ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-primary/5 hover:text-primary")}
                data-testid="nav-admin"
              >
                {location !== "/admin" && <div className="absolute inset-0 bg-primary/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-out" />}
                <Shield className="w-5 h-5 relative z-10" />
                <span className="relative z-10 flex-1">Painel Admin</span>
                <Badge variant="secondary" className="text-[10px] relative z-10">Admin</Badge>
              </Link>
            </>
          )}

          {(user as any)?.companyId && (
            <>
              <p className="text-xs font-semibold text-muted-foreground mt-4 mb-2 px-4 uppercase tracking-wider">Empresa</p>
              <Link
                href="/company"
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group relative overflow-hidden", location === "/company" ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-primary/5 hover:text-primary")}
                data-testid="nav-company"
              >
                {location !== "/company" && <div className="absolute inset-0 bg-primary/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-out" />}
                <Building2 className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Minha Empresa</span>
              </Link>
            </>
          )}
        </nav>

        <div className="p-6 mt-auto border-t border-border">
          {user && (
            <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-muted/50 rounded-2xl">
              <div className="p-2 bg-primary/10 rounded-full">
                <UserIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold truncate">{(user as any).username}</span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  {role === "admin" ? "Administrador" : role === "company_admin" ? "Admin Empresa" : "Usuário"}
                </span>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 px-4 py-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-bold">Sair do Sistema</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden print:overflow-visible print:block">
<div className="p-4 sm:p-8 flex-1 w-full max-w-7xl mx-auto print:p-0 print:max-w-none print:m-0">
          {children}
        </div>
      </main>
    </div>
  );
}
