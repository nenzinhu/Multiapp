"use client";

import * as React from "react";

import { countTo } from "@/lib/animations";

type CounterProps = {
  /** Null renders a dash instead of a number. */
  value: number | null;
  /** Key used to remember the last value between mounts. */
  id: string;
};

export function Counter({ value, id }: CounterProps) {
  const ref = React.useRef<HTMLSpanElement | null>(null);

  React.useEffect(() => {
    if (value === null) return;
    countTo(ref.current, value, id);
  }, [value, id]);

  if (value === null)
    return (
      <span aria-hidden="true" ref={ref}>
        —
      </span>
    );

  return <span aria-hidden="true" ref={ref} />;
}
