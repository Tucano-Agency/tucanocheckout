import type { ReactNode } from "react";

export function AdminPageHeader(props: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <header className="mb-10 border-b border-zinc-200/90 pb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        {props.title}
      </h1>
      {props.description ? (
        <div className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          {props.description}
        </div>
      ) : null}
    </header>
  );
}
