import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useJoinGroup } from "../lib/api";

export function Join() {
  const { code } = useParams();
  const join = useJoinGroup();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    join
      .mutateAsync(code)
      .then((g) => navigate(`/groups/${g.id}`, { replace: true }))
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!code) return <Navigate to="/" replace />;

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center">
        {err ? (
          <>
            <div className="text-xl font-semibold">Couldn't join</div>
            <div className="text-sm text-ink-400 mt-1">{err}</div>
          </>
        ) : (
          <div className="text-ink-400">Joining group…</div>
        )}
      </div>
    </div>
  );
}
