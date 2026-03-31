import { FlightBoard } from "./flight-board";

export default function OperationsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Operations</h1>
      <p className="text-sm text-gray-500 mb-6">Live flight board</p>
      <FlightBoard />
    </div>
  );
}
