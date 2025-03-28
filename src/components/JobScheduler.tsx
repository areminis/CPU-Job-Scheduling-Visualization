
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import JobList from "./JobList";
import GanttChart from "./GanttChart";
import { calculateSRTN, calculateRoundRobin } from "@/lib/schedulingAlgorithms";
import { Job, ScheduleResult, CPUTimeSlot } from "@/lib/types";

const JobScheduler = () => {
  const { toast } = useToast();
  const [cpuCount, setCpuCount] = useState<number>(2);
  const [timeQuantum, setTimeQuantum] = useState<number>(1);
  const [jobs, setJobs] = useState<Job[]>([
    { id: "J1", arrivalTime: 0, burstTime: 4, remainingTime: 4 },
    { id: "J2", arrivalTime: 0, burstTime: 2, remainingTime: 2 },
    { id: "J3", arrivalTime: 1, burstTime: 6, remainingTime: 6 },
    { id: "J4", arrivalTime: 1, burstTime: 1, remainingTime: 1 },
  ]);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [activeAlgorithm, setActiveAlgorithm] = useState<"SRTN" | "RR" | "">("");

  const addJob = () => {
    const newJobId = `J${jobs.length + 1}`;
    setJobs([
      ...jobs,
      { id: newJobId, arrivalTime: 0, burstTime: 1, remainingTime: 1 },
    ]);
  };

  const removeLastJob = () => {
    if (jobs.length > 1) {
      setJobs(jobs.slice(0, -1));
    } else {
      toast({
        title: "Cannot remove job",
        description: "At least one job must remain in the list",
        variant: "destructive",
      });
    }
  };

  const updateJob = (jobId: string, field: keyof Job, value: number) => {
    const updatedJobs = jobs.map((job) => {
      if (job.id === jobId) {
        const updatedJob = { ...job, [field]: value };
        // Also update remaining time if burst time was updated
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
    if (cpuCount < 1) {
      toast({
        title: "Invalid CPU count",
        description: "Number of CPUs must be at least 1",
        variant: "destructive",
      });
      return false;
    }
    
    if (activeAlgorithm === "RR" && timeQuantum <= 0) {
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
    // Reset remaining time before calculation
    const jobsWithResetTime = jobs.map(job => ({
      ...job,
      remainingTime: job.burstTime
    }));
    
    const result = calculateSRTN(jobsWithResetTime, cpuCount);
    setScheduleResult(result);
    
    toast({
      title: "SRTN Schedule Calculated",
      description: `Average Turnaround Time: ${result.averageTurnaroundTime.toFixed(2)}`,
    });
  };

  const calculateRoundRobinSchedule = () => {
    if (!validateInputs()) return;
    
    setActiveAlgorithm("RR");
    // Reset remaining time before calculation
    const jobsWithResetTime = jobs.map(job => ({
      ...job,
      remainingTime: job.burstTime
    }));
    
    const result = calculateRoundRobin(jobsWithResetTime, cpuCount, timeQuantum);
    setScheduleResult(result);
    
    toast({
      title: "Round Robin Schedule Calculated",
      description: `Average Turnaround Time: ${result.averageTurnaroundTime.toFixed(2)}`,
    });
  };

  // Recalculate when inputs change if we have an active algorithm
  useEffect(() => {
    if (activeAlgorithm && scheduleResult) {
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
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-full">
              <Label htmlFor="cpuCount">Number of CPUs:</Label>
              <Input
                id="cpuCount"
                type="number"
                min="1"
                value={cpuCount}
                onChange={(e) => setCpuCount(parseInt(e.target.value) || 1)}
                className="w-full"
              />
            </div>
            <div className="w-full">
              <Label htmlFor="timeQuantum">Time Quantum:</Label>
              <Input
                id="timeQuantum"
                type="number"
                min="0.1"
                step="0.1"
                value={timeQuantum}
                onChange={(e) => setTimeQuantum(parseFloat(e.target.value) || 1)}
                className="w-full"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={addJob} variant="outline" className="w-1/2">
              Add Job
            </Button>
            <Button onClick={removeLastJob} variant="outline" className="w-1/2">
              Remove Last Job
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={calculateSRTNSchedule} 
              className="w-1/2 bg-purple-600 hover:bg-purple-700"
            >
              Calculate SRTN
            </Button>
            <Button 
              onClick={calculateRoundRobinSchedule} 
              className="w-1/2 bg-blue-600 hover:bg-blue-700"
            >
              Calculate Round Robin
            </Button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-md">
          <h2 className="text-xl font-semibold mb-2">Algorithm Explanation</h2>
          {activeAlgorithm === "SRTN" ? (
            <div>
              <p className="text-sm text-gray-700">
                <strong>Shortest Remaining Time Next (SRTN)</strong> is a preemptive scheduling 
                algorithm that selects the process with the smallest amount of time remaining until 
                completion. When a new process arrives, it compares the remaining time of the current 
                process with the burst time of the newly arrived process.
              </p>
            </div>
          ) : activeAlgorithm === "RR" ? (
            <div>
              <p className="text-sm text-gray-700">
                <strong>Round Robin (RR)</strong> is a CPU scheduling algorithm where each process is 
                assigned a fixed time slot in a cyclic way. It is designed especially for time-sharing 
                systems. The scheduler assigns a fixed time unit per process, and cycles through them.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">
              Select an algorithm to see its explanation
            </p>
          )}
        </div>
      </div>

      <JobList jobs={jobs} updateJob={updateJob} scheduleResult={scheduleResult} />

      {scheduleResult && (
        <>
          <div className="bg-white rounded-lg p-4 shadow-md">
            <h2 className="text-xl font-semibold mb-4">
              {activeAlgorithm === "SRTN" ? "SRTN" : "Round Robin"} Schedule Results
            </h2>
            <p className="text-lg font-medium mb-2">
              Average Turnaround Time: {scheduleResult.averageTurnaroundTime.toFixed(2)}
            </p>
            <GanttChart 
              cpuTimeSlots={scheduleResult.cpuTimeSlots} 
              cpuCount={cpuCount} 
              jobs={jobs} 
            />
          </div>
        </>
      )}
    </div>
  );
};

export default JobScheduler;
