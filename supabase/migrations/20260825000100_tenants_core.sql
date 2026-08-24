-- Núcleo de multitenancy: organizações, seus membros e os operadores da plataforma.

CREATE TABLE public.tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  plano      text NOT NULL DEFAULT 'padrao',
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_members (
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_user ON public.tenant_members(user_id);

-- Operadores vivem FORA de tenant_members. É isso que garante, por construção,
-- que eles nunca satisfazem uma policy de dado financeiro.
CREATE TABLE public.platform_operators (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_operators ENABLE ROW LEVEL SECURITY;

-- Sem policies para authenticated em platform_operators: apenas service_role
-- (edge functions do console) enxerga a tabela. RLS habilitada e nenhuma policy
-- significa "ninguém autenticado acessa", que é exatamente a intenção.

-- Migração dos dados atuais: um tenant único com todos os usuários existentes.
INSERT INTO public.tenants (nome, slug) VALUES ('Principal', 'principal');

INSERT INTO public.tenant_members (tenant_id, user_id, role)
SELECT (SELECT id FROM public.tenants WHERE slug = 'principal'),
       ur.user_id,
       ur.role
FROM public.user_roles ur
ON CONFLICT (tenant_id, user_id) DO NOTHING;
