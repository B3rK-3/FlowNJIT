import types
import unittest

from backend.rate_limit import get_client_identity, get_retry_after


class RedisWindow:
    def __init__(self):
        self.count = 0
        self.ttl = 60

    def eval(self, script, key_count, key, window_seconds):
        self.asserted_script = script
        self.asserted_arguments = (key_count, key, window_seconds)
        self.count += 1
        return [self.count, self.ttl]

    def reset(self):
        self.count = 0


class RateLimitTests(unittest.TestCase):
    def test_allows_five_requests_then_returns_retry_delay(self):
        redis = RedisWindow()

        for _ in range(5):
            self.assertIsNone(
                get_retry_after(redis, "rate-limit:chat:test", 5, 60)
            )

        self.assertEqual(
            get_retry_after(redis, "rate-limit:chat:test", 5, 60),
            60,
        )
        self.assertEqual(redis.asserted_arguments, (1, "rate-limit:chat:test", 60))
        self.assertIn("INCR", redis.asserted_script)
        self.assertIn("EXPIRE", redis.asserted_script)

    def test_new_window_allows_requests_again(self):
        redis = RedisWindow()
        redis.count = 5
        self.assertEqual(get_retry_after(redis, "key", 5, 60), 60)

        redis.reset()
        self.assertIsNone(get_retry_after(redis, "key", 5, 60))

    def test_uses_cloudflare_ip_only_behind_loopback_proxy(self):
        proxied_request = types.SimpleNamespace(
            client=types.SimpleNamespace(host="127.0.0.1"),
            headers={"cf-connecting-ip": "203.0.113.10"},
        )
        direct_request = types.SimpleNamespace(
            client=types.SimpleNamespace(host="192.168.1.25"),
            headers={"cf-connecting-ip": "203.0.113.11"},
        )

        self.assertEqual(get_client_identity(proxied_request), "203.0.113.10")
        self.assertEqual(get_client_identity(direct_request), "192.168.1.25")


if __name__ == "__main__":
    unittest.main()
