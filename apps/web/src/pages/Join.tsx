import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useRequestGroupJoin } from "../lib/api";

export function Join() {
  const { code } = useParams();
  const join = useRequestGroupJoin();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    join
      .mutateAsync(code)
      .then((result) => {
        if (result.status === "already_member") {
          navigate(`/groups/${result.group.id}`, { replace: true });
          return;
        }
        setMessage(`Request sent to ${result.request.groupName}. The owner has to approve it.`);
      })
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!code) return <Navigate to="/" replace />;

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center">
        {err ? (
          <>
            <div className="text-xl font-semibold">Couldn't request access</div>
            <div className="text-sm text-ink-400 mt-1">{err}</div>
          </>
        ) : message ? (
          <>
            <div className="text-xl font-semibold">Access request sent</div>
            <div className="text-sm text-ink-400 mt-1">{message}</div>
          </>
        ) : (
          <div className="text-ink-400">Requesting access…</div>
        )}
      </div>
    </div>
  );
}
