# Char-RNN-TensorFlow - IN PROGRESS

Character generator using recurrent neural network (_RNN_).
Also _Node.js_ server used to provide _HTTP_ API for training 
_RNN_ and then generating samples from saved checkpoints.

## Generator

_Forked_ from [hzy46/Char-RNN-TensorFlow](https://github.com/hzy46/Char-RNN-TensorFlow) 
and is in separate directory (`generator/`) now to avoid confusion. It has its own documentation
in [`generator/README.md`](generator/README.md).

## Server

Trivial _Node.js_ server used to store incoming training data and call `python` scripts to train 
and generate text. Read about it in [`server/README.md`](server/README.md)

## Development

Both `server` and `generator` are expected to run in Docker  
and running image locally would replicate production environment.
You could also run server directly but then need to be sure that all
python dependencies are installed locally. 

### a) Build and run Docker image

- To `build` container image: `docker build -t <some_name> .`
- To `run` above image: 
```
docker run --rm -ti \
    -e "MYSQL_HOST=docker.for.mac.localhost" \
    -e "MYSQL_USER=root" \
    -e "MYSQL_PASSWORD=" \
    -e "MYSQL_DATABASE=rnn_generator" \
    -p 8080:8080 <some_name>
```

### b) Run using virtualenv

*New virtualenv*

- Create new environment in dir `venv` - `$ virtualenv -p python3 venv`
- Activate environment - `$ source venv/bin/activate`
- Install dependencies - `(venv) $ pip install -r requirements.txt`

*Existing virtualenv*

- Activate environment - `$ source venv/bin/activate`
- Use _Node.js_ `v10` `(venv) $ nvm use 10`
- `run` server `(venv) $ node server/server`

## Your feedback

You are free to open issues if there is anything bothering you, I'll read through and will make 
best effort to fix/reply ASAP.
