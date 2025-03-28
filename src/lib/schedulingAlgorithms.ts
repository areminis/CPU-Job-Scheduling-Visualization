
import { Job, ScheduleResult, CPUTimeSlot } from "./types";

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

export const calculateSRTN = (jobs: Job[], cpuCount: number): ScheduleResult => {
  // Create deep copies of jobs to avoid modifying the original array
  let remainingJobs = JSON.parse(JSON.stringify(jobs)) as Job[];
  let runningJobs: Job[] = [];
  let completedJobs: Job[] = [];
  let cpuTimeSlots: CPUTimeSlot[] = [];
  let currentTime = 0;
  let jobResults: { [jobId: string]: { startTime: number; endTime: number; turnaroundTime: number } } = {};
  
  // Initialize job start times to track when each job first starts
  const jobStartTimes: { [jobId: string]: number | null } = {};
  jobs.forEach((job) => {
    jobStartTimes[job.id] = null;
  });
  
  // Initialize all CPUs as idle
  const cpuJobs: (Job | null)[] = Array(cpuCount).fill(null);
  
  // Sort jobs by arrival time initially
  remainingJobs.sort(sortByArrivalTime);
  
  // Continue until all jobs are completed
  while (remainingJobs.length > 0 || runningJobs.length > 0) {
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
    
    // Assign jobs to available CPUs
    for (let i = 0; i < cpuCount; i++) {
      // If CPU is idle and there are jobs to run
      if (cpuJobs[i] === null && runningJobs.length > 0) {
        cpuJobs[i] = runningJobs.shift()!;
        
        // Record job start time if this is the first time it's running
        if (jobStartTimes[cpuJobs[i]!.id] === null) {
          jobStartTimes[cpuJobs[i]!.id] = currentTime;
        }
      }
    }
    
    // Find the time until the next event (job arrival or completion)
    let nextEventTime = Infinity;
    
    // Check next job arrival
    if (remainingJobs.length > 0) {
      nextEventTime = remainingJobs[0].arrivalTime;
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
          endTime: nextEventTime,
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
        }
        // If preemption occurs, put job back to running queue
        else if (remainingJobs.length > 0 && remainingJobs[0].arrivalTime === nextEventTime) {
          runningJobs.push(job);
          cpuJobs[i] = null;
        }
      }
    }
    
    // Advance time to next event
    currentTime = nextEventTime;
  }
  
  // Calculate average turnaround time
  const averageTurnaroundTime = calculateAverageTurnaroundTime(jobResults);
  
  return {
    jobResults,
    cpuTimeSlots,
    averageTurnaroundTime,
  };
};

export const calculateRoundRobin = (
  jobs: Job[],
  cpuCount: number,
  timeQuantum: number
): ScheduleResult => {
  // Create deep copies of jobs to avoid modifying the original array
  let remainingJobs = JSON.parse(JSON.stringify(jobs)) as Job[];
  let readyQueue: Job[] = [];
  let completedJobs: Job[] = [];
  let cpuTimeSlots: CPUTimeSlot[] = [];
  let currentTime = 0;
  let jobResults: { [jobId: string]: { startTime: number; endTime: number; turnaroundTime: number } } = {};
  
  // Initialize job start times to track when each job first starts
  const jobStartTimes: { [jobId: string]: number | null } = {};
  jobs.forEach((job) => {
    jobStartTimes[job.id] = null;
  });
  
  // Initialize all CPUs as idle with remaining quantum
  const cpuJobs: (Job | null)[] = Array(cpuCount).fill(null);
  const cpuTimeRemaining: number[] = Array(cpuCount).fill(0);
  
  // Sort jobs by arrival time initially
  remainingJobs.sort(sortByArrivalTime);
  
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
    
    // Assign jobs to available CPUs
    for (let i = 0; i < cpuCount; i++) {
      if (cpuJobs[i] === null && readyQueue.length > 0) {
        cpuJobs[i] = readyQueue.shift()!;
        cpuTimeRemaining[i] = timeQuantum;
        
        // Record job start time if this is the first time it's running
        if (jobStartTimes[cpuJobs[i]!.id] === null) {
          jobStartTimes[cpuJobs[i]!.id] = currentTime;
        }
      }
    }
    
    // Find the time until the next event (job arrival, quantum expiration, or job completion)
    let nextEventTime = Infinity;
    
    // Check next job arrival
    if (remainingJobs.length > 0) {
      nextEventTime = remainingJobs[0].arrivalTime;
    }
    
    // Check quantum expirations and job completions on CPUs
    for (let i = 0; i < cpuCount; i++) {
      if (cpuJobs[i] !== null) {
        // Time until quantum expires
        const timeToQuantumEnd = cpuTimeRemaining[i];
        
        // Time until job completes
        const timeToComplete = cpuJobs[i]!.remainingTime;
        
        // Take the minimum of these two
        const timeUntilEvent = Math.min(timeToQuantumEnd, timeToComplete);
        
        nextEventTime = Math.min(nextEventTime, currentTime + timeUntilEvent);
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
          endTime: nextEventTime,
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
          
          // Free the CPU
          cpuJobs[i] = null;
        }
        // Check if quantum expired
        else if (cpuTimeRemaining[i] <= 0.00001) {
          readyQueue.push(job);
          cpuJobs[i] = null;
        }
      }
    }
    
    // Advance time to next event
    currentTime = nextEventTime;
  }
  
  // Calculate average turnaround time
  const averageTurnaroundTime = calculateAverageTurnaroundTime(jobResults);
  
  return {
    jobResults,
    cpuTimeSlots,
    averageTurnaroundTime,
  };
};
