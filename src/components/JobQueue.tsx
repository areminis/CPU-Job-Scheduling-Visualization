
import { useMemo } from "react";
import { QueueSnapshot, Job } from "@/lib/types";

interface JobQueueProps {
  queueSnapshots: QueueSnapshot[];
  jobs: Job[];
}

const JobQueue = ({ queueSnapshots, jobs }: JobQueueProps) => {
  const colors = [
    "bg-purple-400", "bg-blue-400", "bg-green-400", "bg-yellow-400", 
    "bg-red-400", "bg-pink-400", "bg-indigo-400", "bg-teal-400"
  ];

  // Get job color by ID
  const getJobColor = (jobId: string): string => {
    const index = parseInt(jobId.replace("J", "")) - 1;
    return colors[index % colors.length];
  };

  // Group snapshots by time to create timeline
  const timelineData = useMemo(() => {
    if (queueSnapshots.length === 0) return [];

    // Get unique timestamps
    const timestamps = Array.from(
      new Set(queueSnapshots.map((snapshot) => snapshot.time))
    ).sort((a, b) => a - b);

    // Filter snapshots to include only significant changes in the queue
    const significantTimestamps: number[] = [];
    let previousQueueState = "";

    timestamps.forEach((time) => {
      const snapshot = queueSnapshots.find((s) => s.time === time);
      if (!snapshot) return;

      const currentQueueState = snapshot.readyQueue
        .map((job) => `${job.id}-${job.remainingTime.toFixed(1)}`)
        .join(",");

      if (currentQueueState !== previousQueueState) {
        significantTimestamps.push(time);
        previousQueueState = currentQueueState;
      }
    });

    // Make sure we have a reasonable number of timestamps (max 8)
    let displayTimestamps = significantTimestamps;
    if (significantTimestamps.length > 8) {
      // Take first, last and evenly distribute the rest
      const step = Math.ceil((significantTimestamps.length - 2) / 6);
      displayTimestamps = [
        significantTimestamps[0],
        ...significantTimestamps
          .slice(1, -1)
          .filter((_, i) => i % step === 0)
          .slice(0, 6),
        significantTimestamps[significantTimestamps.length - 1]
      ];
    }

    // Create the timeline data
    return displayTimestamps.map((time) => {
      const snapshot = queueSnapshots.find((s) => s.time === time);
      return {
        time,
        queue: snapshot ? snapshot.readyQueue : []
      };
    });
  }, [queueSnapshots]);

  if (timelineData.length === 0) {
    return <div className="text-gray-500 italic text-center py-4">No queue data available</div>;
  }

  return (
    <div className="mt-4">
      {/* Timeline visualization */}
      <div className="relative border-t border-gray-300 mb-8">
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
                {data.queue.length === 0 ? (
                  <div className="text-xs text-gray-500 italic">Empty</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {data.queue.map((job, jobIndex) => (
                      <div
                        key={`job-${index}-${jobIndex}`}
                        className="text-xs flex items-center"
                      >
                        <span className={`${getJobColor(job.id)} text-white px-1 py-0.5 rounded mr-1 font-medium`}>
                          {job.id}
                        </span>
                        <span className="text-gray-700">
                          = {job.remainingTime.toFixed(1)}
                        </span>
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
