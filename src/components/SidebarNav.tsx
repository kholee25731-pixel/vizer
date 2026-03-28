"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Folder, Brain, Sparkles, BarChart3 } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "대시보드", Icon: Home },
  { href: "/projects", label: "프로젝트", Icon: Folder },
  { href: "/archive", label: "피드백 아카이브", Icon: Brain },
  { href: "/ai-feedback", label: "AI 피드백", Icon: Sparkles },
  { href: "/style-stats", label: "통계", Icon: BarChart3 },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 pb-4">
      <ul className="space-y-1">
        {navItems.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`group flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  active
                    ? "bg-sky-100 font-medium text-sky-700"
                    : "text-zinc-700 hover:bg-sky-50 hover:text-sky-700"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active
                      ? "text-sky-700"
                      : "text-sky-500 group-hover:text-sky-700"
                  }`}
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
