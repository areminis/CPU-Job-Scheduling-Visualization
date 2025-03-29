
import React from "react";

interface AlgorithmExplanationProps {
  activeAlgorithm: "SRTN" | "RR" | "";
  timeQuantum: number | "";
  switchingOverhead: number | "";
}

const AlgorithmExplanation = ({ activeAlgorithm, timeQuantum, switchingOverhead }: AlgorithmExplanationProps) => {
  return (
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
  );
};

export default AlgorithmExplanation;
