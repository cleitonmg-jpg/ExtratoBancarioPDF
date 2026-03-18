import { useState, useMemo } from "react";
import { Search, ArrowUpDown, TrendingUp, TrendingDown, Filter, FileText, Edit2, Download, Printer, Calculator, LineChart as LineChartIcon, Trash2, Save, XCircle, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateStatement } from "@/hooks/use-statements";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import logoV9 from "@assets/v92026_1772051277435.png";

export type StatementRow = {
  date?: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
};

interface DataTableProps {
  data: StatementRow[];
  filename?: string;
  statementId?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    agency?: string;
    companyName?: string;
  };
}

export function DataTable({ data, filename, statementId, bankAccount }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof StatementRow | "pdf">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [typeFilter, setTypeFilter] = useState<"all" | "debit" | "credit">("all");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<{ originalIndex: number; date: string; description: string; amount: number; type: "debit" | "credit" } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [showChart, setShowChart] = useState(true);
  
  const updateMutation = useUpdateStatement();
  const { toast } = useToast();

  const handleSort = (field: keyof StatementRow | "pdf") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedData = useMemo(() => {
    return [...data]
      .map((row, originalIndex) => ({ ...row, originalIndex }))
      .filter((row) => {
        const matchesSearch = row.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === "all" || row.type === typeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        if (sortField === "pdf") {
          return sortDirection === "asc"
            ? a.originalIndex - b.originalIndex
            : b.originalIndex - a.originalIndex;
        }
        let aValue = a[sortField as keyof StatementRow];
        let bValue = b[sortField as keyof StatementRow];

        if (sortField === 'date') {
           aValue = aValue || "";
           bValue = bValue || "";
        }

        if (aValue! < bValue!) return sortDirection === "asc" ? -1 : 1;
        if (aValue! > bValue!) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [data, searchTerm, sortField, sortDirection, typeFilter]);

  // Calculate cumulative balance line by line
  const dataWithBalance = useMemo(() => {
    let currentBalance = initialBalance;
    return filteredAndSortedData.map(row => {
      if (row.type === 'credit') {
        currentBalance += row.amount;
      } else {
        currentBalance -= row.amount;
      }
      return { ...row, runningBalance: currentBalance };
    });
  }, [filteredAndSortedData, initialBalance]);

  // Chart data needs to be chronological
  const chartData = useMemo(() => {
    let currentBalance = initialBalance;
    return [...data]
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((row, index) => {
        if (row.type === 'credit') {
          currentBalance += row.amount;
        } else {
          currentBalance -= row.amount;
        }
        return {
          name: row.date || `Mov ${index + 1}`,
          balance: currentBalance,
          description: row.description
        };
      });
  }, [data, initialBalance]);

  const summary = useMemo(() => {
    const totalCredit = data.filter(r => r.type === "credit").reduce((sum, r) => sum + r.amount, 0);
    const totalDebit = data.filter(r => r.type === "debit").reduce((sum, r) => sum + r.amount, 0);
    return { 
      credit: totalCredit, 
      debit: totalDebit, 
      periodBalance: totalCredit - totalDebit,
      finalBalance: initialBalance + totalCredit - totalDebit
    };
  }, [data, initialBalance]);

  const handleEditStart = (originalIndex: number, row: StatementRow) => {
    setEditingRow({
      originalIndex,
      date: row.date || "",
      description: row.description,
      amount: row.amount,
      type: row.type,
    });
    setEditValue(row.description);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!statementId || !editingRow) return;
    
    const newData = [...data];
    newData[editingRow.originalIndex] = { ...newData[editingRow.originalIndex], description: editValue };
    
    try {
      await updateMutation.mutateAsync({ id: statementId, data: newData });
      setEditModalOpen(false);
      setEditingRow(null);
      toast({
        title: "Sucesso",
        description: "Descrição atualizada com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar a descrição.",
        variant: "destructive"
      });
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteRow = async () => {
    if (!statementId || !editingRow) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    const newData = data.filter((_, idx) => idx !== editingRow.originalIndex);
    
    try {
      await updateMutation.mutateAsync({ id: statementId, data: newData });
      setEditModalOpen(false);
      setEditingRow(null);
      setConfirmDelete(false);
      toast({
        title: "Sucesso",
        description: "Registro excluído com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao excluir o registro.",
        variant: "destructive"
      });
    }
  };

  const handleEditClose = () => {
    setEditModalOpen(false);
    setEditingRow(null);
    setConfirmDelete(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const exportToExcel = () => {
    const headers = ["Data", "Descrição", "Entradas (Crédito)", "Saídas (Débito)", "Saldo Atual"];
    const rows = dataWithBalance.map(r => [
      r.date || "",
      r.description,
      r.type === 'credit' ? r.amount.toFixed(2).replace('.', ',') : "",
      r.type === 'debit' ? r.amount.toFixed(2).replace('.', ',') : "",
      r.runningBalance.toFixed(2).replace('.', ',')
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `extrato_${filename || 'export'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print:space-y-4 print:animate-none">
      
      {/* Print Header */}
      <div className="hidden print:block border-b-2 border-primary pb-6 mb-6">
        <div className="flex justify-between items-start">
          <div className="flex gap-4 items-center">
            <img src={logoV9} alt="V9 Informática" className="w-16 h-16 object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-primary mb-1 uppercase tracking-tight">Relatório de Extrato Bancário</h1>
              <p className="text-sm font-semibold text-foreground uppercase">{bankAccount?.companyName || "Empresa não identificada"}</p>
              <p className="text-xs text-muted-foreground">{filename}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">{bankAccount?.bankName || "Banco não identificado"}</p>
            <p className="text-sm text-muted-foreground">
              Agência: {bankAccount?.agency || "---"} | Conta: {bankAccount?.accountNumber || "---"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest">Processado por V9 INFORMATICA</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="text-center p-2 border border-border rounded-lg">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Saldo Anterior</p>
            <p className="text-sm font-bold">{formatCurrency(initialBalance)}</p>
          </div>
          <div className="text-center p-2 border border-border rounded-lg">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold text-success">Total Entradas</p>
            <p className="text-sm font-bold text-success">{formatCurrency(summary.credit)}</p>
          </div>
          <div className="text-center p-2 border border-border rounded-lg">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold text-destructive">Total Saídas</p>
            <p className="text-sm font-bold text-destructive">{formatCurrency(summary.debit)}</p>
          </div>
          <div className="text-center p-2 border border-primary/20 bg-primary/5 rounded-lg">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold text-primary">Saldo Final</p>
            <p className="text-sm font-bold text-primary">{formatCurrency(summary.finalBalance)}</p>
          </div>
        </div>
      </div>

      {/* Header & Summary Cards (Screen Only) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="glass-panel p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calculator className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Saldo Anterior</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-muted-foreground">R$</span>
            <input 
              type="number" 
              value={initialBalance}
              onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent border-b border-border focus:border-primary focus:outline-none font-bold text-xl"
              step="0.01"
            />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-xs font-medium uppercase">Entradas</span>
          </div>
          <h3 className="text-xl font-bold text-success">{formatCurrency(summary.credit)}</h3>
        </div>
        
        <div className="glass-panel p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="text-xs font-medium uppercase">Saídas</span>
          </div>
          <h3 className="text-xl font-bold text-destructive">{formatCurrency(summary.debit)}</h3>
        </div>

        <div className="glass-panel p-4 rounded-2xl bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 text-primary mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Saldo Final</span>
          </div>
          <h3 className={cn("text-xl font-bold", summary.finalBalance >= 0 ? "text-foreground" : "text-destructive")}>
            {formatCurrency(summary.finalBalance)}
          </h3>
        </div>
      </div>

      {/* Evolution Chart (Screen Only) */}
      <div className="print:hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <LineChartIcon className="w-5 h-5 text-primary" />
            Evolução do Saldo
          </h3>
          <button 
            onClick={() => setShowChart(!showChart)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {showChart ? "Ocultar Gráfico" : "Mostrar Gráfico"}
          </button>
        </div>
        
        {showChart && (
          <div className="bg-card border border-border rounded-2xl p-6 h-[300px] shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  minTickGap={30}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(val) => `R$ ${val}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), "Saldo"]}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                  dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden print:border-none print:shadow-none print:overflow-visible">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-muted/20 print:hidden">
          <div className="flex items-center gap-2 text-primary font-medium">
            {filename ? (
              <>
                <FileText className="w-5 h-5" />
                <span className="truncate max-w-[200px] sm:max-w-xs">{filename}</span>
              </>
            ) : (
              <span>Transações Extraídas</span>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleSort("pdf")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-colors",
                  sortField === "pdf"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
                title="Ordenar conforme ordem do PDF"
              >
                <ListOrdered className="w-4 h-4" />
                Ordem PDF
                {sortField === "pdf" && (
                  <span className="text-[10px] opacity-80">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
              <button
                onClick={exportToExcel}
                className="p-2 bg-background border border-border rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                title="Exportar CSV"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrint}
                className="p-2 bg-background border border-border rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                title="Imprimir"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            <div className="relative w-full sm:w-auto">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full sm:w-auto pl-9 pr-8 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none text-sm cursor-pointer"
              >
                <option value="all">Todos os tipos</option>
                <option value="credit">Entradas (Crédito)</option>
                <option value="debit">Saídas (Débito)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <button onClick={() => handleSort("date")} className="flex items-center gap-1 hover:text-foreground transition-colors print:pointer-events-none">
                    Data <ArrowUpDown className="w-3 h-3 print:hidden" />
                  </button>
                </th>
                <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full">
                  <button onClick={() => handleSort("description")} className="flex items-center gap-1 hover:text-foreground transition-colors print:pointer-events-none">
                    Descrição <ArrowUpDown className="w-3 h-3 print:hidden" />
                  </button>
                </th>
                <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
                  Crédito
                </th>
                <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
                  Débito
                </th>
                <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {dataWithBalance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              ) : (
                dataWithBalance.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors group print:hover:bg-transparent">
                    <td className="p-4 print:p-2 text-sm text-muted-foreground whitespace-nowrap">
                      {row.date || "N/A"}
                    </td>
                    <td className="p-4 print:p-2 text-sm font-medium text-foreground">
                      <div className="flex items-center gap-2 group/cell">
                        <span className="flex-1">{row.description}</span>
                        {statementId && (
                          <button
                            data-testid={`button-edit-${row.originalIndex}`}
                            onClick={() => handleEditStart(row.originalIndex, row)}
                            className="p-1 text-muted-foreground opacity-0 group-hover/cell:opacity-100 hover:text-primary hover:bg-primary/5 rounded-md transition-all print:hidden"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-4 print:p-2 text-sm font-bold text-right whitespace-nowrap text-success">
                      {row.type === "credit" ? formatCurrency(row.amount) : "-"}
                    </td>
                    <td className="p-4 print:p-2 text-sm font-bold text-right whitespace-nowrap text-destructive">
                      {row.type === "debit" ? formatCurrency(row.amount) : "-"}
                    </td>
                    <td className="p-4 print:p-2 text-sm font-medium text-right whitespace-nowrap text-muted-foreground print:text-xs">
                      {formatCurrency(row.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Final Total Row */}
            {dataWithBalance.length > 0 && (
              <tfoot className="bg-muted/10 font-bold">
                <tr>
                  <td colSpan={2} className="p-4 text-right text-xs uppercase text-muted-foreground">Total Final</td>
                  <td className="p-4 text-right text-success">
                    {formatCurrency(summary.credit)}
                  </td>
                  <td className="p-4 text-right text-destructive">
                    {formatCurrency(summary.debit)}
                  </td>
                  <td className="p-4 text-right text-foreground">
                    {formatCurrency(summary.finalBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        
        <div className="p-4 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between print:hidden">
          <span>Mostrando {dataWithBalance.length} de {data.length} transações</span>
        </div>
      </div>

      <Dialog open={editModalOpen} onOpenChange={(open) => { if (!open) handleEditClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-primary" />
              Editar Lançamento
            </DialogTitle>
            <DialogDescription>
              Altere a descrição do lançamento abaixo.
            </DialogDescription>
          </DialogHeader>

          {editingRow && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs uppercase font-semibold">Data</span>
                  <p className="font-medium mt-1" data-testid="modal-edit-date">{editingRow.date || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase font-semibold">Valor</span>
                  <p className={cn("font-bold mt-1", editingRow.type === "credit" ? "text-success" : "text-destructive")} data-testid="modal-edit-amount">
                    {editingRow.type === "credit" ? "+" : "-"}{formatCurrency(editingRow.amount)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-muted-foreground text-xs uppercase font-semibold block mb-2">Descrição</label>
                <textarea
                  data-testid="input-edit-description"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none min-h-[80px]"
                  autoFocus
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              data-testid="button-delete-transaction"
              variant="destructive"
              onClick={handleDeleteRow}
              disabled={updateMutation.isPending}
              className="sm:mr-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {confirmDelete ? "Confirmar Exclusão?" : "Excluir"}
            </Button>
            <div className="flex gap-2">
              <Button
                data-testid="button-cancel-edit"
                variant="outline"
                onClick={handleEditClose}
                disabled={updateMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Desistir
              </Button>
              <Button
                data-testid="button-save-edit"
                onClick={handleEditSave}
                disabled={updateMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
