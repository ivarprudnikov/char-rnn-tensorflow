insert into model set id='01-abcd', name='01', train_params='{}', has_data=0, is_in_progress=0;
insert into model set id='02-abcd', name='02', train_params='{}', has_data=0, is_in_progress=0;

-- add some log output to model
insert into model_log set model_id='01-abcd', position=1, chunk='exec script';
insert into model_log set model_id='01-abcd', position=2, chunk='script returns';
