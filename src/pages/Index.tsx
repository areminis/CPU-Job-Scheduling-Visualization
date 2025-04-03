
import JobScheduler from "@/components/JobScheduler";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            CPU Job Scheduling Visualization
          </h1>
          <p className="text-gray-600">
            Interactive tool for SRTN and Round Robin scheduling algorithms
          </p>
        </header>
        <main>
          <JobScheduler />
        </main>
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>CPU Scheduling Visualization Tool</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
