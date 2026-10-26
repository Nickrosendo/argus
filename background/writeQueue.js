// Serializes read-modify-write of data shared by the tracker, blocking and focus code
let storageWriteQueue = Promise.resolve();

// Run a storage task after the writes already queued and before later ones. A
// failing task rejects for its caller but does not stop the queue.
export function enqueueStorageWrite(task) {
  const result = storageWriteQueue.then(task);
  storageWriteQueue = result.catch((error) => console.error("Error in queued storage write:", error));
  return result;
}

// Promise that settles once every write queued so far is done (never rejects)
export function pendingStorageWrites() {
  return storageWriteQueue;
}

// Queue a task whose failure is only logged; resolves when the queue is idle again
export function queueStorageWrite(task, label) {
  const result = enqueueStorageWrite(task);
  return result.then(
    () => storageWriteQueue,
    (error) => {
      console.error(label, error);
      return storageWriteQueue;
    }
  );
}
