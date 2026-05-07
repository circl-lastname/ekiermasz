export class Mutex {
  constructor() {
    this.lock = null;
    this.queue = [];
  }
  
  acquire() {
    return new Promise((resolve) => {
      if (this.lock) {
        this.queue.push(resolve);
      } else {
        let lock = new MutexLock(this);
        this.lock = lock;
        resolve(lock);
      }
    });
  }
  
  release(lock) {
    if (this.lock === lock) {
      let resolve = this.queue.shift();
      if (resolve) {
        let newLock = new MutexLock(this);
        this.lock = newLock;
        resolve(newLock);
      } else {
        this.lock = null;
      }
    } else {
      throw new Error("Invalid lock for this mutex");
    }
  }
}

class MutexLock {
  constructor(mutex) {
    this.mutex = mutex;
  }
  
  release() {
    this.mutex.release(this);
  }
}
