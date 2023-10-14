const queue = [];
let isPendingFlush = false;
let isFlush = false;

const flushJobs = () => {
  isFlushPending = false;
  isFlush = true;
  try {
    for (let i = 0; i < queue.length; i++) {
      queue[i]();
    }
  } finally {
    queue.length = 0;
    isFlush = false;
  }
};

const queueFlush = () => {
  if (!isPendingFlush && !isFlush) {
    isPendingFlush = true;
    Promise.resolve().then(flushJobs);
  }
};

const queueJob = (job) => {
  if (!queue.length || !queue.includes(job)) {
    queue.push(job);
  }
  queueFlush();
};

function test() {
  const job1 = () => {
    console.log('job1');
  };
  const job2 = () => {
    console.log('job2');
  };
  const job3 = () => {
    console.log('job3');
  };
  queueJob(job1);
  queueJob(job2);
  queueJob(job3);
}

test();
