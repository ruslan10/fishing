import {setTimeout as delay} from 'node:timers/promises';

// One transport retry per request, never repeat a successful response or HTTP error.
export async function fetchJsonWithRetry(url, label, {
  fetchImpl = globalThis.fetch, sleep = delay, timeoutMs = 30000
} = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, {signal: AbortSignal.timeout(timeoutMs)});
    } catch (error) {
      if (attempt === 1 || !['TypeError', 'TimeoutError', 'AbortError'].includes(error.name)) throw error;
      console.error(`${label}: transport failure, retrying once in 2 seconds`);
      await sleep(2000);
      continue;
    }
    if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
    return response.json();
  }
}
