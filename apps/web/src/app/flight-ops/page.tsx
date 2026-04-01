import { FlightBoard } from "./flight-board";

export default function FlightOpsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Flight Ops</h1>
      <p className="text-sm text-hz-text-secondary mb-6">
        Live flight board
      </p>
      <FlightBoard />
    </div>
  );
}
