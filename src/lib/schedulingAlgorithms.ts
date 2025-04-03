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

// Calculate CPU Utilization (excluding idle time)
const calculateCPUUtilization = (
  cpuTimeSlots: CPUTimeSlot[],
  totalTime: number,
  cpuCount: number
): number => {
  if (totalTime <= 0) return 0;
  
  const productiveTimeSlots = cpuTimeSlots.filter(slot => !slot.isIdle);
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
  scheduleMode: "quantum" | "endTime" = "quantum"
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
  
  // For quantum-based scheduling
  let nextQuantumTime = 0;
  const timeQuantum = 1; // Default time quantum for SRTN
  
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
    
    // For quantum-based scheduling, check if we've reached a quantum boundary
    if (scheduleMode === "quantum" && currentTime >= nextQuantumTime) {
      // At quantum boundary, assign jobs to CPUs
      for (let i = 0; i < cpuCount; i++) {
        // If CPU is idle and there are jobs in the queue, assign one
        if ((cpuJobs[i] === null || cpuJobs[i]?.remainingTime <= 0) && runningJobs.length > 0) {
          if (cpuJobs[i] !== null && cpuJobs[i]?.remainingTime <= 0) {
            // Job completed
            completedJobs.push(cpuJobs[i]!);
            
            // Record job completion
            jobResults[cpuJobs[i]!.id] = {
              startTime: jobStartTimes[cpuJobs[i]!.id]!,
              endTime: currentTime,
              turnaroundTime: currentTime - cpuJobs[i]!.arrivalTime,
            };
            
            // Free the CPU
            cpuJobs[i] = null;
          }
          
          // Assign new job
          cpuJobs[i] = runningJobs.shift()!;
          
          // Record job start time if this is the first time it's running
          if (jobStartTimes[cpuJobs[i]!.id] === null) {
            jobStartTimes[cpuJobs[i]!.id] = currentTime;
          }
        }
      }
      
      // Schedule next quantum
      nextQuantumTime = currentTime + timeQuantum;
    }
    
    // For end-time based SRTN scheduling
    if (scheduleMode === "endTime") {
      // Check for idle CPUs and assign jobs if available
      for (let i = 0; i < cpuCount; i++) {
        // If CPU is idle and there are jobs in the queue, assign one
        if (cpuJobs[i] === null && runningJobs.length > 0) {
          cpuJobs[i] = runningJobs.shift()!;
          
          // Record job start time if this is the first time it's running
          if (jobStartTimes[cpuJobs[i]!.id] === null) {
            jobStartTimes[cpuJobs[i]!.id] = currentTime;
          }
        }
      }
      
      // Collect all jobs (CPU assigned and in queue)
      let allJobs: Job[] = [];
      for (let i = 0; i < cpuCount; i++) {
        if (cpuJobs[i] !== null) {
          allJobs.push(cpuJobs[i]!);
          cpuJobs[i] = null;
        }
      }
      
      // Add jobs from queue
      allJobs = [...allJobs, ...runningJobs];
      
      // Sort all jobs by remaining time
      allJobs.sort(sortByRemainingTime);
      
      // Clear running queue
      runningJobs = [];
      
      // Reassign jobs giving priority to CPU order
      for (let i = 0; i < Math.min(cpuCount, allJobs.length); i++) {
        cpuJobs[i] = allJobs[i];
        
        // Record job start time if this is the first time it's running
        if (jobStartTimes[cpuJobs[i]!.id] === null) {
          jobStartTimes[cpuJobs[i]!.id] = currentTime;
        }
      }
      
      // Push remaining jobs to running queue
      if (allJobs.length > cpuCount) {
        runningJobs = allJobs.slice(cpuCount);
      }
      
      // Take a new queue snapshot after reassignment
      if (runningJobs.length > 0) {
        queueSnapshots.push(takeQueueSnapshot(currentTime, runningJobs));
      }
    }
    
    // Find the time until the next event (job arrival, completion, or quantum boundary)
    let nextEventTime = Infinity;
    
    // Check next job arrival
    if (remainingJobs.length > 0) {
      nextEventTime = remainingJobs[0].arrivalTime;
    }
    
    // For quantum-based scheduling, consider the next quantum boundary
    if (scheduleMode === "quantum") {
      nextEventTime = Math.min(nextEventTime, nextQuantumTime);
    }
    
    // Check job completions on CPUs
    for (let i = 0; i < cpuCount; i++) {
      if (cpuJobs[i] !== null) {
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
      if (cpuJobs[i] !== null) {
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
          // In quantum-based scheduling, if job completes before quantum ends,
          // leave the CPU idle until the next quantum
          if (scheduleMode === "quantum" && nextEventTime < nextQuantumTime) {
            // Add idle slot from job completion to end of quantum
            cpuTimeSlots.push({
              cpuId: i,
              jobId: "Idle",
              startTime: nextEventTime,
              endTime: nextQuantumTime,
              isIdle: true
            });
            
            // CPU remains idle until next quantum
            cpuJobs[i] = null;
          } else if (scheduleMode === "endTime") {
            // For end-time scheduling, mark as completed
            completedJobs.push(job);
            
            // Record job completion
            jobResults[job.id] = {
              startTime: jobStartTimes[job.id]!,
              endTime: nextEventTime,
              turnaroundTime: nextEventTime - job.arrivalTime,
            };
            
            // Free the CPU
            cpuJobs[i] = null;
            
            // Immediately assign new job if available
            if (runningJobs.length > 0) {
              cpuJobs[i] = runningJobs.shift()!;
              
              if (jobStartTimes[cpuJobs[i]!.id] === null) {
                jobStartTimes[cpuJobs[i]!.id] = nextEventTime;
              }
            }
          }
        }
      }
    }
    
    // For quantum-based scheduling, handle job completions at quantum boundaries
    if (scheduleMode === "quantum" && nextEventTime === nextQuantumTime) {
      for (let i = 0; i < cpuCount; i++) {
        if (cpuJobs[i] !== null && cpuJobs[i]!.remainingTime <= 0.00001) {
          // Job completed
          completedJobs.push(cpuJobs[i]!);
          
          // Record job completion
          jobResults[cpuJobs[i]!.id] = {
            startTime: jobStartTimes[cpuJobs[i]!.id]!,
            endTime: nextEventTime,
            turnaroundTime: nextEventTime - cpuJobs[i]!.arrivalTime,
          };
          
          // Free the CPU
          cpuJobs[i] = null;
        }
      }
    }
    
    // After the event, re-sort the running queue as priorities may have changed
    runningJobs.sort(sortByRemainingTime);
    
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
    cpuUtilization,
    timeQuantum: 1 // Default time quantum for SRTN
  };
};

