import { Job, ScheduleResult, CPUTimeSlot, QueueSnapshot } from "./types";

// Helper function to calculate average turnaround time
const calculateAverageTurnaroundTime = (
  jobResults: ScheduleResult["jobResults"]
): number => {
  const turnaroundTimes = Object.values(jobResults).map(
    (result) => result.turnaroundTime
  );
  
  if (turnaroundTimes.length === 0) return 0;
  
  return (
    turnaroundTimes.reduce((sum, time) => sum + time, 0) / turnaroundTimes.length
  );
};

// Calculate CPU Utilization (excluding overhead)
const calculateCPUUtilization = (
  cpuTimeSlots: CPUTimeSlot[],
  totalTime: number,
  cpuCount: number
): number => {
  if (totalTime <= 0) return 0;
  
  const productiveTimeSlots = cpuTimeSlots.filter(slot => !slot.isOverhead);
  const totalProductiveTime = productiveTimeSlots.reduce(
    (sum, slot) => sum + (slot.endTime - slot.startTime),
    0
  );
  
  return (totalProductiveTime / (totalTime * cpuCount)) * 100;
};

// Sort function for job queue by arrival time
const sortByArrivalTime = (a: Job, b: Job): number => {
  if (a.arrivalTime !== b.arrivalTime) {
    return a.arrivalTime - b.arrivalTime;
  }
  return a.id.localeCompare(b.id);
};

// Sort function for SRTN - by remaining time, then arrival time
const sortByRemainingTime = (a: Job, b: Job): number => {
  if (a.remainingTime !== b.remainingTime) {
    return a.remainingTime - b.remainingTime;
  }
  return a.arrivalTime - b.arrivalTime;
};

// Create a deep copy of jobs
const deepCopyJobs = (jobs: Job[]): Job[] => {
  return JSON.parse(JSON.stringify(jobs)) as Job[];
};

// Take a snapshot of the ready queue
const takeQueueSnapshot = (
  time: number, 
  readyQueue: Job[]
): QueueSnapshot => {
  return {
    time,
    readyQueue: deepCopyJobs(readyQueue)
  };
};

