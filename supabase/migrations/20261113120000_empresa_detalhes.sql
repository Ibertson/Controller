-- Empresa: novos tipos (Simples Nacional, Lucro Presumido/Real) e dados complementares das Configurações.
alter table workspaces drop constraint if exists workspaces_company_type_check;
alter table workspaces add constraint workspaces_company_type_check
  check (company_type is null or company_type in
    ('mei','me','me_simples','epp','epp_simples','presumido','real','outro','ltda','slu','sa','autonomo'));
-- Razão social, e-mail, cidade/UF, CNAE, abertura, DAS do MEI e preferências.
alter table workspaces add column if not exists details jsonb not null default '{}'::jsonb;
