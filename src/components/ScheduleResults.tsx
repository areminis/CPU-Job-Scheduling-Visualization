
import React from "react";
import GanttChart from "./GanttChart";
import JobQueue from "./JobQueue";
import { Job, ScheduleResult } from "@/lib/types";

interface ScheduleResultsProps {
  scheduleResult: ScheduleResult;
  activeAlgorithm: "SRTN" | "RR" | "";
  cpuCount: number;
  jobs: Job[];
}

const ScheduleResults = ({ scheduleResult, activeAlgorithm, cpuCount, jobs }: ScheduleResultsProps) => {
  if (!scheduleResult) return null;

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
            "Note: In Round Robin, jobs execute for their full time quantum unless they complete. When a job completes, the next job starts immediately." : 
            "Note: In SRTN, jobs are scheduled based on remaining execution time. CPUs will always execute the available job with the shortest remaining time. When a job completes, the next shortest job starts immediately."}
        </p>
      </div>
      
      <GanttChart 
        cpuTimeSlots={scheduleResult.cpuTimeSlots} 
        cpuCount={Number(cpuCount)} 
        jobs={jobs} 
      />
      
      <h3 className="text-lg font-semibold mt-6 mb-3">Job Queue Snapshots</h3>
      <JobQueue 
        queueSnapshots={scheduleResult.queueSnapshots}
        jobs={jobs}
      />
    </div>
  );
};

export default ScheduleResults;
