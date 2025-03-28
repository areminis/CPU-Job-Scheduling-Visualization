
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import JobList from "./JobList";
import GanttChart from "./GanttChart";
import JobQueue from "./JobQueue";
import { calculateSRTN, calculateRoundRobin } from "@/lib/schedulingAlgorithms";
import { Job, ScheduleResult } from "@/lib/types";

const JobScheduler = () => {
  const { toast } = useToast();
  const [cpuCount, setCpuCount] = useState<number | "">("");
  const [timeQuantum, setTimeQuantum] = useState<number | "">("");
  const [switchingOverhead, setSwitchingOverhead] = useState<number | "">("");
  const [jobs, setJobs] = useState<Job[]>([]);
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
    
    if (typeof switchingOverhead !== 'number' || switchingOverhead < 0) {
      toast({
        title: "Invalid switching overhead",
        description: "Switching overhead cannot be negative",
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
    
    const result = calculateSRTN(
      jobsWithResetTime, 
      Number(cpuCount), 
      Number(switchingOverhead)
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
    // Reset remaining time before calculation
    const jobsWithResetTime = jobs.map(job => ({
      ...job,
      remainingTime: job.burstTime
    }));
    
    const result = calculateRoundRobin(
      jobsWithResetTime, 
      Number(cpuCount), 
      Number(timeQuantum), 
      Number(switchingOverhead)
    );
    setScheduleResult(result);
    
    toast({
      title: "Round Robin Schedule Calculated",
      description: `Average Turnaround Time: ${result.averageTurnaroundTime.toFixed(2)}`,
    });
  };

  // Recalculate when inputs change if we have an active algorithm
  useEffect(() => {
    if (
      activeAlgorithm && 
      scheduleResult && 
      jobs.length > 0 && 
      typeof cpuCount === 'number' && 
      (activeAlgorithm !== "RR" || typeof timeQuantum === 'number') && 
      typeof switchingOverhead === 'number'
    ) {
      if (activeAlgorithm === "SRTN") {
        calculateSRTNSchedule();
      } else if (activeAlgorithm === "RR") {
        calculateRoundRobinSchedule();
      }
    }
  }, [cpuCount, timeQuantum, switchingOverhead]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cpuCount">Number of CPUs</Label>
              <Input
                id="cpuCount"
                type="number"
                min="1"
                value={cpuCount}
                onChange={(e) => setCpuCount(e.target.value ? parseInt(e.target.value) : "")}
                className="w-full"
                placeholder="Enter CPU count"
              />
            </div>
            <div>
              <Label htmlFor="timeQuantum">Time Quantum</Label>
              <Input
                id="timeQuantum"
                type="number"
                min="0.1"
                step="0.1"
                value={timeQuantum}
                onChange={(e) => setTimeQuantum(e.target.value ? parseFloat(e.target.value) : "")}
                className="w-full"
                placeholder="For Round Robin"
              />
            </div>
            <div>
              <Label htmlFor="switchingOverhead">CPU Switching Overhead</Label>
              <Input
                id="switchingOverhead"
                type="number"
                min="0"
                step="0.1"
                value={switchingOverhead}
                onChange={(e) => setSwitchingOverhead(e.target.value ? parseFloat(e.target.value) : "")}
                className="w-full"
                placeholder="Optional"
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
              <p className="text-sm text-gray-700 mt-2">
                <strong>CPU Switching Overhead:</strong> {switchingOverhead ? 
                  `${Number(switchingOverhead).toFixed(1)} time units delay when switching jobs` : 
                  "No switching overhead"}
              </p>
            </div>
          ) : activeAlgorithm === "RR" ? (
            <div>
              <p className="text-sm text-gray-700">
                <strong>Round Robin (RR)</strong> is a CPU scheduling algorithm where each process is 
                assigned a fixed time slot in a cyclic way. It is designed especially for time-sharing 
                systems. The scheduler assigns a fixed time unit per process, and cycles through them.
                When a job completes before using its full time quantum, the next job starts immediately.
              </p>
              <p className="text-sm text-gray-700 mt-2">
                <strong>Time Quantum:</strong> {timeQuantum ? Number(timeQuantum).toFixed(1) : "--"} time units
              </p>
              <p className="text-sm text-gray-700">
                <strong>CPU Switching Overhead:</strong> {switchingOverhead ? 
                  `${Number(switchingOverhead).toFixed(1)} time units delay when switching jobs` : 
                  "No switching overhead"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">
              Select an algorithm to see its explanation
            </p>
          )}
        </div>
      </div>

      {jobs.length > 0 && (
        <JobList jobs={jobs} updateJob={updateJob} scheduleResult={scheduleResult} />
      )}

      {scheduleResult && (
        <>
          <div className="bg-white rounded-lg p-4 shadow-md">
            <h2 className="text-xl font-semibold mb-4">
              {activeAlgorithm === "SRTN" ? "SRTN" : "Round Robin"} Schedule Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-lg font-medium">
                  Average Turnaround Time: {scheduleResult.averageTurnaroundTime.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-lg font-medium">
                  CPU Utilization: {scheduleResult.cpuUtilization.toFixed(2)}%
                </p>
              </div>
            </div>
            <GanttChart 
              cpuTimeSlots={scheduleResult.cpuTimeSlots} 
              cpuCount={cpuCount} 
              jobs={jobs} 
            />
            
            <h3 className="text-lg font-semibold mt-6 mb-3">Job Queue Snapshots</h3>
            <JobQueue 
              queueSnapshots={scheduleResult.queueSnapshots}
              jobs={jobs}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default JobScheduler;
