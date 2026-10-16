"use client";

import React, { useEffect, useState } from "react";
import { Bell, BellRing, Copy, X, AlarmClock, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatThaiDate } from "@/lib/utils";
import { describeReminder, isActiveReminder, type LendReminder } from "@/lib/lendReminders";

const DISMISS_KEY = "lendReminderDismissed";

const statusStyles: Record<LendReminder["status"], string> = {
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  today: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  upcoming: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  scheduled: "bg-muted text-muted-foreground border-muted",
};

const fmtMoney = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export const copyReminderMessage = async (r: LendReminder) => {
  const msg = `สวัสดีครับ ขอทวงเงินที่ยืมไปนะครับ ยอดคงค้าง ฿${fmtMoney(r.balance)}${
    r.hasExplicitDue ? ` (นัดคืนวันที่ ${formatThaiDate(r.dueDate, "d MMM yyyy")})` : ""
  } ขอบคุณครับ 🙏`;
  try {
    await navigator.clipboard.writeText(msg);
    toast.success(`คัดลอกข้อความทวง ${r.note} แล้ว`);
  } catch {
    toast.error("คัดลอกไม่สำเร็จ");
  }
};

function ReminderRow({ r, onOpen }: { r: LendReminder; onOpen?: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="group flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${statusStyles[r.status]}`}>
        {r.status === "overdue" ? <AlarmClock className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-semibold truncate">{r.note}</span>
        <span className="text-[11px] text-muted-foreground truncate">
          {describeReminder(r)} • {formatThaiDate(r.dueDate, "d MMM")}
          {!r.hasExplicitDue && " (อัตโนมัติ)"}
        </span>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-sm font-bold text-violet-500">฿{fmtMoney(r.balance)}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); copyReminderMessage(r); }}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mt-0.5"
        >
          <Copy className="w-2.5 h-2.5" /> ข้อความทวง
        </button>
      </div>
    </div>
  );
}

interface BellProps {
  reminders: LendReminder[];
  reminderDays: number;
  onChangeReminderDays: (days: number) => void;
  onOpenHistory: () => void;
}

export function LendReminderBell({ reminders, reminderDays, onChangeReminderDays, onOpenHistory }: BellProps) {
  const active = reminders.filter(isActiveReminder);
  const scheduled = reminders.filter((r) => !isActiveReminder(r));
  const urgentCount = active.filter((r) => r.status !== "upcoming").length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 sm:w-9 sm:h-9 relative" aria-label="แจ้งเตือนทวงเงิน">
          {urgentCount > 0 ? (
            <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 animate-[wiggle_1.2s_ease-in-out_infinite]" />
          ) : (
            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          )}
          {active.length > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white ring-2 ring-background ${
                urgentCount > 0 ? "bg-destructive" : "bg-sky-500"
              }`}
            >
              {active.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] max-w-[calc(100vw-1.5rem)] rounded-xl p-1.5">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="font-semibold">แจ้งเตือนทวงเงิน</span>
          {active.length > 0 && <span className="text-[11px] font-medium text-muted-foreground">{active.length} รายการ</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-[320px] overflow-y-auto">
          {active.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
              ยังไม่มีรายการที่ต้องทวง 🎉
            </div>
          ) : (
            active.map((r) => <ReminderRow key={r.note} r={r} onOpen={onOpenHistory} />)
          )}

          {scheduled.length > 0 && (
            <>
              <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                ยังไม่ถึงกำหนด
              </div>
              {scheduled.map((r) => <ReminderRow key={r.note} r={r} onOpen={onOpenHistory} />)}
            </>
          )}
        </div>

        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-2 px-2 py-1.5" onKeyDown={(e) => e.stopPropagation()}>
          <span className="text-[11px] text-muted-foreground leading-tight">
            ไม่ได้ตั้งวันนัดคืน
            <br />
            ให้เตือนเมื่อค้างเกิน
          </span>
          <Select value={reminderDays.toString()} onValueChange={(v) => onChangeReminderDays(parseInt(v))}>
            <SelectTrigger className="w-[100px] h-8 text-xs rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {[3, 7, 14, 30].map((d) => (
                <SelectItem key={d} value={d.toString()} className="text-xs rounded-lg">{d} วัน</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface BannerProps {
  reminders: LendReminder[];
  onOpenHistory: () => void;
}

/** แบนเนอร์บน Dashboard แสดงเฉพาะรายการที่เลยกำหนด/ถึงกำหนดวันนี้ ซ่อนได้ทีละคนจนถึงพรุ่งนี้ */
export function LendReminderBanner({ reminders, onOpenHistory }: BannerProps) {
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  const todayKey = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}"));
    } catch {
      setDismissed({});
    }
  }, []);

  const dismiss = (notes: string[]) => {
    const next = { ...dismissed };
    notes.forEach((n) => (next[n] = todayKey));
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  };

  const due = reminders.filter(
    (r) => (r.status === "overdue" || r.status === "today") && dismissed[r.note] !== todayKey
  );
  if (due.length === 0) return null;

  const total = due.reduce((s, r) => s + r.balance, 0);
  const hasOverdue = due.some((r) => r.status === "overdue");

  return (
    <section
      className={`relative overflow-hidden rounded-xl sm:rounded-2xl border shadow-sm p-3 sm:p-4 animate-[reminder-in_0.5s_ease-out] ${
        hasOverdue
          ? "bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-transparent border-rose-500/20"
          : "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
            hasOverdue ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-500"
          }`}
        >
          <BellRing className="w-4 h-4 sm:w-5 sm:h-5 animate-[wiggle_1.2s_ease-in-out_infinite]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm sm:text-base font-semibold">ได้เวลาทวงเงินแล้ว!</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {due.length} คน • รวม ฿{fmtMoney(total)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(due.map((r) => r.note))}
              className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded-full shrink-0"
              aria-label="ซ่อนวันนี้"
              title="ซ่อนจนถึงพรุ่งนี้"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5 sm:gap-2">
            {due.slice(0, 6).map((r) => (
              <div
                key={r.note}
                className={`flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border text-xs bg-background/70 backdrop-blur ${statusStyles[r.status]}`}
              >
                <span className="font-semibold text-foreground truncate max-w-[110px]">{r.note}</span>
                <span className="font-bold">฿{fmtMoney(r.balance)}</span>
                <span className="text-[10px] opacity-80 hidden sm:inline">• {describeReminder(r)}</span>
                <button
                  type="button"
                  onClick={() => copyReminderMessage(r)}
                  className="ml-0.5 p-1 rounded-full hover:bg-foreground/10"
                  title="คัดลอกข้อความทวง"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            ))}
            {due.length > 6 && (
              <span className="text-xs text-muted-foreground self-center">+{due.length - 6} คน</span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenHistory}
            className="mt-2 text-[11px] sm:text-xs font-medium text-primary hover:underline"
          >
            ดูประวัติให้ยืม-คืนเงิน →
          </button>
        </div>
      </div>
    </section>
  );
}
