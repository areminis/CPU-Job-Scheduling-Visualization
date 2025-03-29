
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface JobControlsProps {
  cpuCount: number | "";
  timeQuantum: number | "";
  switchingOverhead: number | "";
  setCpuCount: (count: number | "") => void;
  setTimeQuantum: (quantum: number | "") => void;
  setSwitchingOverhead: (overhead: number | "") => void;
  addJob: () => void;
  removeLastJob: () => void;
  calculateSRTNSchedule: () => void;
  calculateRoundRobinSchedule: () => void;
}

const JobControls = ({
  cpuCount,
  timeQuantum,
  switchingOverhead,
  setCpuCount,
  setTimeQuantum,
  setSwitchingOverhead,
  addJob,
  removeLastJob,
  calculateSRTNSchedule,
  calculateRoundRobinSchedule
}: JobControlsProps) => {
  return (
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
  );
};

export default JobControls;
