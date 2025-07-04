
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Job, ScheduleResult } from "@/lib/types";

interface JobListProps {
  jobs: Job[];
  updateJob: (jobId: string, field: keyof Job, value: number) => void;
  scheduleResult: ScheduleResult | null;
}

const JobList = ({ jobs, updateJob, scheduleResult }: JobListProps) => {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Job ID</TableHead>
            <TableHead>Arrival Time</TableHead>
            <TableHead>Burst Time</TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Turnaround Time</TableHead>
            <TableHead>Remaining Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">{job.id}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={job.arrivalTime !== undefined ? job.arrivalTime : ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                    if (value >= 0 || e.target.value === "") {
                      updateJob(job.id, "arrivalTime", value);
                    }
                  }}
                  className="w-full"
                  placeholder="0.0"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={job.burstTime || ""}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value > 0) {
                      updateJob(job.id, "burstTime", value);
                    }
                  }}
                  className="w-full"
                  placeholder="Enter burst time"
                />
              </TableCell>
              <TableCell>
                {scheduleResult?.jobResults[job.id]?.startTime !== undefined 
                  ? scheduleResult.jobResults[job.id].startTime.toFixed(1)
                  : "-"}
              </TableCell>
              <TableCell>
                {scheduleResult?.jobResults[job.id]?.endTime !== undefined 
                  ? scheduleResult.jobResults[job.id].endTime.toFixed(1)
                  : "-"}
              </TableCell>
              <TableCell>
                {scheduleResult?.jobResults[job.id]?.turnaroundTime !== undefined 
                  ? scheduleResult.jobResults[job.id].turnaroundTime.toFixed(1)
                  : "-"}
              </TableCell>
              <TableCell>
                {scheduleResult 
                  ? "0.0" // Job is completed in the results
                  : job.remainingTime.toFixed(1)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default JobList;
