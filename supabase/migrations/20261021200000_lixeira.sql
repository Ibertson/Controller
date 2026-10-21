-- Lixeira: lançamentos excluídos ficam marcados e podem ser restaurados.
alter table transactions add column deleted_at timestamptz;
create index on transactions (workspace_id) where deleted_at is not null;