export const calculateRoundRobin = (
  jobs: Job[],
  cpuCount: number,
  timeQuantum: number,
  scheduleMode: "quantum" | "endTime" = "quantum"
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
  
  // For quantum-based scheduling
  let nextQuantumTime = 0;
  
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
    
    // Add newly arrived jobs to the queue
    readyQueue.push(...newlyArrivedJobs);
    
    // Take queue snapshot if jobs arrived or queue changed
    if (newlyArrivedJobs.length > 0 || readyQueue.length > 0) {
      queueSnapshots.push(takeQueueSnapshot(currentTime, readyQueue));
    }
    
    // For quantum-based scheduling, check if we've reached a quantum boundary
    if (scheduleMode === "quantum" && currentTime >= nextQuantumTime) {
      // At quantum boundary, handle completed jobs and quantum expirations
      for (let i = 0; i < cpuCount; i++) {
        if (cpuJobs[i] !== null) {
          // Check if job completed its quantum
          if (cpuTimeRemaining[i] <= 0.00001) {
            // Check if job completed entirely
            if (cpuJobs[i]!.remainingTime <= 0.00001) {
              // Job completed
              completedJobs.push(cpuJobs[i]!);
              
              // Record job completion
              jobResults[cpuJobs[i]!.id] = {
                startTime: jobStartTimes[cpuJobs[i]!.id]!,
                endTime: currentTime,
                turnaroundTime: currentTime - cpuJobs[i]!.arrivalTime,
              };
            } else {
              // Job used its quantum but didn't complete, put back in ready queue
              readyQueue.push(cpuJobs[i]!);
            }
            
            // Free the CPU
            cpuJobs[i] = null;
          }
        }
        
        // If CPU is idle and there are jobs in the ready queue, assign one
        if (cpuJobs[i] === null && readyQueue.length > 0) {
          cpuJobs[i] = readyQueue.shift()!;
          cpuTimeRemaining[i] = Math.min(timeQuantum, cpuJobs[i]!.remainingTime);
          
          // Record job start time if this is the first time it's running
          if (jobStartTimes[cpuJobs[i]!.id] === null) {
            jobStartTimes[cpuJobs[i]!.id] = currentTime;
          }
        }
      }
      
      // Schedule next quantum
      nextQuantumTime = currentTime + timeQuantum;
    }
    
    // For end-time based Round Robin scheduling
    if (scheduleMode === "endTime") {
      // Assign jobs to available CPUs
      for (let i = 0; i < cpuCount; i++) {
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
    }
    
    // Find the time until the next event
    let nextEventTime = Infinity;
    
    // Check next job arrival
    if (remainingJobs.length > 0) {
      nextEventTime = remainingJobs[0].arrivalTime;
    }
    
    // For quantum-based scheduling, consider the next quantum boundary
    if (scheduleMode === "quantum") {
      nextEventTime = Math.min(nextEventTime, nextQuantumTime);
    }
    
    // Check quantum expirations and job completions on CPUs
    for (let i = 0; i < cpuCount; i++) {
      if (cpuJobs[i] !== null) {
        // Time until quantum expires or job completes (whichever comes first)
        const timeUntilJobCompletes = cpuJobs[i]!.remainingTime;
        const timeUntilQuantumExpires = cpuTimeRemaining[i];
        
        // For quantum-based, jobs only end at quantum boundaries
        if (scheduleMode === "quantum") {
          if (timeUntilJobCompletes < timeUntilQuantumExpires) {
            // Job will complete before quantum expires
            nextEventTime = Math.min(nextEventTime, currentTime + timeUntilJobCompletes);
          }
        } else {
          // For end-time, consider both job completion and quantum expiration
          const timeUntilEvent = Math.min(timeUntilJobCompletes, timeUntilQuantumExpires);
          if (timeUntilEvent > 0) {
            nextEventTime = Math.min(nextEventTime, currentTime + timeUntilEvent);
          }
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
      if (cpuJobs[i] !== null) {
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
        if (job.remainingTime <= 0.00001) {
          // In quantum-based scheduling, if job completes before quantum ends,
          // leave the CPU idle until the next quantum
          if (scheduleMode === "quantum" && nextEventTime < nextQuantumTime) {
            // Add idle slot from job completion to end of quantum
            cpuTimeSlots.push({
              cpuId: i,
              jobId: "Idle",
              startTime: nextEventTime,
              endTime: nextQuantumTime,
              isIdle: true
            });
            
            // CPU remains idle until next quantum
            cpuJobs[i] = null;
          } else if (scheduleMode === "endTime") {
            // For end-time scheduling, mark as completed
            completedJobs.push(job);
            
            // Record job completion
            jobResults[job.id] = {
              startTime: jobStartTimes[job.id]!,
              endTime: nextEventTime,
              turnaroundTime: nextEventTime - job.arrivalTime,
            };
            
            // Free the CPU
            cpuJobs[i] = null;
            
            // Immediately assign new job if available
            if (readyQueue.length > 0) {
              cpuJobs[i] = readyQueue.shift()!;
              cpuTimeRemaining[i] = Math.min(timeQuantum, cpuJobs[i]!.remainingTime);
              
              if (jobStartTimes[cpuJobs[i]!.id] === null) {
                jobStartTimes[cpuJobs[i]!.id] = nextEventTime;
              }
            }
          }
        } 
        // Check if quantum expired (but job not completed)
        else if (cpuTimeRemaining[i] <= 0.00001 && scheduleMode === "endTime") {
          // Put job back in ready queue (at the end)
          readyQueue.push(job);
          
          // Free the CPU
          cpuJobs[i] = null;
          
          // If there are jobs in the queue, assign a new job immediately
          if (readyQueue.length > 0) {
            cpuJobs[i] = readyQueue.shift()!;
            cpuTimeRemaining[i] = Math.min(timeQuantum, cpuJobs[i]!.remainingTime);
            
            if (jobStartTimes[cpuJobs[i]!.id] === null) {
              jobStartTimes[cpuJobs[i]!.id] = nextEventTime;
            }
          }
        }
      }
    }
    
    // For quantum-based scheduling, handle job completions at quantum boundaries
    if (scheduleMode === "quantum" && nextEventTime === nextQuantumTime) {
      for (let i = 0; i < cpuCount; i++) {
        if (cpuJobs[i] !== null && cpuJobs[i]!.remainingTime <= 0.00001) {
          // Job completed
          completedJobs.push(cpuJobs[i]!);
          
          // Record job completion
          jobResults[cpuJobs[i]!.id] = {
            startTime: jobStartTimes[cpuJobs[i]!.id]!,
            endTime: nextEventTime,
            turnaroundTime: nextEventTime - cpuJobs[i]!.arrivalTime,
          };
          
          // Free the CPU
          cpuJobs[i] = null;
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
    cpuUtilization,
    timeQuantum // Include the time quantum used for this schedule
  };
};