export const calculateSRTN = (
  jobs: Job[], 
  cpuCount: number, 
  switchingOverhead: number = 0
): ScheduleResult => {
  // Create deep copies of jobs to avoid modifying the original array
  let remainingJobs = deepCopyJobs(jobs);
  let runningJobs: Job[] = [];
  let completedJobs: Job[] = [];
  let cpuTimeSlots: CPUTimeSlot[] = [];
  let queueSnapshots: QueueSnapshot[] = [];
  let currentTime = 0;
  let jobResults: { [jobId: string]: { startTime: number; endTime: number; turnaroundTime: number } } = {};
  
  // Initialize job start times to track when each job first starts
  const jobStartTimes: { [jobId: string]: number | null } = {};
  jobs.forEach((job) => {
    jobStartTimes[job.id] = null;
  });
  
  // Initialize CPU states
  const cpuJobs: (Job | null)[] = Array(cpuCount).fill(null);
  const cpuOverheadEndTimes: number[] = Array(cpuCount).fill(0);
  
  // Sort jobs by arrival time initially
  remainingJobs.sort(sortByArrivalTime);
  
  // Take initial queue snapshot
  queueSnapshots.push(takeQueueSnapshot(0, []));
  
  // Continue until all jobs are completed
  while (remainingJobs.length > 0 || runningJobs.length > 0 || cpuJobs.some(job => job !== null)) {
    // Move jobs that have arrived to the running queue
    const newlyArrivedJobs: Job[] = [];
    
    for (let i = 0; i < remainingJobs.length; i++) {
      if (remainingJobs[i].arrivalTime <= currentTime) {
        newlyArrivedJobs.push(remainingJobs[i]);
      } else {
        break;
      }
    }
    
    remainingJobs = remainingJobs.filter(
      (job) => job.arrivalTime > currentTime
    );
    runningJobs.push(...newlyArrivedJobs);
    
    // Sort running jobs by remaining time (SRTN algorithm)
    runningJobs.sort(sortByRemainingTime);
    
    // Take queue snapshot after sorting
    if (newlyArrivedJobs.length > 0 || runningJobs.length > 0) {
      queueSnapshots.push(takeQueueSnapshot(currentTime, runningJobs));
    }
    
    // Check if any CPU is in overhead time
    for (let i = 0; i < cpuCount; i++) {
      if (cpuOverheadEndTimes[i] > currentTime) {
        // This CPU is still in overhead time, can't assign new job
        continue;
      }
      
      // If CPU is idle or we have a better job, consider preemption
      if (cpuJobs[i] === null || (runningJobs.length > 0 && 
          runningJobs[0].remainingTime < cpuJobs[i]!.remainingTime)) {
        
        // If there's a job running on this CPU, preempt it
        if (cpuJobs[i] !== null) {
          // Put current job back in running queue
          runningJobs.push(cpuJobs[i]!);
          
          // Add switching overhead if specified
          if (switchingOverhead > 0) {
            cpuOverheadEndTimes[i] = currentTime + switchingOverhead;
            cpuTimeSlots.push({
              cpuId: i,
              jobId: "OVERHEAD",
              startTime: currentTime,
              endTime: cpuOverheadEndTimes[i],
              isOverhead: true
            });
          }
          
          // Free the CPU
          cpuJobs[i] = null;
          continue;
        }
        
        // If there's a job waiting and CPU isn't in overhead time
        if (runningJobs.length > 0 && cpuOverheadEndTimes[i] <= currentTime) {
          cpuJobs[i] = runningJobs.shift()!;
          
          // Record job start time if this is the first time it's running
          if (jobStartTimes[cpuJobs[i]!.id] === null) {
            jobStartTimes[cpuJobs[i]!.id] = currentTime;
          }
        }
      }
    }
    
    // Find the time until the next event (job arrival, completion, or overhead end)
    let nextEventTime = Infinity;
    
    // Check next job arrival
    if (remainingJobs.length > 0) {
      nextEventTime = remainingJobs[0].arrivalTime;
    }
    
    // Check overhead end times
    for (let i = 0; i < cpuCount; i++) {
      if (cpuOverheadEndTimes[i] > currentTime) {
        nextEventTime = Math.min(nextEventTime, cpuOverheadEndTimes[i]);
      }
    }
    
    // Check job completions on CPUs
    for (let i = 0; i < cpuCount; i++) {
      if (cpuJobs[i] !== null && cpuOverheadEndTimes[i] <= currentTime) {
        // Time to complete the currently running job
        const timeToComplete = cpuJobs[i]!.remainingTime;
        nextEventTime = Math.min(nextEventTime, currentTime + timeToComplete);
      }
    }
    
    // If all CPUs are idle but there are more jobs coming, jump to next arrival
    if (nextEventTime === Infinity && remainingJobs.length > 0) {
      nextEventTime = remainingJobs[0].arrivalTime;
    }
    
    // If no next event (should not happen), break the loop
    if (nextEventTime === Infinity) break;
    
    // Process time until next event
    for (let i = 0; i < cpuCount; i++) {
      if (cpuJobs[i] !== null && cpuOverheadEndTimes[i] <= currentTime) {
        const job = cpuJobs[i]!;
        const timeSpent = nextEventTime - currentTime;
        
        // Create time slot for this CPU usage
        cpuTimeSlots.push({
          cpuId: i,
          jobId: job.id,
          startTime: currentTime,
          endTime: nextEventTime
        });
        
        // Update job remaining time
        job.remainingTime -= timeSpent;
        
        // Check if job is completed
        if (job.remainingTime <= 0.00001) { // Using small epsilon for floating point comparison
          completedJobs.push(job);
          
          // Record job completion
          jobResults[job.id] = {
            startTime: jobStartTimes[job.id]!,
            endTime: nextEventTime,
            turnaroundTime: nextEventTime - job.arrivalTime,
          };
          
          // Free the CPU
          cpuJobs[i] = null;
          
          // If there's a new job available to run, check if we should add switching overhead
          if (runningJobs.length > 0) {
            if (switchingOverhead > 0) {
              cpuOverheadEndTimes[i] = nextEventTime + switchingOverhead;
              cpuTimeSlots.push({
                cpuId: i,
                jobId: "OVERHEAD",
                startTime: nextEventTime,
                endTime: cpuOverheadEndTimes[i],
                isOverhead: true
              });
            } else {
              // If no overhead, assign new job immediately
              cpuJobs[i] = runningJobs.shift()!;
              
              if (jobStartTimes[cpuJobs[i]!.id] === null) {
                jobStartTimes[cpuJobs[i]!.id] = nextEventTime;
              }
            }
          }
        }
      }
    }
    
    // Advance time to next event
    currentTime = nextEventTime;
  }
  
  // Calculate average turnaround time
  const averageTurnaroundTime = calculateAverageTurnaroundTime(jobResults);
  
  // Calculate CPU utilization
  const totalTime = cpuTimeSlots.length > 0 
    ? Math.max(...cpuTimeSlots.map(slot => slot.endTime)) 
    : 0;
  const cpuUtilization = calculateCPUUtilization(cpuTimeSlots, totalTime, cpuCount);
  
  return {
    jobResults,
    cpuTimeSlots,
    queueSnapshots,
    averageTurnaroundTime,
    cpuUtilization
  };
};

