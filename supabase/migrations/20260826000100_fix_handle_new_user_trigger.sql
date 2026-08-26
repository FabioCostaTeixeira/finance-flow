-- A função public.handle_new_user() já existe (cria uma linha em profiles a
-- partir de auth.users), mas o trigger que a dispara em auth.users nunca foi
-- capturado nas migrations locais: um `supabase db reset` limpo produz 0
-- linhas em profiles para qualquer usuário novo. Isso quebra qualquer fluxo
-- que dependa de profiles estar populada (create-user atualiza nome em
-- profiles, o console de operador busca usuário existente por email em
-- profiles, Usuarios.tsx lista profiles). Não é mudança de RLS/role — só
-- religa a automação de criação de perfil que já era a intenção original.
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
