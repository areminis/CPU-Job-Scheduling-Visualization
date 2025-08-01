
import { useMemo } from "react";
import { QueueSnapshot, Job } from "@/lib/types";

interface JobQueueProps {
  queueSnapshots: QueueSnapshot[];
  jobs: Job[];
  timeQuantum?: number;
}

const JobQueue = ({ queueSnapshots, jobs, timeQuantum = 1 }: JobQueueProps) => {
  const colors = [
    "bg-purple-400", "bg-blue-400", "bg-green-400", "bg-yellow-400", 
    "bg-red-400", "bg-pink-400", "bg-indigo-400", "bg-teal-400"
  ];

  // Get job color by ID
  const getJobColor = (jobId: string): string => {
    const index = parseInt(jobId.replace("J", "")) - 1;
    return colors[index % colors.length];
  };

  // Group snapshots by time quantum to create timeline
  const timelineData = useMemo(() => {
    if (queueSnapshots.length === 0) return [];

    // Get unique timestamps
    let timestamps = Array.from(
      new Set(queueSnapshots.map((snapshot) => snapshot.time))
    ).sort((a, b) => a - b);

    // Add quantum-aligned timestamps if they don't exist
    const maxTime = timestamps[timestamps.length - 1];
    const quantumTimes = [];
    
    for (let t = 0; t <= maxTime; t += timeQuantum) {
      quantumTimes.push(t);
    }
    
    // Merge and deduplicate timestamps
    timestamps = Array.from(new Set([...timestamps, ...quantumTimes])).sort((a, b) => a - b);

    // Create the timeline data
    return timestamps.map((time) => {
      // Find the closest snapshot at or before this time
      const snapshot = [...queueSnapshots]
        .sort((a, b) => b.time - a.time)
        .find((s) => s.time <= time);
      
      return {
        time,
        queue: snapshot ? snapshot.readyQueue : []
      };
    });
  }, [queueSnapshots, timeQuantum]);

  if (timelineData.length === 0) {
    return <div className="text-gray-500 italic text-center py-4">No queue data available</div>;
  }

  return (
    <div className="mt-8 pb-40"> {/* Added padding to bottom for job queue boxes */}
      {/* Timeline visualization */}
      <div className="relative border-t border-gray-300">
        {/* Time markers */}
        <div className="flex justify-between relative">
          {timelineData.map((data, index) => (
            <div 
              key={`time-${index}`} 
              className="absolute transform -translate-x-1/2"
              style={{ left: `${(index / (timelineData.length - 1)) * 100}%` }}
            >
              <div className="h-4 border-l border-gray-300"></div>
              <div className="text-xs text-gray-600 mt-1">
                {data.time.toFixed(1)}
              </div>
            </div>
          ))}
        </div>

        {/* Job queue boxes */}
        <div className="mt-8">
          {timelineData.map((data, index) => (
            <div 
              key={`queue-${index}`}
              className="absolute transform -translate-x-1/2"
              style={{ 
                left: `${(index / (timelineData.length - 1)) * 100}%`,
                top: "2rem"
              }}
            >
              <div className="border border-gray-300 rounded-md p-2 bg-white shadow-sm">
                <div className="text-xs font-medium mb-1">Time: {data.time.toFixed(1)}</div>
                {data.queue.length === 0 ? (
                  <div className="text-xs text-gray-500 italic">Empty</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {data.queue.map((job, jobIndex) => (
                      <div
                        key={`job-${index}-${jobIndex}`}
                        className="text-xs whitespace-nowrap"
                      >
                        <div className="flex items-center">
                          <span className={`${getJobColor(job.id)} text-white px-1 py-0.5 rounded mr-1 font-medium`}>
                            {job.id}
                          </span>
                          <span className="text-gray-700">
                            = {job.remainingTime.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default JobQueue;
