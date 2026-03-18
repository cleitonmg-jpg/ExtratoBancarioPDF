import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, File, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export function FileUpload({ onFileSelect, isLoading }: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      setError("Por favor, selecione apenas arquivos PDF.");
      return;
    }
    
    if (acceptedFiles.length > 0) {
      setError(null);
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  return (
    <div className="w-full w-full max-w-3xl mx-auto">
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive"
          >
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        {...getRootProps()}
        className={cn(
          "relative overflow-hidden group cursor-pointer transition-all duration-300 rounded-3xl border-2 border-dashed p-10 sm:p-16 text-center",
          isDragActive 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          isLoading ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
        )}
      >
        <input {...getInputProps()} />
        
        <div className="relative z-10 flex flex-col items-center justify-center gap-6">
          <div className={cn(
            "p-5 rounded-full transition-colors duration-300",
            isDragActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          )}>
            {isLoading ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : (
              <UploadCloud className="w-10 h-10" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">
              {isLoading ? "Processando seu extrato..." : "Arraste seu extrato bancário"}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
              {isLoading 
                ? "Nossa IA está lendo e categorizando as transações. Isso pode levar alguns segundos."
                : "Solte seu arquivo PDF aqui ou clique para selecionar do seu computador. Nossa IA extrairá todos os dados automaticamente."
              }
            </p>
          </div>
          
          {!isLoading && (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow">
              <File className="w-4 h-4" />
              Selecionar PDF
            </div>
          )}
        </div>
        
        {/* Decorative background element */}
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500" />
      </div>
    </div>
  );
}
