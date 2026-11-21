import io
import sys
import urllib.error
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'pipeline'))
from http_retry import fetch_json

for mode in ['success', 'recover', 'exhaust', 'http', 'invalid-json']:
    calls, waits = [], []
    def opener(url, timeout):
        calls.append(url)
        assert timeout == 30
        if mode == 'exhaust' or (mode == 'recover' and len(calls) == 1):
            raise urllib.error.URLError(TimeoutError())
        if mode == 'http':
            raise urllib.error.HTTPError(url, 429, 'limited', {}, None)
        return io.StringIO('bad json' if mode == 'invalid-json' else '{"value":1}')
    failed = False
    try:
        assert fetch_json('https://example.invalid', opener=opener, sleep=waits.append) == {'value': 1}
    except (urllib.error.URLError, ValueError):
        failed = True
    assert failed == (mode in ['exhaust', 'http', 'invalid-json'])
    assert len(calls) == (2 if mode in ['recover', 'exhaust'] else 1)
    assert waits == ([2] if mode in ['recover', 'exhaust'] else [])
print('PASS: Python success, transport recovery, bounded exhaustion, no HTTP/parse retry')
