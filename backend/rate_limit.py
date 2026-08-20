from ipaddress import ip_address
from typing import Optional


_FIXED_WINDOW_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if count == 1 or ttl < 0 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
return {count, ttl}
"""


def get_client_identity(request) -> str:
    peer_ip = request.client.host if request.client else "unknown"
    try:
        trust_cloudflare_header = ip_address(peer_ip).is_loopback
    except ValueError:
        trust_cloudflare_header = False

    if trust_cloudflare_header:
        cloudflare_ip = request.headers.get("cf-connecting-ip")
        if cloudflare_ip:
            try:
                return str(ip_address(cloudflare_ip.strip()))
            except ValueError:
                pass

    return peer_ip


def get_retry_after(
    redis_client,
    key: str,
    limit: int,
    window_seconds: int,
) -> Optional[int]:
    """Increment an atomic fixed-window counter and return retry seconds if blocked."""
    count, ttl = redis_client.eval(
        _FIXED_WINDOW_SCRIPT,
        1,
        key,
        window_seconds,
    )
    if int(count) <= limit:
        return None
    return max(int(ttl), 1)
