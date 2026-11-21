"""One bounded retry for transport failures, never for HTTP responses."""
import json
import time
import urllib.error
import urllib.request


def fetch_json(url, *, opener=None, sleep=None):
    opener = opener or urllib.request.urlopen
    sleep = sleep or time.sleep
    for attempt in range(2):
        try:
            with opener(url, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError:
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 1:
                raise
            print('Source transport failure, retrying once in 2 seconds', flush=True)
            sleep(2)
