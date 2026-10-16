import type { Transaction } from "@/types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * คำนวณส่วนต่างที่ได้รับคืนเกินกว่ายอดหนี้คงเหลือต่อรายการ transaction
 * โดยไล่เรียงตามเวลาแบบ FIFO (ได้รับคืนจะหักหนี้เก่าก่อน)
 * คืนค่าเป็น Map<transactionId, excessIncomeAmount>
 * ยอด excessIncomeAmount (> 0) คือส่วนต่างที่ได้รับเกินยอดหนี้ และให้นับเป็น "รายรับ" ของผู้ใช้
 */
export function getLendingIncomeExcessMap(transactions: Transaction[]): Map<string, number> {
  const excessMap = new Map<string, number>();

  // จัดกลุ่มตาม note (ชื่อคน/รายการ)
  const peopleMap: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    if (
      (t.type === "expense" && t.category === "ให้ยืม") ||
      (t.type === "income" && t.category === "ได้รับคืน")
    ) {
      const key = t.note?.trim() || "ไม่ระบุ";
      (peopleMap[key] ??= []).push(t);
    }
  }

  for (const group of Object.values(peopleMap)) {
    // เรียงตามวันเวลาจากเก่าไปใหม่ (ถ้าเวลาเท่ากันให้ 'ให้ยืม' มาก่อน 'ได้รับคืน')
    const sorted = [...group].sort((a, b) => {
      const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.type === "expense" && b.type === "income") return -1;
      if (a.type === "income" && b.type === "expense") return 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    let currentDebt = 0;

    for (const t of sorted) {
      if (t.type === "expense" && t.category === "ให้ยืม") {
        if (!t.isForgiven) {
          currentDebt = round2(currentDebt + t.amount);
        }
      } else if (t.type === "income" && t.category === "ได้รับคืน") {
        if (t.amount <= currentDebt) {
          currentDebt = round2(currentDebt - t.amount);
          excessMap.set(t.id, 0);
        } else {
          const principalPaid = Math.max(0, currentDebt);
          const excess = round2(t.amount - principalPaid);
          excessMap.set(t.id, excess);
          currentDebt = 0;
        }
      }
    }
  }

  return excessMap;
}
