import tensorflow as tf
from absl import app
from absl import flags
from .read_utils import TextConverter
from .model import CharRNN
import os
import logging

logging.getLogger('tensorflow').setLevel(logging.ERROR)

flags.DEFINE_integer('lstm_size', 128, 'size of hidden state of lstm')
flags.DEFINE_integer('num_layers', 2, 'number of lstm layers')
flags.DEFINE_boolean('use_embedding', False, 'whether to use embedding')
flags.DEFINE_integer('embedding_size', 128, 'size of embedding')
flags.DEFINE_string('converter_path', '', 'model/name/converter.pkl')
flags.DEFINE_string('checkpoint_path', '', 'checkpoint path')
flags.DEFINE_string('start_string', '', 'use this string to start generating')
flags.DEFINE_integer('max_length', 30, 'max length to generate')


def main(_):
    converter = TextConverter(filename=flags.FLAGS.converter_path)
    if os.path.isdir(flags.FLAGS.checkpoint_path):
        flags.FLAGS.checkpoint_path =\
            tf.train.latest_checkpoint(flags.FLAGS.checkpoint_path)

    model = CharRNN(converter.vocab_size, sampling=True,
                    lstm_size=flags.FLAGS.lstm_size, num_layers=flags.FLAGS.num_layers,
                    use_embedding=flags.FLAGS.use_embedding,
                    embedding_size=flags.FLAGS.embedding_size)

    model.load(flags.FLAGS.checkpoint_path, False)

    start = converter.text_to_arr(flags.FLAGS.start_string)
    arr = model.sample(flags.FLAGS.max_length, start, converter.vocab_size)
    print(converter.arr_to_text(arr))


if __name__ == '__main__':
    app.run(main)
