-- Espaço empresarial: dados da empresa no próprio workspace (kind = 'business').
alter table workspaces add column if not exists cnpj text;
alter table workspaces add column if not exists activity text;
alter table workspaces add column if not exists company_type text
  check (company_type is null or company_type in ('mei','me','epp','ltda','slu','sa','autonomo','outro'));
-- Uma empresa por usuário (por enquanto).
create unique index if not exists workspaces_one_business on workspaces (owner_id) where kind = 'business';
