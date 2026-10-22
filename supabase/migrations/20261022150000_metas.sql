-- Metas: descrição, categoria, pessoa, cor e imagem (pronta "preset:<chave>" ou foto enviada, já reduzida, como data URL).
alter table goals add column description text not null default '' check (length(description) <= 500);
alter table goals add column category text not null default 'outro'
  check (category in ('viagem','tecnologia','educacao','saude','casa','veiculo','investimento','outro'));
alter table goals add column person_id uuid references people(id) on delete set null;
alter table goals add column color text;
alter table goals add column image text check (image is null or length(image) <= 1500000);
alter table goals add column image_position text not null default 'center' check (image_position in ('top','center','bottom'));
alter table goals add column completed_at timestamptz;
