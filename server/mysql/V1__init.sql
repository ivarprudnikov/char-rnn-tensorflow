create table model (
  id             varchar(255) not null,
  created_at     timestamp             DEFAULT CURRENT_TIMESTAMP,
  updated_at     timestamp             DEFAULT CURRENT_TIMESTAMP
  ON UPDATE CURRENT_TIMESTAMP,
  train_params   json         not null,
  has_data       tinyint      not null default false,
  is_in_progress tinyint      not null default false,
  is_complete    tinyint      not null default false,
  primary key (id)
);

alter table model
  add constraint unique_id unique (id);
