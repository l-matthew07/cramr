import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useMe, useMyCourses, useMyGroups, useActiveSession, isMockApiActive } from "../lib/api";
import { usePresenceSocket } from "../lib/socket";
import { UserButton } from "@clerk/clerk-react";

const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function Layout() {
  const me = useMe();
  const courses = useMyCourses();
  const groups = useMyGroups();
  const active = useActiveSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const previewMode = isMockApiActive();

  // Connect Socket.IO presence channels once layout is mounted
  usePresenceSocket();

  return (
    <div className="min-h-full flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-ink-800 bg-ink-900 sticky top-0 z-30">
        <Link to="/" className="text-lg font-bold tracking-tight">
          Cramr
        </Link>
        <div className="flex items-center gap-3">
          {active.data && (
            <Link
              to="/session"
              className="text-xs text-emerald-400 font-medium flex items-center gap-1"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Studying
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-2 rounded-md hover:bg-ink-800 text-ink-300"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile sidebar drawer overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-20 w-64 border-r border-ink-800 bg-ink-900 p-4 flex flex-col gap-6
          transform transition-transform duration-200
          md:static md:translate-x-0 md:sticky md:top-0 md:h-screen
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <Link
          to="/"
          className="hidden md:block text-xl font-bold tracking-tight"
          onClick={() => setSidebarOpen(false)}
        >
          Cramr
        </Link>

        {active.data && (
          <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-3 text-sm">
            <div className="text-emerald-300 font-medium">Session active</div>
            <Link
              to="/session"
              className="text-ink-300 underline underline-offset-2"
              onClick={() => setSidebarOpen(false)}
            >
              Return to timer →
            </Link>
          </div>
        )}

        <nav className="flex flex-col gap-1 text-sm">
          <SideLink to="/" onClick={() => setSidebarOpen(false)}>Dashboard</SideLink>
          <SideLink to="/session" onClick={() => setSidebarOpen(false)}>Session</SideLink>
          <SideLink to="/profile" onClick={() => setSidebarOpen(false)}>Profile</SideLink>
        </nav>

        <SideSection title="Groups">
          {groups.data?.length
            ? groups.data.map((g) => (
                <SideLink key={g.id} to={`/groups/${g.id}`} onClick={() => setSidebarOpen(false)}>
                  {g.name}
                  <span className="text-ink-500 ml-1">· {g.memberCount}</span>
                </SideLink>
              ))
            : <div className="text-ink-500 text-xs">No groups yet</div>}
        </SideSection>

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] uppercase tracking-wider text-ink-500">Courses</div>
            <Link
              to="/courses/new"
              onClick={() => setSidebarOpen(false)}
              className="text-[11px] text-emerald-600 hover:text-emerald-400"
            >
              + Create
            </Link>
          </div>
          <div className="flex flex-col gap-0.5">
            {courses.data?.length
              ? courses.data.map((c) => (
                  <SideLink key={c.id} to={`/courses/${c.id}`} onClick={() => setSidebarOpen(false)}>
                    {c.code}
                  </SideLink>
                ))
              : (
                <Link
                  to="/courses/new"
                  onClick={() => setSidebarOpen(false)}
                  className="text-ink-500 text-xs hover:text-ink-300"
                >
                  Create your first course →
                </Link>
              )}
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2">
          {hasClerk ? (
            <UserButton />
          ) : (
            <div className="h-8 w-8 rounded-full bg-ink-700" />
          )}
          <div className="text-xs text-ink-400 truncate">
            {me.data?.displayName ?? "you"}
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        {previewMode && (
          <div className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs text-amber-200">
            Preview mode: using in-browser mock data because the local API/auth setup is unavailable.
          </div>
        )}
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 bg-ink-900 border-t border-ink-800 flex items-center justify-around px-2 py-2">
        <MobileNavLink to="/" label="Home" icon="⊞" />
        <MobileNavLink to="/session" label="Study" icon="⏱" />
        <MobileNavLink to="/profile" label="Profile" icon="👤" />
      </nav>
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-1">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function SideLink({
  to,
  children,
  onClick,
}: {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        `px-2 py-1.5 rounded text-ink-300 hover:bg-ink-800 text-sm ${
          isActive ? "bg-ink-800 text-ink-100" : ""
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function MobileNavLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg text-xs transition-colors ${
          isActive ? "text-ink-100" : "text-ink-500"
        }`
      }
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
