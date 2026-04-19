import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl font-bold text-ink-700">404</div>
        <Link to="/" className="text-sm text-ink-400 hover:text-ink-200 underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
