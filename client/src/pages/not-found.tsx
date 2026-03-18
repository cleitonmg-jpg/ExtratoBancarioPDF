import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 rounded-3xl border-border shadow-lg">
        <CardContent className="pt-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            A página que você está procurando não existe ou foi removida.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            Voltar ao Painel
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
