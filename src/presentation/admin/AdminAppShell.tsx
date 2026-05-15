"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconClose,
  IconCredit,
  IconGrid,
  IconLogout,
  IconMenu,
  IconOrders,
  IconTag,
} from "@/presentation/admin/icons";

type Section = {
  readonly heading: string;
  readonly items: ReadonlyArray<{
    readonly href: string;
    readonly label: string;
    readonly icon: ReactNode;
  }>;
};

function navSections(tenantSlug: string): Section[] {
  const base = `/admin/${tenantSlug}`;
  return [
    {
      heading: "Visão geral",
      items: [
        {
          href: base,
          label: "Início",
          icon: <IconGrid className="h-5 w-5 shrink-0 opacity-90" />,
        },
      ],
    },
    {
      heading: "Vendas",
      items: [
        {
          href: `${base}/orders`,
          label: "Pedidos",
          icon: <IconOrders className="h-5 w-5 shrink-0 opacity-90" />,
        },
      ],
    },
    {
      heading: "Catálogo",
      items: [
        {
          href: `${base}/offers`,
          label: "Ofertas",
          icon: <IconTag className="h-5 w-5 shrink-0 opacity-90" />,
        },
      ],
    },
    {
      heading: "Pagamentos",
      items: [
        {
          href: `${base}/gateways`,
          label: "Gateways BYOG",
          icon: <IconCredit className="h-5 w-5 shrink-0 opacity-90" />,
        },
      ],
    },
  ];
}

function linkActive(pathname: string, tenantSlug: string, href: string) {
  const dash = `/admin/${tenantSlug}`;
  if (href === dash) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarPanel(props: {
  tenantSlug: string;
  tenantName: string;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const { tenantSlug, tenantName, pathname, onNavigate, className } = props;

  return (
    <div className={className}>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800/80 px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 text-sm font-bold tracking-tight text-white shadow-lg shadow-emerald-950/40 ring-1 ring-white/10">
          T
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">
            {tenantName}
          </p>
          <p className="truncate font-mono text-[11px] text-zinc-500">
            {tenantSlug}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-6 pt-5">
        {navSections(tenantSlug).map((section) => (
          <div key={section.heading}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = linkActive(pathname, tenantSlug, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => onNavigate?.()}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                        active
                          ? "bg-emerald-500/12 text-emerald-300 shadow-inner shadow-black/10 ring-1 ring-emerald-400/20"
                          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-zinc-800/80 p-3">
        <LogoutButton tenantSlug={tenantSlug} variant="sidebar" />
      </div>
    </div>
  );
}

function LogoutButton(props: {
  tenantSlug: string;
  variant: "sidebar" | "compact";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
      router.push(`/admin/login?tenant=${encodeURIComponent(props.tenantSlug)}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (props.variant === "compact") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void logout()}
        className="rounded-lg p-2 text-zinc-500 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
        aria-label="Sair"
      >
        <IconLogout className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void logout()}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-zinc-500 outline-none transition-colors hover:bg-zinc-800/80 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-400/80 disabled:opacity-50"
    >
      <IconLogout className="h-5 w-5 shrink-0" />
      {busy ? "Saindo…" : "Sair"}
    </button>
  );
}

export type AdminAppShellProps = {
  tenantSlug: string;
  tenantName: string;
  children: ReactNode;
};

export function AdminAppShell(props: AdminAppShellProps) {
  const { tenantSlug, tenantName, children } = props;
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-zinc-950 lg:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur-lg lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-zinc-300 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-expanded={mobileOpen}
          aria-label="Abrir menu"
        >
          <IconMenu className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold text-white">
            {tenantName}
          </p>
          <p className="truncate font-mono text-[11px] text-zinc-500">
            {tenantSlug}
          </p>
        </div>
        <LogoutButton tenantSlug={tenantSlug} variant="compact" />
      </header>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,100vw-2rem)] flex-col bg-zinc-950 shadow-2xl shadow-black/50 ring-1 ring-zinc-800 lg:hidden">
            <div className="flex h-14 shrink-0 items-center justify-end border-b border-zinc-800 px-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Fechar"
              >
                <IconClose className="h-6 w-6" />
              </button>
            </div>
            <SidebarPanel
              tenantSlug={tenantSlug}
              tenantName={tenantName}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            />
          </aside>
        </>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-zinc-800/90 bg-zinc-950 lg:flex">
        <SidebarPanel
          tenantSlug={tenantSlug}
          tenantName={tenantName}
          pathname={pathname}
          className="flex h-full flex-col overflow-hidden"
        />
      </aside>

      {/* Main */}
      <div className="flex min-h-0 flex-1 flex-col lg:min-h-dvh">
        <div className="flex flex-1 flex-col bg-gradient-to-br from-zinc-50 via-white to-emerald-50/[0.35]">
          <main className="flex-1 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
          <footer className="border-t border-zinc-200/80 bg-white/40 px-6 py-4 text-center text-[11px] text-zinc-400 backdrop-blur-sm">
            Tucano Checkout · painel do produtor
          </footer>
        </div>
      </div>
    </div>
  );
}
