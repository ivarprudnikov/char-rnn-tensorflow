from absl import app
from absl import flags
from .read_utils import TextConverter, batch_generator
from .model import CharRNN
import os
import codecs
import re
import logging

logging.getLogger('tensorflow').setLevel(logging.ERROR)

flags.DEFINE_string('name', 'default', 'name of the model')
flags.DEFINE_integer('num_seqs', 100, 'number of seqs in one batch')
flags.DEFINE_integer('num_steps', 100, 'length of one seq')
flags.DEFINE_integer('lstm_size', 128, 'size of hidden state of lstm')
flags.DEFINE_integer('num_layers', 2, 'number of lstm layers')
flags.DEFINE_boolean('use_embedding', False, 'whether to use embedding')
flags.DEFINE_integer('embedding_size', 128, 'size of embedding')
flags.DEFINE_float('learning_rate', 0.001, 'learning_rate')
flags.DEFINE_float('train_keep_prob', 0.5, 'dropout rate during training')
flags.DEFINE_string('input_file', '', 'utf8 encoded text file')
flags.DEFINE_string('whitelist_file', '', 'utf8 encoded text file')
flags.DEFINE_integer('max_steps', 100000, 'max steps to train')
flags.DEFINE_integer('save_every_n', 1000, 'save the model every n steps')
flags.DEFINE_integer('log_every_n', 10, 'log to the screen every n steps')
flags.DEFINE_integer('max_vocab', 3500, 'max char number')


def remove_non_matching_chars(text, whitelist):
    print("leaving only characters that match " + whitelist)
    # to lowercase
    text = text.lower()
    text = re.sub(r'[^' + whitelist + ']', ' ', text)
    text = text.replace('\n',' ')
    text = text.replace('\r',' ')
    # shorten any extra dead space created above
    text = text.replace('  ',' ')
    print("cleaned corpus size " + str(len(text)))
    return text


# TODO change into TF2 version using https://github.com/tensorflow/docs/blob/master/site/en/tutorials/text/text_generation.ipynb
def main(_):
    script_path = os.path.abspath(os.path.dirname(__file__))
    model_path = os.path.join(script_path, 'model', flags.FLAGS.name)
    if os.path.exists(model_path) is False:
        os.makedirs(model_path)
    with codecs.open(flags.FLAGS.input_file, encoding='utf-8') as f:
        text = f.read()
    print("corpus size " + str(len(text)))

    if os.path.exists(flags.FLAGS.whitelist_file):
        with codecs.open(flags.FLAGS.whitelist_file, encoding='utf-8') as f:
            whitelist = f.read()
        text = remove_non_matching_chars(text, whitelist)

    converter = TextConverter(text, flags.FLAGS.max_vocab)
    converter.save_to_file(os.path.join(model_path, 'converter.pkl'))

    arr = converter.text_to_arr(text)
    g = batch_generator(arr, flags.FLAGS.num_seqs, flags.FLAGS.num_steps)
    model = CharRNN(converter.vocab_size,
                    num_seqs=flags.FLAGS.num_seqs,
                    num_steps=flags.FLAGS.num_steps,
                    lstm_size=flags.FLAGS.lstm_size,
                    num_layers=flags.FLAGS.num_layers,
                    learning_rate=flags.FLAGS.learning_rate,
                    train_keep_prob=flags.FLAGS.train_keep_prob,
                    use_embedding=flags.FLAGS.use_embedding,
                    embedding_size=flags.FLAGS.embedding_size
                    )
    model.train(g,
                flags.FLAGS.max_steps,
                model_path,
                flags.FLAGS.save_every_n,
                flags.FLAGS.log_every_n,
                )


if __name__ == '__main__':
    app.run(main)
