import { Layout } from "@/components/layout";
import { DataTable, type StatementRow } from "@/components/data-table";
import { useStatement, useBankAccounts } from "@/hooks/use-statements";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function StatementDetailPage() {
  const [, params] = useRoute("/statement/:id");
  const id = params?.id || "";
  
  const { data: statement, isLoading, error } = useStatement(id);
  const { data: bankAccounts } = useBankAccounts();

  const bankAccount = bankAccounts?.find((acc: any) => acc.id === statement?.bankAccountId);

  return (
    <Layout>
      <div className="space-y-6 print:space-y-0">
        <Link 
          href="/history"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium text-sm print:hidden"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o Histórico
        </Link>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando dados do extrato...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 p-8 rounded-3xl text-center">
            <h2 className="text-xl font-bold text-destructive mb-2">Erro ao carregar extrato</h2>
            <p className="text-destructive/80">{(error as Error).message}</p>
          </div>
        ) : !statement ? (
          <div className="bg-card border border-border p-8 rounded-3xl text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">Extrato não encontrado</h2>
            <p className="text-muted-foreground">O arquivo solicitado não existe ou foi removido.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500 print:space-y-0 print:animate-none">
            <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm print:hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
              
              <div className="relative z-10">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-all">
                  {statement.filename}
                </h1>
                
                <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                  <Calendar className="w-5 h-5" />
                  <span>
                    Processado em {statement.createdAt 
                      ? format(new Date(statement.createdAt), "d 'de' MMMM 'de' yyyy, 'às' HH:mm", { locale: ptBR }) 
                      : "Data desconhecida"}
                  </span>
                </div>
              </div>
            </div>

            <DataTable 
              data={(statement.data as unknown) as StatementRow[]} 
              filename={statement.filename} 
              statementId={statement.id}
              bankAccount={bankAccount}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
