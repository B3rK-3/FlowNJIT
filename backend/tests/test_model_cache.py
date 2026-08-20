import sys
import types
import unittest
from unittest.mock import patch

import backend.constants as constants


class ModelCacheTests(unittest.TestCase):
    def setUp(self):
        constants._device = "cpu"
        constants._ef = None
        constants._CROSS_ENCODER = None

    def tearDown(self):
        constants._ef = None
        constants._CROSS_ENCODER = None

    def test_cached_models_never_enable_network_access(self):
        embedding_calls = []
        cross_encoder_calls = []

        class EmbeddingFunction:
            def __init__(self, *args, **kwargs):
                embedding_calls.append(kwargs)

        class CrossEncoder:
            def __init__(self, *args, **kwargs):
                cross_encoder_calls.append(kwargs)

        modules = self._fake_modules(EmbeddingFunction, CrossEncoder)
        with patch.dict(sys.modules, modules):
            self.assertIs(constants.get_ef(), constants.get_ef())
            self.assertIs(
                constants.get_cross_encoder(), constants.get_cross_encoder()
            )

        self.assertEqual(
            [call["local_files_only"] for call in embedding_calls], [True]
        )
        self.assertEqual(
            [call["local_files_only"] for call in cross_encoder_calls], [True]
        )

    def test_missing_models_download_after_local_lookup_fails(self):
        embedding_calls = []
        cross_encoder_calls = []

        class EmbeddingFunction:
            def __init__(self, *args, **kwargs):
                embedding_calls.append(kwargs)
                if kwargs["local_files_only"]:
                    raise OSError("not cached")

        class CrossEncoder:
            def __init__(self, *args, **kwargs):
                cross_encoder_calls.append(kwargs)
                if kwargs["local_files_only"]:
                    raise OSError("not cached")

        modules = self._fake_modules(EmbeddingFunction, CrossEncoder)
        with patch.dict(sys.modules, modules):
            constants.get_ef()
            constants.get_cross_encoder()

        self.assertEqual(
            [call["local_files_only"] for call in embedding_calls], [True, False]
        )
        self.assertEqual(
            [call["local_files_only"] for call in cross_encoder_calls], [True, False]
        )

    @staticmethod
    def _fake_modules(embedding_function, cross_encoder):
        embedding_functions = types.SimpleNamespace(
            SentenceTransformerEmbeddingFunction=embedding_function
        )
        chromadb_utils = types.ModuleType("chromadb.utils")
        chromadb_utils.embedding_functions = embedding_functions
        chromadb = types.ModuleType("chromadb")
        chromadb.utils = chromadb_utils

        sentence_transformers = types.ModuleType("sentence_transformers")
        sentence_transformers.CrossEncoder = cross_encoder

        return {
            "chromadb": chromadb,
            "chromadb.utils": chromadb_utils,
            "sentence_transformers": sentence_transformers,
        }


if __name__ == "__main__":
    unittest.main()
