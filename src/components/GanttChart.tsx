
import { useMemo } from "react";
import { CPUTimeSlot, Job } from "@/lib/types";

interface GanttChartProps {
  cpuTimeSlots: CPUTimeSlot[];
  cpuCount: number;
  jobs: Job[];
}

const GanttChart = ({ cpuTimeSlots, cpuCount, jobs }: GanttChartProps) => {
  const colors = [
    "bg-purple-400", "bg-blue-400", "bg-green-400", "bg-yellow-400", 
    "bg-red-400", "bg-pink-400", "bg-indigo-400", "bg-teal-400"
  ];

  // Find the maximum end time to set the chart width
  const endTime = useMemo(() => {
    if (!cpuTimeSlots.length) return 0;
    return Math.max(...cpuTimeSlots.map(slot => slot.endTime));
  }, [cpuTimeSlots]);
  
  // Group time slots by CPU
  const cpuSlots = useMemo(() => {
    const result: { [cpuId: number]: CPUTimeSlot[] } = {};
    
    for (let i = 0; i < cpuCount; i++) {
      result[i] = cpuTimeSlots.filter(slot => slot.cpuId === i);
    }
    
    return result;
  }, [cpuTimeSlots, cpuCount]);

  // Get job color by ID
  const getJobColor = (jobId: string): string => {
    const index = parseInt(jobId.replace("J", "")) - 1;
    return colors[index % colors.length];
  };

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const markers = [];
    const step = endTime > 20 ? 2 : 1;
    
    for (let i = 0; i <= endTime; i += step) {
      markers.push(i);
    }
    
    return markers;
  }, [endTime]);

  return (
    <div className="mt-4">
      <div className="mb-4">
        <div className="flex mb-2 items-center">
          <div className="w-16 text-sm font-medium">Timeline</div>
          <div className="flex-1 relative h-8">
            {timeMarkers.map((time) => (
              <div
                key={time}
                className="absolute bottom-0 h-2 border-l border-gray-400"
                style={{ left: `${(time / endTime) * 100}%` }}
              >
                <div className="absolute -left-2 top-2 text-xs">{time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CPU Gantt Chart Rows */}
      {Array.from({ length: cpuCount }).map((_, cpuId) => (
        <div key={cpuId} className="flex mb-4 items-center">
          <div className="w-16 text-sm font-medium">CPU {cpuId + 1}</div>
          <div className="flex-1 relative h-10 bg-gray-100 rounded">
            {cpuSlots[cpuId]?.map((slot, index) => {
              const width = ((slot.endTime - slot.startTime) / endTime) * 100;
              const left = (slot.startTime / endTime) * 100;
              
              return (
                <div
                  key={index}
                  className={`absolute h-full ${getJobColor(slot.jobId)} rounded-sm flex items-center justify-center`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    minWidth: "24px"
                  }}
                >
                  <span className="text-xs font-medium text-white truncate px-1">
                    {slot.jobId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Job Color Legend */}
      <div className="mt-6 flex flex-wrap gap-3">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center">
            <div
              className={`w-4 h-4 mr-1 ${getJobColor(job.id)} rounded`}
            ></div>
            <span className="text-sm">{job.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GanttChart;
