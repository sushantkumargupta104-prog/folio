interface NoticeProps {
  title?: string;
  children: string;
  tone?: "neutral" | "warn" | "danger" | "ok";
}

const TONE: Record<NonNullable<NoticeProps["tone"]>, string> = {
  neutral: "border-line bg-paper-2 text-ink-soft",
  warn: "border-[#ead9bf] bg-[#fbf6ee] text-warn",
  danger: "border-[#e3c4bc] bg-[#fbf3f0] text-danger",
  ok: "border-[#c9d4cc] bg-[#f3f6f3] text-ok",
};

export function Notice({ title, children, tone = "neutral" }: NoticeProps) {
  return (
    <div className={`rounded-[10px] border px-4 py-3 ${TONE[tone]}`} role="status">
      {title ? <p className="font-medium text-ink">{title}</p> : null}
      <p className={title ? "mt-1 text-sm" : "text-sm"}>{children}</p>
    </div>
  );
}
