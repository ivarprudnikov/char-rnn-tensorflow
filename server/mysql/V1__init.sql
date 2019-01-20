create table model (
  id             varchar(255) not null,
  created_at     timestamp             DEFAULT CURRENT_TIMESTAMP,
  updated_at     timestamp             DEFAULT CURRENT_TIMESTAMP
  ON UPDATE CURRENT_TIMESTAMP,
  name           varchar(255) not null,
  train_params   json         not null,
  sample_params   json        not null,
  has_data       tinyint      not null default false,
  is_in_progress tinyint      not null default false,
  is_complete    tinyint      not null default false,
  training_pid   varchar(255),
  primary key (id)
)
  ENGINE = InnoDB
  DEFAULT CHARACTER SET utf8
  COLLATE utf8_general_ci;

alter table model
  add constraint unique_id unique (id);
alter table model
  add constraint unique_pid unique (training_pid);

create table model_log (
  model_id varchar(255) not null,
  position int          not null,
  chunk    text         not null
)
  ENGINE = InnoDB
  DEFAULT CHARACTER SET utf8
  COLLATE utf8_general_ci;
alter table model_log
  add index FK_MODEL_LOG_MODEL (model_id),
  add constraint FK_MODEL_LOG_MODEL foreign key (model_id) references model (id);
