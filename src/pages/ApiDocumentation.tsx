import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, Key, Database, BarChart3, Link, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ApiDocumentation = () => {
  const apiBaseUrl = `https://frvklcrendlgovdnzlwr.supabase.co/functions/v1/api`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Book className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Documentação da API</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Guia completo para integrar o Power BI com o sistema financeiro via API REST
        </p>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-6 pr-4">
          {/* Introdução */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</span>
                Introdução
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                A API do Sistema Financeiro MarySysten permite que você acesse seus dados financeiros de forma programática, 
                possibilitando a criação de dashboards personalizados no Power BI, integração com outras ferramentas e automação de relatórios.
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Recursos disponíveis:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Lançamentos financeiros (receitas e despesas)</li>
                  <li>Categorias de lançamentos</li>
                  <li>Bancos/Contas</li>
                  <li>Resumo financeiro consolidado</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Passo 1: Obter Chave API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</span>
                <Key className="h-5 w-5" />
                Obter sua Chave de API
              </CardTitle>
              <CardDescription>
                Primeiro passo: criar uma chave de acesso à API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3">
                <li>Acesse o menu <strong>"API"</strong> no painel lateral do sistema</li>
                <li>Clique no botão <strong>"Nova Chave API"</strong></li>
                <li>Digite um nome descritivo para a chave (ex: "Power BI Dashboard")</li>
                <li>Clique em <strong>"Criar"</strong></li>
                <li>
                  <span className="text-destructive font-semibold">IMPORTANTE:</span> Copie e guarde a chave gerada em local seguro. 
                  Por motivos de segurança, ela não será exibida novamente.
                </li>
              </ol>
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  <strong>⚠️ Segurança:</strong> Nunca compartilhe sua chave de API. Caso suspeite que ela foi comprometida, 
                  desative-a imediatamente e crie uma nova.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Passo 2: URL Base e Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</span>
                <Database className="h-5 w-5" />
                Endpoints Disponíveis
              </CardTitle>
              <CardDescription>
                URLs e estrutura dos dados retornados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-2">URL Base da API:</h4>
                <div className="flex items-center gap-2 bg-muted p-3 rounded-lg font-mono text-sm">
                  <code className="flex-1 break-all">{apiBaseUrl}</code>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => copyToClipboard(apiBaseUrl, "URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Endpoint: Lançamentos */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="font-mono text-sm">/lancamentos</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Retorna todos os lançamentos financeiros com informações detalhadas.
                </p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Campos retornados:</p>
                  <code className="text-xs">
                    id, tipo, cliente_credor, valor, valor_pago, data_vencimento, data_pagamento, 
                    status, categoria, categoria_pai, banco, parcela_atual, total_parcelas, observacao
                  </code>
                </div>
              </div>

              <Separator />

              {/* Endpoint: Categorias */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="font-mono text-sm">/categorias</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Retorna todas as categorias cadastradas no sistema.
                </p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Campos retornados:</p>
                  <code className="text-xs">
                    id, nome, tipo, categoria_pai_id
                  </code>
                </div>
              </div>

              <Separator />

              {/* Endpoint: Bancos */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="font-mono text-sm">/bancos</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Retorna todos os bancos/contas cadastrados.
                </p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Campos retornados:</p>
                  <code className="text-xs">
                    id, nome
                  </code>
                </div>
              </div>

              <Separator />

              {/* Endpoint: Resumo */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="font-mono text-sm">/resumo</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Retorna um resumo consolidado das finanças.
                </p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Campos retornados:</p>
                  <code className="text-xs">
                    total_receitas, total_despesas, total_recebido, total_pago, a_receber, a_pagar, quantidade_lancamentos
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Passo 3: Configurar Power BI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">4</span>
                <BarChart3 className="h-5 w-5" />
                Configurar Conexão no Power BI
              </CardTitle>
              <CardDescription>
                Passo a passo para conectar o Power BI à API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold">Passo 4.1: Abrir Power BI Desktop</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm ml-4">
                  <li>Abra o Power BI Desktop</li>
                  <li>Clique em <strong>"Obter Dados"</strong> (Get Data)</li>
                  <li>Selecione <strong>"Web"</strong> na lista de fontes de dados</li>
                </ol>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold">Passo 4.2: Configurar a Conexão Web</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm ml-4">
                  <li>Na janela "Da Web", selecione <strong>"Avançado"</strong></li>
                  <li>
                    No campo <strong>"Partes da URL"</strong>, insira a URL do endpoint desejado:
                    <div className="bg-muted p-2 rounded mt-2 font-mono text-xs">
                      {apiBaseUrl}/lancamentos
                    </div>
                  </li>
                  <li>
                    Em <strong>"Cabeçalhos de solicitação HTTP"</strong>, adicione:
                    <div className="bg-muted p-3 rounded mt-2 space-y-2">
                      <div className="flex gap-2 text-xs">
                        <span className="font-semibold min-w-[100px]">Nome:</span>
                        <code>X-API-Key</code>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="font-semibold min-w-[100px]">Valor:</span>
                        <code>[SUA_CHAVE_API_AQUI]</code>
                      </div>
                    </div>
                  </li>
                  <li>Clique em <strong>"OK"</strong></li>
                </ol>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold">Passo 4.3: Transformar os Dados (Power Query)</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm ml-4">
                  <li>O Power BI abrirá o Editor do Power Query</li>
                  <li>Se os dados aparecerem como uma lista, clique em <strong>"Para Tabela"</strong></li>
                  <li>Expanda as colunas conforme necessário</li>
                  <li>Ajuste os tipos de dados das colunas (datas, números, etc.)</li>
                  <li>Clique em <strong>"Fechar e Aplicar"</strong></li>
                </ol>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  <strong>💡 Dica:</strong> Para importar múltiplos endpoints, repita o processo para cada um 
                  (lancamentos, categorias, bancos, resumo) e depois crie relacionamentos entre as tabelas.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Passo 4: Código M para Power Query */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">5</span>
                <Link className="h-5 w-5" />
                Código M (Avançado)
              </CardTitle>
              <CardDescription>
                Para usuários avançados: código M pronto para copiar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se preferir, você pode usar diretamente o código M no Editor Avançado do Power Query:
              </p>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">Lançamentos:</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(`let
    Fonte = Json.Document(Web.Contents("${apiBaseUrl}/lancamentos", [Headers=[#"X-API-Key"="SUA_CHAVE_API_AQUI"]])),
    Tabela = Table.FromList(Fonte, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Expandido = Table.ExpandRecordColumn(Tabela, "Column1", {"id", "tipo", "cliente_credor", "valor", "valor_pago", "data_vencimento", "data_pagamento", "status", "categoria", "categoria_pai", "banco", "parcela_atual", "total_parcelas", "observacao"})
in
    Expandido`, "Código")}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`let
    Fonte = Json.Document(Web.Contents(
        "${apiBaseUrl}/lancamentos", 
        [Headers=[#"X-API-Key"="SUA_CHAVE_API_AQUI"]]
    )),
    Tabela = Table.FromList(Fonte, Splitter.SplitByNothing()),
    Expandido = Table.ExpandRecordColumn(Tabela, "Column1", 
        {"id", "tipo", "cliente_credor", "valor", "valor_pago", 
         "data_vencimento", "data_pagamento", "status", "categoria", 
         "categoria_pai", "banco", "parcela_atual", "total_parcelas"})
in
    Expandido`}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">Resumo Financeiro:</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(`let
    Fonte = Json.Document(Web.Contents("${apiBaseUrl}/resumo", [Headers=[#"X-API-Key"="SUA_CHAVE_API_AQUI"]])),
    Tabela = Record.ToTable(Fonte)
in
    Tabela`, "Código")}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`let
    Fonte = Json.Document(Web.Contents(
        "${apiBaseUrl}/resumo", 
        [Headers=[#"X-API-Key"="SUA_CHAVE_API_AQUI"]]
    )),
    Tabela = Record.ToTable(Fonte)
in
    Tabela`}
                  </pre>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  <strong>⚠️ Importante:</strong> Substitua <code>SUA_CHAVE_API_AQUI</code> pela sua chave de API real.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Exemplos de Visualizações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">6</span>
                <CheckCircle2 className="h-5 w-5" />
                Exemplos de Visualizações
              </CardTitle>
              <CardDescription>
                Ideias de dashboards que você pode criar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">📊 Fluxo de Caixa</h4>
                  <p className="text-sm text-muted-foreground">
                    Gráfico de linhas mostrando receitas vs despesas ao longo do tempo
                  </p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">🥧 Despesas por Categoria</h4>
                  <p className="text-sm text-muted-foreground">
                    Gráfico de pizza ou treemap com distribuição de gastos
                  </p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">🏦 Saldo por Banco</h4>
                  <p className="text-sm text-muted-foreground">
                    Gráfico de barras comparando saldos entre contas
                  </p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">📅 Contas a Pagar/Receber</h4>
                  <p className="text-sm text-muted-foreground">
                    Tabela com filtros de status e vencimento
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Solução de Problemas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">7</span>
                Solução de Problemas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-4 border-destructive pl-4">
                  <h4 className="font-semibold">Erro 401 - Unauthorized</h4>
                  <p className="text-sm text-muted-foreground">
                    Verifique se a chave API está correta e se o header X-API-Key está sendo enviado.
                  </p>
                </div>
                <div className="border-l-4 border-destructive pl-4">
                  <h4 className="font-semibold">Erro 403 - Forbidden</h4>
                  <p className="text-sm text-muted-foreground">
                    A chave API pode estar desativada. Verifique no menu API se está ativa.
                  </p>
                </div>
                <div className="border-l-4 border-amber-500 pl-4">
                  <h4 className="font-semibold">Dados não atualizam</h4>
                  <p className="text-sm text-muted-foreground">
                    No Power BI, clique em "Atualizar" para buscar os dados mais recentes da API.
                  </p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold">Erro de CORS no navegador</h4>
                  <p className="text-sm text-muted-foreground">
                    A API foi projetada para ser chamada pelo Power BI Desktop. Testes em navegador podem apresentar erros de CORS.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suporte */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Precisa de Ajuda?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Se tiver dúvidas ou encontrar problemas, utilize a aba de Insights para conversar com a 
                inteligência artificial do sistema ou entre em contato com o suporte.
              </p>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ApiDocumentation;
