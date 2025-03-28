
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
}

export interface ScheduleResult {
  jobResults: { [jobId: string]: JobResult };
  cpuTimeSlots: CPUTimeSlot[];
  averageTurnaroundTime: number;
}
