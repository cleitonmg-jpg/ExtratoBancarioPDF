import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { FileUpload } from "@/components/file-upload";
import { DataTable, type StatementRow } from "@/components/data-table";
import { useUploadStatement, type UploadedStatementResponse, useBankAccounts } from "@/hooks/use-statements";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, ArrowLeft, CheckCircle2, Landmark, Info, Wallet, CreditCard, ShieldCheck, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Dashboard() {
  const [result, setResult] = useState<UploadedStatementResponse | null>(null);
  const { mutate: uploadStatement, isPending } = useUploadStatement();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: accounts } = useBankAccounts();

  const { data: company } = useQuery<{ name: string } | null>({
    queryKey: ["/api/company"],
    enabled: !!(user as any)?.companyId,
    retry: false,
  });

  const handleFileSelect = (file: File) => {
    uploadStatement(file, {
      onSuccess: (data) => {
        setResult(data);
        toast({
          title: "Processamento concluído!",
          description: "Seu extrato foi analisado com sucesso.",
          variant: "default",
        });
      },
      onError: (error) => {
        toast({
          title: "Erro no processamento",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        <header className="mb-8 print:hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Processamento Seguro com IA
            </div>
            {company?.name && (
              <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 shadow-md shadow-primary/20">
                <Building2 className="w-4 h-4" />
                <span className="text-sm font-bold truncate max-w-xs">{company.name}</span>
              </div>
            )}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight">
            Extração de Extratos com <span className="text-primary">IA</span> - V9 INFORMÁTICA
          </h1>
          <p className="mt-2 text-muted-foreground text-lg max-w-2xl">
            Transforme PDFs de extratos bancários desorganizados em dados estruturados e prontos para análise em segundos.
          </p>
        </header>

        {/* Bank Accounts Section */}
        {accounts && accounts.length > 0 && !result && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {accounts.map((account: any) => (
              <Card key={account.id} className="border-border shadow-sm hover:border-primary/50 transition-colors bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Landmark className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold truncate">{account.bankName}</CardTitle>
                      <CardDescription className="text-xs truncate">Conta: {account.accountNumber}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-card border border-border shadow-sm rounded-3xl p-6 sm:p-10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <Sparkles className="w-64 h-64" />
                  </div>
                  
                  <FileUpload onFileSelect={handleFileSelect} isLoading={isPending} />
                  
                  {isPending && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                      <div className="bg-card p-8 rounded-2xl shadow-2xl border border-border text-center max-w-sm w-full mx-4">
                        <div className="relative w-16 h-16 mx-auto mb-6">
                          <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">Analisando Documento</h3>
                        <p className="text-muted-foreground text-sm">
                          Nossa inteligência artificial está lendo as linhas, identificando o banco e categorizando valores.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-2xl border border-border/50">
                  <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <p className="font-semibold text-foreground mb-1">Dica de Processamento</p>
                    Suportamos extratos do Sicoob, Bradesco, Asaas e outros bancos brasileiros. Os dados são agrupados automaticamente por conta bancária.
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6">
                <Card className="rounded-3xl border-border shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Wallet className="w-5 h-5 text-primary" />
                      Como funciona
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-4">
                    <div className="flex gap-4">
                      <div className="flex-none w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">1</div>
                      <div className="space-y-1">
                        <p className="font-bold text-foreground">Upload do PDF</p>
                        <p className="text-sm text-muted-foreground">Arraste seu extrato bancário para a área de upload.</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="flex-none w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">2</div>
                      <div className="space-y-1">
                        <p className="font-bold text-foreground">Separação por Banco</p>
                        <p className="text-sm text-muted-foreground">A IA identifica o banco e a conta, evitando misturar informações.</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-none w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">3</div>
                      <div className="space-y-1">
                        <p className="font-bold text-foreground">Gestão Organizada</p>
                        <p className="text-sm text-muted-foreground">Visualize e edite suas transações de forma estruturada.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="p-8 rounded-3xl bg-primary text-primary-foreground relative overflow-hidden shadow-lg shadow-primary/20">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <CreditCard className="w-10 h-10 mb-4 opacity-80" />
                  <h3 className="text-xl font-bold mb-2">Multibancos</h3>
                  <p className="text-primary-foreground/80 text-sm leading-relaxed">
                    Seus dados são organizados automaticamente por instituição bancária e número de conta.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between bg-success/10 border border-success/20 p-4 rounded-2xl print:hidden">
                <div className="flex items-center gap-3 text-success">
                  <CheckCircle2 className="w-6 h-6" />
                  <div>
                    <h3 className="font-semibold">Extração Concluída</h3>
                    <p className="text-sm opacity-90">{result.data.length} transações identificadas no arquivo</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background/50 hover:bg-background text-foreground text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Novo Arquivo
                </button>
              </div>

              <DataTable data={result.data as StatementRow[]} filename={result.filename} statementId={result.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
