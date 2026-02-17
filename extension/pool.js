/**
 * Retry and Concurrency Pool utilities
 */

/**
 * Fetch with automatic retry on transient errors
 * Retries on: HTTP 429 (rate limit), 5xx (server error), network errors
 * Does NOT retry on: 4xx client errors (except 429)
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) return response;

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * Math.pow(2, attempt), 10000);

        if (attempt < maxRetries) {
          console.log(`Retry ${attempt + 1}/${maxRetries} for ${url} after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      throw new Error(`HTTP ${response.status} for ${url}`);
    } catch (err) {
      if (err.name === 'TypeError' && attempt < maxRetries) {
        lastError = err;
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Network retry ${attempt + 1}/${maxRetries} for ${url} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

/**
 * Concurrency-limited task pool
 * Runs up to `concurrency` tasks in parallel, starting new ones as slots open.
 * More efficient than fixed batching since it doesn't wait for all N to complete.
 */
class ConcurrencyPool {
  constructor(concurrency = 10, staggerMs = 50) {
    this.concurrency = concurrency;
    this.staggerMs = staggerMs;
  }

  run(tasks, onComplete) {
    return new Promise((resolve) => {
      const results = new Array(tasks.length);
      const errors = [];
      let nextIndex = 0;
      let running = 0;
      let completed = 0;

      const tryRunNext = () => {
        while (running < this.concurrency && nextIndex < tasks.length) {
          const idx = nextIndex++;
          running++;

          const delay = idx < this.concurrency ? idx * this.staggerMs : 0;

          setTimeout(async () => {
            try {
              results[idx] = await tasks[idx]();
              if (onComplete) onComplete(idx, results[idx], null);
            } catch (err) {
              errors.push({ index: idx, error: err });
              if (onComplete) onComplete(idx, null, err);
            } finally {
              running--;
              completed++;
              if (completed >= tasks.length) {
                resolve({ results, errors });
              } else {
                tryRunNext();
              }
            }
          }, delay);
        }
      };

      if (tasks.length === 0) {
        resolve({ results: [], errors: [] });
      } else {
        tryRunNext();
      }
    });
  }
}
