
import React from "react";
import GanttChart from "./GanttChart";
import JobQueue from "./JobQueue";
import { Job, ScheduleResult } from "@/lib/types";

interface ScheduleResultsProps {
  scheduleResult: ScheduleResult;
  activeAlgorithm: "SRTN" | "RR" | "";
  cpuCount: number;
  jobs: Job[];
  scheduleMode: "quantum" | "endTime";
}

const ScheduleResults = ({ 
  scheduleResult, 
  activeAlgorithm, 
  cpuCount, 
  jobs,
  scheduleMode 
}: ScheduleResultsProps) => {
  if (!scheduleResult) return null;

  // Get time quantum from schedule result
  const timeQuantum = scheduleResult.timeQuantum || 1;

  return (
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
      
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {activeAlgorithm === "RR" ? 
            "Note: In Round Robin, when a job completes or uses its full quantum, it's removed from CPU and placed at the end of the queue. New jobs are added to the queue, and the next job starts immediately without waiting for the next quantum cycle."
            : 
            "Note: In SRTN, when a job completes, the next job with the shortest remaining time starts immediately. If multiple CPUs can run a job simultaneously, CPU order determines priority."
          }
        </p>
      </div>
      
      <GanttChart 
        cpuTimeSlots={scheduleResult.cpuTimeSlots} 
        cpuCount={Number(cpuCount)} 
        jobs={jobs}
        timeQuantum={timeQuantum}
      />
      
      <h3 className="text-lg font-semibold mt-6 mb-3">Job Queue Timeline</h3>
      <JobQueue 
        queueSnapshots={scheduleResult.queueSnapshots}
        jobs={jobs}
        timeQuantum={timeQuantum}
      />
    </div>
  );
};

export default ScheduleResults;
