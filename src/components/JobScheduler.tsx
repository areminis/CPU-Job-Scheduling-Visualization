
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import JobList from "./JobList";
import JobControls from "./JobControls";
import AlgorithmExplanation from "./AlgorithmExplanation";
import ScheduleResults from "./ScheduleResults";
import { calculateSRTN, calculateRoundRobin } from "@/lib/schedulingAlgorithms";
import { Job, ScheduleResult } from "@/lib/types";

const JobScheduler = () => {
  const { toast } = useToast();
  const [cpuCount, setCpuCount] = useState<number | "">("");
  const [timeQuantum, setTimeQuantum] = useState<number | "">("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [activeAlgorithm, setActiveAlgorithm] = useState<"SRTN" | "RR" | "">("");
  const [scheduleMode, setScheduleMode] = useState<"quantum" | "endTime">("quantum");

  const addJob = () => {
    const newJobId = `J${jobs.length + 1}`;
    setJobs([
      ...jobs,
      { id: newJobId, arrivalTime: 0, burstTime: "", remainingTime: 0 } as unknown as Job,
    ]);
  };

  const removeLastJob = () => {
    if (jobs.length > 1) {
      setJobs(jobs.slice(0, -1));
    } else if (jobs.length === 1) {
      setJobs([]);
    } else {
      toast({
        title: "No jobs to remove",
        description: "The job list is already empty",
        variant: "destructive",
      });
    }
  };

  const updateJob = (jobId: string, field: keyof Job, value: number) => {
    const updatedJobs = jobs.map((job) => {
      if (job.id === jobId) {
        const updatedJob = { ...job, [field]: value };
        if (field === "burstTime") {
          updatedJob.remainingTime = value;
        }
        return updatedJob;
      }
      return job;
    });
    setJobs(updatedJobs);
  };

  const validateInputs = (): boolean => {
    if (jobs.length === 0) {
      toast({
        title: "No jobs to schedule",
        description: "Please add at least one job",
        variant: "destructive",
      });
      return false;
    }
    
    if (typeof cpuCount !== 'number' || cpuCount < 1) {
      toast({
        title: "Invalid CPU count",
        description: "Number of CPUs must be at least 1",
        variant: "destructive",
      });
      return false;
    }
    
    if (activeAlgorithm === "RR" && (typeof timeQuantum !== 'number' || timeQuantum <= 0)) {
      toast({
        title: "Invalid time quantum",
        description: "Time quantum must be greater than 0",
        variant: "destructive",
      });
      return false;
    }
    
    for (const job of jobs) {
      if (job.arrivalTime < 0 || job.burstTime <= 0) {
        toast({
          title: "Invalid job parameters",
          description: "Arrival time must be non-negative and burst time must be positive",
          variant: "destructive",
        });
        return false;
      }
    }
    
    return true;
  };

  const calculateSRTNSchedule = () => {
    if (!validateInputs()) return;
    
    setActiveAlgorithm("SRTN");
    const jobsWithResetTime = jobs.map(job => ({
      ...job,
      remainingTime: job.burstTime
    }));
    
    const result = calculateSRTN(
      jobsWithResetTime, 
      Number(cpuCount),
      scheduleMode
    );
    setScheduleResult(result);
    
    toast({
      title: "SRTN Schedule Calculated",
      description: `Average Turnaround Time: ${result.averageTurnaroundTime.toFixed(2)}`,
    });
  };

  const calculateRoundRobinSchedule = () => {
    if (!validateInputs()) return;
    
    setActiveAlgorithm("RR");
    const jobsWithResetTime = jobs.map(job => ({
      ...job,
      remainingTime: job.burstTime
    }));
    
    const result = calculateRoundRobin(
      jobsWithResetTime, 
      Number(cpuCount), 
      Number(timeQuantum),
      scheduleMode
    );
    setScheduleResult(result);
    
    toast({
      title: "Round Robin Schedule Calculated",
      description: `Average Turnaround Time: ${result.averageTurnaroundTime.toFixed(2)}`,
    });
  };

  useEffect(() => {
    if (
      activeAlgorithm && 
      scheduleResult && 
      jobs.length > 0 && 
      typeof cpuCount === 'number' && 
      (activeAlgorithm !== "RR" || typeof timeQuantum === 'number')
    ) {
      if (activeAlgorithm === "SRTN") {
        calculateSRTNSchedule();
      } else if (activeAlgorithm === "RR") {
        calculateRoundRobinSchedule();
      }
    }
  }, [cpuCount, timeQuantum]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <JobControls
          cpuCount={cpuCount}
          timeQuantum={timeQuantum}
          setCpuCount={setCpuCount}
          setTimeQuantum={setTimeQuantum}
          addJob={addJob}
          removeLastJob={removeLastJob}
          calculateSRTNSchedule={calculateSRTNSchedule}
          calculateRoundRobinSchedule={calculateRoundRobinSchedule}
          scheduleMode={scheduleMode}
          setScheduleMode={setScheduleMode}
        />
        
        <AlgorithmExplanation 
          activeAlgorithm={activeAlgorithm}
          timeQuantum={timeQuantum}
          scheduleMode={scheduleMode}
        />
      </div>

      {jobs.length > 0 && (
        <JobList jobs={jobs} updateJob={updateJob} scheduleResult={scheduleResult} />
      )}

      {scheduleResult && (
        <ScheduleResults 
          scheduleResult={scheduleResult}
          activeAlgorithm={activeAlgorithm}
          cpuCount={Number(cpuCount)}
          jobs={jobs}
          scheduleMode={scheduleMode}
        />
      )}
    </div>
  );
};

export default JobScheduler;
