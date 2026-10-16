import type { Transaction } from "@/types";

export const DEFAULT_LEND_REMINDER_DAYS = 7;
/** แจ้งล่วงหน้ากี่วันก่อนถึงวันนัดคืน */
export const UPCOMING_WINDOW_DAYS = 3;

export type LendReminderStatus = "overdue" | "today" | "upcoming" | "scheduled";

export interface LendReminder {
  note: string;
  balance: number;
  dueDate: Date;
  /** จำนวนวันจนถึงวันนัด (ติดลบ = เลยกำหนดมาแล้ว) */
  daysUntil: number;
  status: LendReminderStatus;
  /** true = ผู้ใช้ตั้งวันนัดคืนเอง, false = คำนวณจากวันที่ให้ยืม + X วัน */
  hasExplicitDue: boolean;
  lentDate: string;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const parseLocalDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * คำนวณรายการแจ้งเตือนทวงเงินต่อคน
 * ใช้หลัก FIFO: เงินที่ได้รับคืนจะไปหักรายการให้ยืมที่เก่าที่สุดก่อน
 * รายการแรกที่ยังหักไม่หมดจะเป็นตัวกำหนดวันทวง
 */
export function computeLendReminders(
  transactions: Transaction[],
  defaultDays: number = DEFAULT_LEND_REMINDER_DAYS,
  now: Date = new Date()
): LendReminder[] {
  const people: Record<string, { lends: Transaction[]; received: number }> = {};

  for (const t of transactions) {
    const key = t.note?.trim() || "ไม่ระบุ";
    if (t.type === "expense" && t.category === "ให้ยืม" && !t.isForgiven) {
      (people[key] ??= { lends: [], received: 0 }).lends.push(t);
    } else if (t.type === "income" && t.category === "ได้รับคืน") {
      (people[key] ??= { lends: [], received: 0 }).received += t.amount;
    }
  }

  const today = startOfDay(now);
  const reminders: LendReminder[] = [];

  for (const [note, { lends, received }] of Object.entries(people)) {
    const totalLent = lends.reduce((s, t) => s + t.amount, 0);
    const balance = Math.round((totalLent - received + Number.EPSILON) * 100) / 100;
    if (balance <= 0) continue;

    const sorted = [...lends].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let remainingPaid = received;
    let target = sorted[sorted.length - 1];
    for (const l of sorted) {
      if (remainingPaid >= l.amount - 0.005) {
        remainingPaid -= l.amount;
      } else {
        target = l;
        break;
      }
    }

    const hasExplicitDue = !!target.repayDueDate;
    const dueDate = hasExplicitDue
      ? parseLocalDate(target.repayDueDate!)
      : (() => {
          const d = startOfDay(new Date(target.date));
          d.setDate(d.getDate() + defaultDays);
          return d;
        })();

    const daysUntil = Math.round((startOfDay(dueDate).getTime() - today.getTime()) / 86400000);
    const status: LendReminderStatus =
      daysUntil < 0 ? "overdue" : daysUntil === 0 ? "today" : daysUntil <= UPCOMING_WINDOW_DAYS ? "upcoming" : "scheduled";

    reminders.push({ note, balance, dueDate, daysUntil, status, hasExplicitDue, lentDate: target.date });
  }

  return reminders.sort((a, b) => a.daysUntil - b.daysUntil);
}

export const isActiveReminder = (r: LendReminder) => r.status !== "scheduled";

export function describeReminder(r: LendReminder): string {
  if (r.status === "overdue") return `เลยกำหนด ${Math.abs(r.daysUntil)} วัน`;
  if (r.status === "today") return "ถึงกำหนดวันนี้";
  return `อีก ${r.daysUntil} วัน`;
}