export const calculateRoundRobin = (
  jobs: Job[],
  cpuCount: number,
  timeQuantum: number,
  switchingOverhead: number = 0
): ScheduleResult => {
  // Create deep copies of jobs to avoid modifying the original array
  let remainingJobs = deepCopyJobs(jobs);
  let readyQueue: Job[] = [];
  let completedJobs: Job[] = [];
  let cpuTimeSlots: CPUTimeSlot[] = [];
  let queueSnapshots: QueueSnapshot[] = [];
  let currentTime = 0;
  let jobResults: { [jobId: string]: { startTime: number; endTime: number; turnaroundTime: number } } = {};
  
  // Initialize job start times to track when each job first starts
  const jobStartTimes: { [jobId: string]: number | null } = {};
  jobs.forEach((job) => {
    jobStartTimes[job.id] = null;
  });
  
  // Initialize CPU states
  const cpuJobs: (Job | null)[] = Array(cpuCount).fill(null);
  const cpuTimeRemaining: number[] = Array(cpuCount).fill(0);
  const cpuOverheadEndTimes: number[] = Array(cpuCount).fill(0);
  
  // Sort jobs by arrival time initially
  remainingJobs.sort(sortByArrivalTime);
  
  // Take initial queue snapshot
  queueSnapshots.push(takeQueueSnapshot(0, []));
  
  // Continue until all jobs are processed
  while (remainingJobs.length > 0 || readyQueue.length > 0 || cpuJobs.some(job => job !== null)) {
    // Move jobs that have arrived to the ready queue
    const newlyArrivedJobs: Job[] = [];
    
    for (let i = 0; i < remainingJobs.length; i++) {
      if (remainingJobs[i].arrivalTime <= currentTime) {
        newlyArrivedJobs.push(remainingJobs[i]);
      } else {
        break;
      }
    }
    
    remainingJobs = remainingJobs.filter(
      (job) => job.arrivalTime > currentTime
    );
    readyQueue.push(...newlyArrivedJobs);
    
    // Take queue snapshot if jobs arrived or queue changed
    if (newlyArrivedJobs.length > 0 || readyQueue.length > 0) {
      queueSnapshots.push(takeQueueSnapshot(currentTime, readyQueue));
    }
    
    // Assign jobs to available CPUs
    for (let i = 0; i < cpuCount; i++) {
      // Skip if CPU is in overhead time
      if (cpuOverheadEndTimes[i] > currentTime) {
        continue;
      }
      
      // If CPU is empty and there are jobs in the ready queue, assign one
      if (cpuJobs[i] === null && readyQueue.length > 0) {
        cpuJobs[i] = readyQueue.shift()!;
        cpuTimeRemaining[i] = Math.min(timeQuantum, cpuJobs[i]!.remainingTime);
        
        // Record job start time if this is the first time it's running
        if (jobStartTimes[cpuJobs[i]!.id] === null) {
          jobStartTimes[cpuJobs[i]!.id] = currentTime;
        }
      }
    }
    
    // Find the time until the next event (job arrival, quantum expiration, job completion, or overhead end)
    let nextEventTime = Infinity;
    
    // Check next job arrival
    if (remainingJobs.length > 0) {
      nextEventTime = remainingJobs[0].arrivalTime;
    }
    
    // Check overhead end times
    for (let i = 0; i < cpuCount; i++) {
      if (cpuOverheadEndTimes[i] > currentTime) {
        nextEventTime = Math.min(nextEventTime, cpuOverheadEndTimes[i]);
      }
    }
    
    // Check quantum expirations and job completions on CPUs
    for (let i = 0; i < cpuCount; i++) {
      if (cpuJobs[i] !== null && cpuOverheadEndTimes[i] <= currentTime) {
        // Time until quantum expires or job completes (whichever comes first)
        const timeUntilEvent = cpuTimeRemaining[i];
        
        if (timeUntilEvent > 0) {
          nextEventTime = Math.min(nextEventTime, currentTime + timeUntilEvent);
        }
      }
    }
    
    // If all CPUs are idle but there are more jobs coming, jump to next arrival
    if (nextEventTime === Infinity && remainingJobs.length > 0) {
      nextEventTime = remainingJobs[0].arrivalTime;
    }
    
    // If no next event, break the loop
    if (nextEventTime === Infinity) break;
    
    // Process time until next event
    for (let i = 0; i < cpuCount; i++) {
      if (cpuJobs[i] !== null && cpuOverheadEndTimes[i] <= currentTime) {
        const job = cpuJobs[i]!;
        const timeSpent = nextEventTime - currentTime;
        
        // Create time slot for this CPU usage
        cpuTimeSlots.push({
          cpuId: i,
          jobId: job.id,
          startTime: currentTime,
          endTime: nextEventTime
        });
        
        // Update job remaining time and quantum
        job.remainingTime -= timeSpent;
        cpuTimeRemaining[i] -= timeSpent;
        
        // Check if job is completed
        if (job.remainingTime <= 0.00001) { // Using small epsilon for floating point comparison
          completedJobs.push(job);
          
          // Record job completion
          jobResults[job.id] = {
            startTime: jobStartTimes[job.id]!,
            endTime: nextEventTime,
            turnaroundTime: nextEventTime - job.arrivalTime,
          };
          
          // Free the CPU after job completes
          cpuJobs[i] = null;
          
          // If there's a new job available to run, add switching overhead and assign it
          if (readyQueue.length > 0) {
            if (switchingOverhead > 0) {
              cpuOverheadEndTimes[i] = nextEventTime + switchingOverhead;
              cpuTimeSlots.push({
                cpuId: i,
                jobId: "OVERHEAD",
                startTime: nextEventTime,
                endTime: cpuOverheadEndTimes[i],
                isOverhead: true
              });
            } else {
              // If no overhead, assign new job immediately
              cpuJobs[i] = readyQueue.shift()!;
              cpuTimeRemaining[i] = Math.min(timeQuantum, cpuJobs[i]!.remainingTime);
              
              if (jobStartTimes[cpuJobs[i]!.id] === null) {
                jobStartTimes[cpuJobs[i]!.id] = nextEventTime;
              }
            }
          }
        }
        // Check if quantum expired (but job not completed)
        else if (cpuTimeRemaining[i] <= 0.00001) {
          // Add switching overhead if specified
          if (switchingOverhead > 0) {
            cpuOverheadEndTimes[i] = nextEventTime + switchingOverhead;
            cpuTimeSlots.push({
              cpuId: i,
              jobId: "OVERHEAD",
              startTime: nextEventTime,
              endTime: cpuOverheadEndTimes[i],
              isOverhead: true
            });
          }
          
          // Put job back in ready queue
          readyQueue.push(job);
          
          // Free the CPU
          cpuJobs[i] = null;
          
          // If no overhead and there are jobs in the queue, assign a new job immediately
          if (switchingOverhead <= 0 && readyQueue.length > 0) {
            cpuJobs[i] = readyQueue.shift()!;
            cpuTimeRemaining[i] = Math.min(timeQuantum, cpuJobs[i]!.remainingTime);
            
            if (jobStartTimes[cpuJobs[i]!.id] === null) {
              jobStartTimes[cpuJobs[i]!.id] = nextEventTime;
            }
          }
        }
      }
    }
    
    // Advance time to next event
    currentTime = nextEventTime;
  }
  
  // Calculate average turnaround time
  const averageTurnaroundTime = calculateAverageTurnaroundTime(jobResults);
  
  // Calculate CPU utilization
  const totalTime = cpuTimeSlots.length > 0 
    ? Math.max(...cpuTimeSlots.map(slot => slot.endTime)) 
    : 0;
  const cpuUtilization = calculateCPUUtilization(cpuTimeSlots, totalTime, cpuCount);
  
  return {
    jobResults,
    cpuTimeSlots,
    queueSnapshots,
    averageTurnaroundTime,
    cpuUtilization
  };
};
