type Job = () => Promise<void>;

const queue: Job[] = [];
let processing = false;

/** Fire-and-forget async job queue — keeps notification dispatch off the request path. */
export function enqueue(job: Job): void {
  queue.push(job);
  void drain();
}

async function drain() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    try {
      await job();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[queue] job failed:", err);
    }
  }
  processing = false;
}
