import { useState, useEffect } from "react";

interface ClientDateProps {
  date: string;
  className?: string;
}

/**
 * Client-only date formatting component.
 * Renders placeholder on server, formatted date on client.
 * Avoids hydration mismatch from timezone/locale differences.
 */
export function ClientDate({ date, className }: ClientDateProps) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    setFormatted(
      new Date(date).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    );
  }, [date]);

  return (
    <time dateTime={date} className={className}>
      {formatted ?? ""}
    </time>
  );
}
