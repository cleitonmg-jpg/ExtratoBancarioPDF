import { Layout } from "@/components/layout";
import { useStatements, useDeleteStatement } from "@/hooks/use-statements";
import { Link } from "wouter";
import { FileText, Calendar, ChevronRight, Search, FileX, Trash2, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function HistoryPage() {
  const { data: statements, isLoading, error } = useStatements();
  const deleteMutation = useDeleteStatement();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("Tem certeza que deseja excluir este extrato?")) return;

    try {
      await deleteMutation.mutateAsync(id);
      toast({
        title: "Sucesso",
        description: "Extrato excluído com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao excluir o extrato.",
        variant: "destructive"
      });
    }
  };

  const filteredStatements = statements?.filter(s => 
    s.filename.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Histórico</h1>
            <p className="text-muted-foreground mt-1">Acesse seus extratos processados anteriormente.</p>
          </div>
          
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome de arquivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6 h-32 animate-pulse">
                <div className="h-6 bg-muted rounded-md w-3/4 mb-4"></div>
                <div className="h-4 bg-muted rounded-md w-1/2"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 p-6 rounded-2xl text-destructive text-center">
            <p className="font-medium">Erro ao carregar o histórico.</p>
            <p className="text-sm mt-1 opacity-80">{(error as Error).message}</p>
          </div>
        ) : filteredStatements.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <FileX className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum extrato encontrado</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {searchTerm 
                ? "Nenhum resultado corresponde à sua busca. Tente um termo diferente."
                : "Você ainda não processou nenhum extrato. Faça o upload do seu primeiro arquivo na página inicial."}
            </p>
            {!searchTerm && (
              <Link href="/" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm">
                Processar Primeiro Extrato
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStatements.map((statement) => (
              <Link 
                key={statement.id} 
                href={`/statement/${statement.id}`}
                className="group block bg-card hover:bg-muted/30 border border-border rounded-2xl p-5 transition-all duration-300 hover:shadow-md hover:border-primary/30 hover:-translate-y-1 relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(e, statement.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Excluir extrato"
                    >
                      {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
                
                <h3 className="font-semibold text-foreground truncate" title={statement.filename}>
                  {statement.filename}
                </h3>
                
                <div className="space-y-1 mt-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {statement.createdAt 
                        ? format(new Date(statement.createdAt), "d 'de' MMMM, yyyy", { locale: ptBR }) 
                        : "Data desconhecida"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {statement.createdAt 
                        ? format(new Date(statement.createdAt), "HH:mm", { locale: ptBR }) 
                        : "--:--"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
