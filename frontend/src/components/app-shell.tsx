import {
  ChevronsUpDown,
  FilePlus2,
  Inbox,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  Rows3,
  UserRound,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { useStats } from "@/lib/queries";
import { cn } from "@/lib/utils";

function NavItem({
  to,
  icon,
  children,
  count,
  end,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
  count?: number;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-sidebar-foreground/80 transition-colors",
          "hover:bg-sidebar-accent hover:text-white [&_svg]:size-4 [&_svg]:text-sidebar-muted",
          isActive &&
            "bg-sidebar-accent text-white [&_svg]:text-gold before:absolute before:-left-3 before:top-1.5 before:h-5 before:w-[3px] before:rounded-r before:bg-gold",
        )
      }
    >
      {icon}
      <span className="flex-1">{children}</span>
      {!!count && (
        <span className="rounded bg-gold/90 px-1.5 py-px font-mono text-[10.5px] font-medium text-forest-900">
          {count}
        </span>
      )}
    </NavLink>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, hasRole } = useAuth();
  const { data: stats } = useStats();
  if (!user) return null;
  const canCapture = hasRole("capture_officer", "land_officer");

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground" onClick={onNavigate}>
      <Link to="/" className="flex items-center gap-3 px-4 pb-5 pt-5">
        <img src="/logo.jpg" alt="" className="size-10 rounded-full bg-white object-contain p-0.5" />
        <div className="leading-tight">
          <p className="text-[12.5px] font-semibold text-white">Lands & Rural Development</p>
          <p className="text-[11px] text-sidebar-muted">A2 Settlement Registry</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        <p className="px-2.5 pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-sidebar-muted/80">
          Registry
        </p>
        <NavItem to="/" end icon={<LayoutGrid />}>
          Overview
        </NavItem>
        <NavItem to="/applications" end icon={<Rows3 />}>
          All applications
        </NavItem>
        {user.role !== "admin" && user.role !== "capture_officer" && (
          <NavItem to="/queue" icon={<Inbox />} count={stats?.my_queue}>
            My queue
          </NavItem>
        )}
        {canCapture && (
          <NavItem to="/applications/new" icon={<FilePlus2 />}>
            Capture application
          </NavItem>
        )}
        {user.role === "admin" && (
          <>
            <p className="px-2.5 pb-1.5 pt-5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-sidebar-muted/80">
              Administration
            </p>
            <NavItem to="/officers" icon={<Users />}>
              Officers
            </NavItem>
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-sidebar-accent focus:outline-none">
            <span className="flex size-8 items-center justify-center rounded-full bg-gold/90 text-[11.5px] font-semibold text-forest-900">
              {initials(user.full_name)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12.5px] font-medium text-white">{user.full_name}</span>
              <span className="block truncate text-[11px] text-sidebar-muted">
                {user.role_display}
                {user.province_display ? ` · ${user.province_display}` : ""}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel>
              <p className="font-medium">{user.full_name}</p>
              <p className="text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/account">
                <UserRound /> My account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/account#password">
                <KeyRound /> Change password
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => logout()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <Sidebar />
      </aside>

      {/* mobile */}
      <div className="no-print sticky top-0 z-20 flex h-12 items-center gap-3 border-b bg-sidebar px-3 lg:hidden">
        <Button size="icon-sm" variant="ghost" className="text-white hover:bg-sidebar-accent" onClick={() => setOpen(true)}>
          <Menu />
        </Button>
        <img src="/logo.jpg" alt="" className="size-7 rounded-full bg-white p-px" />
        <span className="text-[13px] font-medium text-white">A2 Settlement Registry</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 animate-in slide-in-from-left">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main key={location.pathname} className="mx-auto max-w-[1280px] px-4 py-7 sm:px-8 lg:py-9">
        <Outlet />
      </main>
    </div>
  );
}

