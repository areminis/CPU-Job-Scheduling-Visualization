
export interface Job {
  id: string;
  arrivalTime: number;
  burstTime: number;
  remainingTime: number;
}

export interface JobResult {
  startTime: number;
  endTime: number;
  turnaroundTime: number;
}

export interface CPUTimeSlot {
  cpuId: number;
  jobId: string;
  startTime: number;
  endTime: number;
  isIdle?: boolean;
}

export interface QueueSnapshot {
  time: number;
  readyQueue: Job[];
}

export interface ScheduleResult {
  jobResults: { [jobId: string]: JobResult };
  cpuTimeSlots: CPUTimeSlot[];
  queueSnapshots: QueueSnapshot[];
  averageTurnaroundTime: number;
  cpuUtilization: number;
  timeQuantum?: number; // Added to store the time quantum used
}
