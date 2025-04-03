
import { useMemo } from "react";
import { CPUTimeSlot, Job } from "@/lib/types";

interface GanttChartProps {
  cpuTimeSlots: CPUTimeSlot[];
  cpuCount: number;
  jobs: Job[];
  timeQuantum?: number;
}

const GanttChart = ({ cpuTimeSlots, cpuCount, jobs, timeQuantum = 1 }: GanttChartProps) => {
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

  // Break down time slots into quantum-sized segments
  const quantizedCpuSlots = useMemo(() => {
    const result: { [cpuId: number]: CPUTimeSlot[] } = {};
    
    for (let i = 0; i < cpuCount; i++) {
      result[i] = [];
      
      // For each time slot in this CPU
      cpuSlots[i]?.forEach(slot => {
        const slotDuration = slot.endTime - slot.startTime;
        const numQuantums = Math.ceil(slotDuration / timeQuantum);
        
        // Split the slot into quantum-sized segments
        for (let q = 0; q < numQuantums; q++) {
          const segmentStart = slot.startTime + (q * timeQuantum);
          const segmentEnd = Math.min(slot.endTime, segmentStart + timeQuantum);
          
          // Don't create segments with zero duration
          if (segmentEnd > segmentStart) {
            result[i].push({
              ...slot,
              startTime: segmentStart,
              endTime: segmentEnd
            });
          }
        }
      });
    }
    
    return result;
  }, [cpuSlots, cpuCount, timeQuantum]);

  // Get job color by ID
  const getJobColor = (jobId: string, isIdle: boolean = false): string => {
    if (isIdle) return "bg-gray-200"; // Light gray for idle slots
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
            {quantizedCpuSlots[cpuId]?.map((slot, index) => {
              const width = ((slot.endTime - slot.startTime) / endTime) * 100;
              const left = (slot.startTime / endTime) * 100;
              const isIdle = slot.isIdle === true;
              
              return (
                <div
                  key={index}
                  className={`absolute h-full ${getJobColor(slot.jobId, isIdle)} rounded-sm flex items-center justify-center`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    minWidth: "24px",
                    border: isIdle ? "1px dashed #666" : "none",
                    borderRight: "1px solid rgba(255,255,255,0.5)" // Add separator between quantum blocks
                  }}
                >
                  <span className={`text-xs font-medium ${isIdle ? "text-gray-600" : "text-white"} truncate px-1`}>
                    {isIdle ? "Idle" : slot.jobId}
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
        {cpuTimeSlots.some(slot => slot.isIdle) && (
          <div className="flex items-center">
            <div className="w-4 h-4 mr-1 bg-gray-200 border border-gray-400 rounded"></div>
            <span className="text-sm">Idle Time</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GanttChart;
