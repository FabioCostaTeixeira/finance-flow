-- Roles customizadas do projeto.
--
-- Roles no Postgres são objetos de cluster, não de schema: `supabase db pull`
-- não as captura. Sem este arquivo, o stack local falha ao aplicar a baseline
-- com `role "finance_readonly" does not exist`, porque ela existe em produção
-- mas nunca foi versionada.
--
-- O Supabase CLI semeia este arquivo antes de aplicar as migrations
-- ("Seeding globals from roles.sql").

-- Role somente-leitura usada pelo caminho de consulta da IA. Recebe GRANT
-- SELECT em lancamentos, bancos e categorias na migration de baseline.
-- NOLOGIN: a role existe para agrupar privilégios, não para autenticar.
CREATE ROLE "finance_readonly" NOLOGIN NOINHERIT;
