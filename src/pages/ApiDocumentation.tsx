import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, Key, Database, Copy, CheckCircle2, ArrowRightLeft, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ApiDocumentation = () => {
  const apiBaseUrl = `https://frvklcrendlgovdnzlwr.supabase.co/functions/v1/api`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const CodeBlock = ({ code, label }: { code: string; label?: string }) => (
    <div className="relative bg-muted rounded-lg p-4 my-2">
      <pre className="text-xs overflow-x-auto pr-10"><code>{code}</code></pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 h-7 w-7"
        onClick={() => copy(code, label || "Código")}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const Endpoint = ({ method, path, desc }: { method: string; path: string; desc: string }) => {
    const colors: Record<string, string> = {
      GET: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
      POST: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30",
      PUT: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      PATCH: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      DELETE: "bg-destructive/10 text-destructive border-destructive/30",
    };
    return (
      <div className="flex items-start gap-3 py-2 border-b last:border-b-0">
        <Badge variant="outline" className={`${colors[method]} font-mono text-xs min-w-[60px] justify-center`}>
          {method}
        </Badge>
        <div className="flex-1">
          <code className="text-sm font-semibold">{path}</code>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Book className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Documentação da API</h1>
          <Badge className="bg-primary/10 text-primary border-primary/30">v2.0 — CRUD Completo</Badge>
        </div>
        <p className="text-muted-foreground">
          API REST com operações completas de leitura, criação, edição, exclusão e ações de negócio
          (baixa, transferência, recorrência).
        </p>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-6 pr-4">
          {/* AUTENTICAÇÃO */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" /> Autenticação
              </CardTitle>
              <CardDescription>
                Todas as requisições exigem o header <code className="text-xs bg-muted px-1.5 py-0.5 rounded">X-API-Key</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-2">URL base:</p>
              <CodeBlock code={apiBaseUrl} label="URL base" />
              <p className="text-sm mt-4 mb-2">Exemplo de header:</p>
              <CodeBlock code={`X-API-Key: sua_chave_aqui`} />
            </CardContent>
          </Card>

          {/* LANCAMENTOS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" /> Lançamentos
              </CardTitle>
              <CardDescription>Receitas, despesas, parcelados e recorrentes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <Endpoint method="GET" path="/lancamentos" desc="Lista todos. Filtros: ?tipo=receita|despesa &status=... &data_inicio=YYYY-MM-DD &data_fim=YYYY-MM-DD" />
              <Endpoint method="GET" path="/lancamentos/:id" desc="Detalhes de um lançamento (com categoria e banco)" />
              <Endpoint method="POST" path="/lancamentos" desc="Cria lançamento único ou recorrente" />
              <Endpoint method="PUT" path="/lancamentos/:id" desc="Atualiza um lançamento" />
              <Endpoint method="DELETE" path="/lancamentos/:id" desc="Exclui um lançamento. ?recorrencia=true exclui toda a série" />
              <Endpoint method="POST" path="/lancamentos/:id/baixa" desc="Dar baixa (pagar/receber) total ou parcial" />

              <Separator className="my-4" />
              <h4 className="font-semibold text-sm">Criar lançamento simples</h4>
              <CodeBlock code={`POST /lancamentos
{
  "tipo": "despesa",
  "cliente_credor": "Energia Elétrica",
  "valor": 250.50,
  "data_vencimento": "2026-05-10",
  "banco_id": "uuid-banco",
  "categoria_id": "uuid-categoria",
  "observacao": "Conta de luz",
  "lancar_como_pago": false
}`} />

              <h4 className="font-semibold text-sm mt-4">Criar lançamento recorrente</h4>
              <CodeBlock code={`POST /lancamentos
{
  "tipo": "receita",
  "cliente_credor": "Aluguel Imóvel",
  "valor": 1500.00,
  "data_vencimento": "2026-05-01",
  "banco_id": "uuid-banco",
  "recorrente": true,
  "frequencia": "mensal",
  "qtd_parcelas": 12
}`} label="Recorrente" />
              <p className="text-xs text-muted-foreground">
                Frequências: <code>semanal</code>, <code>mensal</code>, <code>trimestral</code>, <code>semestral</code>.
                Use <code>qtd_parcelas: 0</code> para recorrência infinita (gera 12 e auto-renova).
              </p>

              <h4 className="font-semibold text-sm mt-4">Dar baixa (pagamento/recebimento)</h4>
              <CodeBlock code={`POST /lancamentos/:id/baixa
{
  "valor_pago": 250.50,
  "data_pagamento": "2026-05-10"
}`} label="Baixa" />
              <p className="text-xs text-muted-foreground">
                Se <code>valor_pago</code> &lt; <code>valor</code> total → status <code>parcial</code>.
                Se ≥ → <code>pago</code> ou <code>recebido</code>.
              </p>
            </CardContent>
          </Card>

          {/* TRANSFERENCIAS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" /> Transferências
              </CardTitle>
              <CardDescription>
                Move fundos entre bancos criando 2 lançamentos vinculados (status <code>transferencia</code>).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <Endpoint method="GET" path="/transferencias" desc="Lista todas as transferências" />
              <Endpoint method="POST" path="/transferencias" desc="Cria uma transferência (gera 2 lançamentos vinculados)" />
              <Endpoint method="PUT" path="/transferencias/:vinculo_id" desc="Edita os 2 lançamentos vinculados de uma vez" />
              <Endpoint method="DELETE" path="/transferencias/:vinculo_id" desc="Exclui ambos os lançamentos da transferência" />

              <Separator className="my-4" />
              <h4 className="font-semibold text-sm">Criar transferência</h4>
              <CodeBlock code={`POST /transferencias
{
  "banco_origem_id": "uuid-banco-origem",
  "banco_destino_id": "uuid-banco-destino",
  "valor": 1000.00,
  "data": "2026-05-10",
  "descricao": "Transferência mensal"
}`} label="Transferência" />
              <p className="text-xs text-muted-foreground">
                Retorna o <code>transferencia_vinculo_id</code> que une as duas pernas — use-o para editar/excluir.
              </p>
            </CardContent>
          </Card>

          {/* CATEGORIAS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" /> Categorias e Subcategorias
              </CardTitle>
              <CardDescription>
                Subcategorias usam <code>categoria_pai_id</code> apontando para a categoria pai.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <Endpoint method="GET" path="/categorias" desc="Lista todas. Filtros: ?tipo=receita|despesa &pais=true (apenas pais) &subcategorias=true (apenas filhas)" />
              <Endpoint method="GET" path="/categorias/:id" desc="Detalhes de uma categoria" />
              <Endpoint method="POST" path="/categorias" desc="Cria categoria ou subcategoria" />
              <Endpoint method="PUT" path="/categorias/:id" desc="Atualiza categoria" />
              <Endpoint method="DELETE" path="/categorias/:id" desc="Exclui categoria" />

              <Separator className="my-4" />
              <h4 className="font-semibold text-sm">Criar categoria pai</h4>
              <CodeBlock code={`POST /categorias
{
  "nome": "Alimentação",
  "tipo": "despesa"
}`} />

              <h4 className="font-semibold text-sm mt-4">Criar subcategoria</h4>
              <CodeBlock code={`POST /categorias
{
  "nome": "Restaurantes",
  "tipo": "despesa",
  "categoria_pai_id": "uuid-categoria-pai"
}`} label="Subcategoria" />
            </CardContent>
          </Card>

          {/* BANCOS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" /> Bancos / Contas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Endpoint method="GET" path="/bancos" desc="Lista bancos. ?com_saldos=true retorna saldos calculados (com filtros opcionais data_inicio/data_fim)" />
              <Endpoint method="GET" path="/bancos/:id" desc="Detalhes de um banco" />
              <Endpoint method="POST" path="/bancos" desc="Cria um banco/conta" />
              <Endpoint method="PUT" path="/bancos/:id" desc="Atualiza um banco" />
              <Endpoint method="DELETE" path="/bancos/:id" desc="Exclui um banco" />

              <Separator className="my-4" />
              <CodeBlock code={`POST /bancos
{
  "nome": "Banco Inter"
}`} />
              <p className="text-xs text-muted-foreground mt-2">
                <code>GET /bancos?com_saldos=true</code> retorna: <code>total_entradas</code>, <code>total_saidas</code>,
                <code> saldo</code>, <code>entradas_recebidas</code>, <code>entradas_a_receber</code>,
                <code> saidas_pagas</code>, <code>saidas_a_pagar</code>.
              </p>
            </CardContent>
          </Card>

          {/* RESUMO */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Endpoint method="GET" path="/resumo" desc="Totais consolidados: receitas, despesas, recebido, pago, a receber, a pagar" />
            </CardContent>
          </Card>

          {/* REGRAS DO CORE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" /> Regras de Negócio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-1">Status de lançamentos</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                  <li><code>a_receber</code> / <code>a_pagar</code> — pendentes</li>
                  <li><code>recebido</code> / <code>pago</code> — quitados</li>
                  <li><code>parcial</code> — pagamento parcial</li>
                  <li><code>atrasado</code> — despesa vencida</li>
                  <li><code>vencida</code> — receita com 3+ dias de atraso</li>
                  <li><code>transferencia</code> — usado por transferências</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Recorrência</h4>
                <p className="text-muted-foreground text-xs">
                  Todas as parcelas compartilham um <code>recorrencia_id</code>. Recorrência infinita
                  (<code>qtd_parcelas: 0</code>) gera 12 parcelas iniciais e cria automaticamente uma nova
                  parcela ao quitar uma da série.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Transferências</h4>
                <p className="text-muted-foreground text-xs">
                  Sempre criam 2 lançamentos vinculados pelo <code>transferencia_vinculo_id</code>:
                  saída no banco origem + entrada no banco destino, ambos com status <code>transferencia</code>.
                  Editar/excluir via <code>/transferencias/:vinculo_id</code> sincroniza ambos.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Baixa</h4>
                <p className="text-muted-foreground text-xs">
                  O endpoint <code>/lancamentos/:id/baixa</code> SOMA o valor pago ao existente.
                  Não substitui — permite múltiplas baixas parciais.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* EXEMPLO CURL */}
          <Card>
            <CardHeader>
              <CardTitle>Exemplo com cURL</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock code={`# Listar despesas do mês
curl -H "X-API-Key: sua_chave" \\
  "${apiBaseUrl}/lancamentos?tipo=despesa&data_inicio=2026-05-01&data_fim=2026-05-31"

# Criar uma despesa
curl -X POST -H "X-API-Key: sua_chave" -H "Content-Type: application/json" \\
  -d '{"tipo":"despesa","cliente_credor":"Aluguel","valor":2000,"data_vencimento":"2026-05-05"}' \\
  "${apiBaseUrl}/lancamentos"

# Dar baixa
curl -X POST -H "X-API-Key: sua_chave" -H "Content-Type: application/json" \\
  -d '{"valor_pago":2000}' \\
  "${apiBaseUrl}/lancamentos/UUID/baixa"

# Criar transferência
curl -X POST -H "X-API-Key: sua_chave" -H "Content-Type: application/json" \\
  -d '{"banco_origem_id":"UUID1","banco_destino_id":"UUID2","valor":500,"data":"2026-05-10"}' \\
  "${apiBaseUrl}/transferencias"`} label="cURL" />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ApiDocumentation;
