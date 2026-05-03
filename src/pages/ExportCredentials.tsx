import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function ExportCredentials() {
  const [data, setData] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleExport = async () => {
    setLoading(true);
    setError("");
    setData("");
    try {
      const { data, error } = await supabase.functions.invoke("temp-export-credentials");
      if (error) throw error;
      setData(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(data);
  };

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-4xl mx-auto">
      <div className="bg-red-600 text-white p-4 rounded-lg font-bold text-center text-lg">
        ⚠️ APAGUE DEPOIS DO USO ⚠️
        <div className="text-sm font-normal mt-1">
          Esta tela e a edge function `temp-export-credentials` expõem credenciais sensíveis.
          Delete imediatamente após a migração e rotacione as chaves.
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={handleExport} disabled={loading} size="lg">
          {loading ? "Exportando..." : "Exportar Credenciais"}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded">{error}</div>
      )}

      {data && (
        <div className="space-y-2">
          <Button variant="outline" onClick={handleCopy}>📋 Copiar JSON</Button>
          <pre className="bg-muted p-4 rounded overflow-auto text-xs whitespace-pre-wrap break-all">
            {data}
          </pre>
        </div>
      )}
    </div>
  );
}