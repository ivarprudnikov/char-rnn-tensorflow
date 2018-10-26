# Char-RNN-TensorFlow

Multi-language Char RNN in TensorFlow. You can use this code to generate English text, Chinese poetries and lyrics, Japanese text and text in other language.

## Requirements
- Python 3.6.X
- TensorFlow >= 1.2

### Setup guide for OSX

- Get Python 3.6.5 (later version has issues with `tensorflow`) - 
```$ brew install https://raw.githubusercontent.com/Homebrew/homebrew-core/f2a764ef944b1080be64bd88dca9a1d80130c558/Formula/python.rb```
- Update PIP - 
```$ pip3 install --upgrade pip```
- Install Virtualenv - 
```$ pip3 install virtualenv```
- Create new environment in dir `venv` - 
```$ virtualenv -p python3 venv```
- Activate environment - 
```$ source venv/bin/activate```
- Install dependencies - 
```(venv) $ pip install -r requirements.txt```

## Generate English Text

To train:

```
python train.py \
  --input_file data/shakespeare.txt  \
  --name shakespeare \
  --num_steps 50 \
  --num_seqs 32 \
  --learning_rate 0.01 \
  --max_steps 20000
```

To sample:

```
python sample.py \
  --converter_path model/shakespeare/converter.pkl \
  --checkpoint_path model/shakespeare/ \
  --max_length 1000
```

Result:

```
BROTON:
When thou art at to she we stood those to that hath
think they treaching heart to my horse, and as some trousting.

LAUNCE:
The formity so mistalied on his, thou hast she was
to her hears, what we shall be that say a soun man
Would the lord and all a fouls and too, the say,
That we destent and here with my peace.

PALINA:
Why, are the must thou art breath or thy saming,
I have sate it him with too to have me of
I the camples.

```

## Generate Lithuanian novel

To train:

```
python train.py \
  --input_file data/ltu-vincas-mykolaitis-putinas-altoriu-sesely.txt  \
  --whitelist_file data/ltu-char-whitelist.txt \
  --name altoriu-sesely \
  --num_steps 50 \
  --num_seqs 32 \
  --learning_rate 0.01 \
  --max_steps 2000
```

To sample:

```
python sample.py \
  --converter_path model/altoriu-sesely/converter.pkl \
  --checkpoint_path model/altoriu-sesely/ \
  --max_length 1000
```

Result:
```text
čiavo seniais pasikrintoje, net pariko, pamokslą. Parapijos sau išsiskaitė, 
kad jis patinka sevuosiuj ne tependu tiek nusipažinęs perklaudymim prie komalenė, 
nesenose pasiteisinti, nei tuos patasinia ponią balginė jos iš karta, kalbos, 
klausimus kunigas ir prieš nesusidaryti, ir pripusėjo jusdinančią pradžias 
susistinga kunigo iš jo stačiai išsiviešia pasistatė, pasakyti sakai, ir 
kitą paskutinio pilko pirme pareigos kunigėliu kun. 
Ramučių pradėjo ir niekad tuomet nors ir nors, bet pamokėjusi kas
```

## Generate Chinese Poetries

To train:

```
python train.py \
  --use_embedding \
  --input_file data/poetry.txt \
  --name poetry \
  --learning_rate 0.005 \
  --num_steps 26 \
  --num_seqs 32 \
  --max_steps 10000
```

To sample:

```
python sample.py \
  --use_embedding \
  --converter_path model/poetry/converter.pkl \
  --checkpoint_path model/poetry/ \
  --max_length 300
```

Result:
```
何人无不见，此地自何如。
一夜山边去，江山一夜归。
山风春草色，秋水夜声深。
何事同相见，应知旧子人。
何当不相见，何处见江边。
一叶生云里，春风出竹堂。
何时有相访，不得在君心。
```

## Generate Chinese Lyrics

To train:

```
python train.py  \
  --input_file data/jay.txt \
  --num_steps 20 \
  --batch_size 32 \
  --name jay \
  --max_steps 5000 \
  --learning_rate 0.01 \
  --num_layers 3 \
  --use_embedding
```

To sample:

```
python sample.py --converter_path model/jay/converter.pkl \
  --checkpoint_path  model/jay  \
  --max_length 500  \
  --use_embedding \
  --num_layers 3 \
  --start_string 我知道
```

Result:
```
我知道
我的世界 一种解
我一直实现 语不是我
有什么(客) 我只是一口
我想想我不来 你的微笑
我说 你我你的你
只能有我 一个梦的
我说的我的
我不能再想
我的爱的手 一点有美
我们 你的我 你不会再会爱不到
```

## Generate Linux Code

To train:

```
python train.py  \
  --input_file data/linux.txt \
  --num_steps 100 \
  --name linux \
  --learning_rate 0.01 \
  --num_seqs 32 \
  --max_steps 20000
```

To sample:

```
python sample.py \
  --converter_path model/linux/converter.pkl \
  --checkpoint_path  model/linux \
  --max_length 1000 
```

Result:

```
static int test_trace_task(struct rq *rq)
{
        read_user_cur_task(state);
        return trace_seq;
}

static int page_cpus(struct flags *str)
{
        int rc;
        struct rq *do_init;
};

/*
 * Core_trace_periods the time in is is that supsed,
 */
#endif

/*
 * Intendifint to state anded.
 */
int print_init(struct priority *rt)
{       /* Comment sighind if see task so and the sections */
        console(string, &can);
}
```

## Generate Japanese Text

To train:
```
python train.py  \
  --input_file data/jpn.txt \
  --num_steps 20 \
  --batch_size 32 \
  --name jpn \
  --max_steps 10000 \
  --learning_rate 0.01 \
  --use_embedding
```

To sample:
```
python sample.py \
  --converter_path model/jpn/converter.pkl \
  --checkpoint_path model/jpn \
  --max_length 1000 \
  --use_embedding
```

Result:
```
「ああ、それだ、」とお夏は、と夏のその、
「そうだっていると、お夏は、このお夏が、その時、
（あ、」
　と声にはお夏が、これは、この膝の方を引寄って、お夏に、
「まあ。」と、その時のお庇《おも》ながら、
```

## Acknowledgement

Forked from [hzy46/Char-RNN-TensorFlow](https://github.com/hzy46/Char-RNN-TensorFlow)

