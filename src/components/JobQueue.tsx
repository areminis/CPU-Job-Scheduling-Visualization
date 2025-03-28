
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

  // Filter out snapshots that have the same queue state
  const filteredSnapshots = useMemo(() => {
    const result: QueueSnapshot[] = [];
    let lastQueueState = "";
    
    queueSnapshots.forEach(snapshot => {
      const queueState = snapshot.readyQueue.map(job => `${job.id}-${job.remainingTime.toFixed(1)}`).join(",");
      if (queueState !== lastQueueState) {
        result.push(snapshot);
        lastQueueState = queueState;
      }
    });
    
    return result;
  }, [queueSnapshots]);

  // Only show a maximum of 10 snapshots to avoid crowding
  const shownSnapshots = useMemo(() => {
    if (filteredSnapshots.length <= 10) return filteredSnapshots;
    
    // Take evenly distributed snapshots
    const result: QueueSnapshot[] = [];
    const step = Math.ceil(filteredSnapshots.length / 10);
    
    for (let i = 0; i < filteredSnapshots.length; i += step) {
      result.push(filteredSnapshots[i]);
    }
    
    // Always include the last snapshot
    if (result[result.length - 1] !== filteredSnapshots[filteredSnapshots.length - 1]) {
      result.push(filteredSnapshots[filteredSnapshots.length - 1]);
    }
    
    return result;
  }, [filteredSnapshots]);

  if (shownSnapshots.length === 0) {
    return <div className="text-gray-500 italic text-center py-4">No queue snapshots available</div>;
  }

  return (
    <div className="space-y-4">
      {shownSnapshots.map((snapshot, index) => (
        <div key={index} className="border rounded-md p-3">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">Time: {snapshot.time.toFixed(1)}</h4>
            <span className="text-sm text-gray-500">
              {snapshot.readyQueue.length} job{snapshot.readyQueue.length !== 1 ? 's' : ''} in queue
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {snapshot.readyQueue.length === 0 ? (
              <div className="text-gray-500 italic">Queue empty</div>
            ) : (
              snapshot.readyQueue.map((job, jobIndex) => (
                <div 
                  key={`${index}-${jobIndex}`}
                  className={`${getJobColor(job.id)} rounded-md px-2 py-1 text-white text-sm flex items-center gap-1`}
                >
                  <span className="font-medium">{job.id}</span>
                  <span className="text-xs bg-white bg-opacity-20 px-1 rounded">
                    {job.remainingTime.toFixed(1)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default JobQueue;
