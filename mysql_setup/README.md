Apply schema to newly created database `rnn_generator`:

```shell script
$ mysql -u root -D rnn_generator < V1__init.sql
```

Add some bootstrapped data to the database `rnn_generator`:

```shell script
$ mysql -u root -D rnn_generator < bootstrap.sql
```
