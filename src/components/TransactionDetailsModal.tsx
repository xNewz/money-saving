import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { formatThaiDate } from "@/lib/utils";
import type { Transaction, Account } from "@/types";
import { isLendingTransaction, isForgivenLending } from "@/types";
import { ArrowRightLeft, Users, HeartHandshake, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | undefined;
  accounts: Account[];
  onToggleForgive?: (tx: Transaction) => void;
}

export function TransactionDetailsModal({
  isOpen,
  onClose,
  transaction,
  accounts,
  onToggleForgive,
}: TransactionDetailsModalProps) {
  if (!transaction) return null;

  const isTransfer = transaction.type === "transfer";
  const isIncome = transaction.type === "income";
  const isLend = isLendingTransaction(transaction);

  const acc = accounts.find((a) => a.id === transaction.accountId);
  const toAcc = accounts.find((a) => a.id === transaction.toAccountId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${
                isTransfer
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                  : isLend
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400"
                  : isIncome
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
              }`}
            >
              {isTransfer ? (
                <ArrowRightLeft className="w-5 h-5" />
              ) : isLend ? (
                <Users className="w-5 h-5" />
              ) : (
                transaction.category.substring(0, 1)
              )}
            </div>
            {isTransfer ? "โอนเงิน" : transaction.category}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="flex flex-col space-y-1.5 text-center bg-muted/30 p-4 rounded-xl border border-muted/50">
            <span className="text-sm font-medium text-muted-foreground">
              จำนวนเงิน
            </span>
            <span
              className={`text-3xl font-bold tracking-tight ${
                isTransfer
                  ? "text-blue-600 dark:text-blue-500"
                  : isLend
                  ? "text-purple-600 dark:text-purple-400"
                  : isIncome
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-rose-600 dark:text-rose-500"
              }`}
            >
              {isTransfer ? "" : isIncome ? "+" : "-"}฿
              {transaction.amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {isLend && (
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                {transaction.category === "ให้ยืม"
                  ? transaction.isForgiven
                    ? "ยกหนี้ให้แล้ว (คิดเป็นรายจ่าย)"
                    : "เงินให้ยืม (ไม่คิดในงบรายจ่าย)"
                  : "เงินรับคืน (ไม่คิดในงบรายรับ)"}
              </span>
            )}
            {transaction.category === "ให้ยืม" && transaction.isForgiven && (
              <span className="inline-flex items-center justify-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/30 w-fit mx-auto mt-1">
                <HeartHandshake className="w-3.5 h-3.5" />
                ยกหนี้ให้แล้ว
              </span>
            )}
          </div>

          {transaction.category === "ให้ยืม" ? (
            transaction.isForgiven ? (
              <div className="flex flex-col gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="text-base">🤝</span>
                  <div>
                    <p className="font-semibold">ยกหนี้ให้เรียบร้อยแล้ว</p>
                    <p className="text-muted-foreground mt-0.5">
                      รายการนี้ถูกบันทึกเป็นรายจ่ายในงบประมาณของคุณแล้ว และยอดหนี้คงค้างถูกเคลียร์เรียบร้อย โดยไม่มีการตัดเงินในบัญชีซ้ำ
                    </p>
                  </div>
                </div>
                {onToggleForgive && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleForgive(transaction)}
                    className="w-full mt-1 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-lg text-xs h-8"
                  >
                    <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                    ยกเลิกการยกหนี้ (กลับเป็นเงินให้ยืมปกติ)
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 p-3.5 bg-purple-50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 rounded-xl text-xs leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="text-base">💡</span>
                  <div>
                    <p className="font-semibold">รายการเงินให้ยืม</p>
                    <p className="text-muted-foreground mt-0.5">
                      รายการนี้ยังไม่ถูกนำไปคำนวณในงบรายจ่ายประจำเดือน หากต้องการยกหนี้ให้ สามารถกดปุ่มด้านล่างเพื่อบันทึกเป็นรายจ่ายได้ทันที
                    </p>
                  </div>
                </div>
                {onToggleForgive && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onToggleForgive(transaction)}
                    className="w-full mt-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs h-8 font-medium shadow-sm transition-all"
                  >
                    <HeartHandshake className="w-3.5 h-3.5 mr-1.5" />
                    ยกหนี้ให้ (คิดเป็นรายจ่าย)
                  </Button>
                )}
              </div>
            )
          ) : isLend ? (
            <div className="flex items-start gap-2.5 p-3 bg-purple-50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 rounded-xl text-xs leading-relaxed">
              <span className="text-sm">💡</span>
              <div>
                <p className="font-semibold">รายการได้รับคืน</p>
                <p className="text-muted-foreground mt-0.5">
                  รายการนี้ไม่ถูกนำไปคำนวณในงบประมาณและรายรับประจำเดือน แต่จะเพิ่มยอดเงินในบัญชีจริง และตัดยอดในรายการเงินรอรับคืนตามปกติ
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 text-sm bg-background p-4 rounded-xl border border-muted/50 shadow-sm">
            <div className="grid grid-cols-3 items-start gap-4">
              <span className="text-muted-foreground font-medium">วันที่:</span>
              <span className="col-span-2 font-semibold">
                {formatThaiDate(transaction.date)}
              </span>
            </div>

            {isTransfer ? (
              <>
                <div className="grid grid-cols-3 items-start gap-4">
                  <span className="text-muted-foreground font-medium">
                    จากบัญชี:
                  </span>
                  <span className="col-span-2 font-semibold">
                    {acc?.name || "ไม่ระบุ"}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-start gap-4">
                  <span className="text-muted-foreground font-medium">
                    ไปยังบัญชี:
                  </span>
                  <span className="col-span-2 font-semibold">
                    {toAcc?.name || "ไม่ระบุ"}
                  </span>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-3 items-start gap-4">
                <span className="text-muted-foreground font-medium">บัญชี:</span>
                <span className="col-span-2 font-semibold">
                  {acc?.name || "ไม่ระบุ"}
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 items-start gap-4 border-t pt-4 mt-2">
              <span className="text-muted-foreground font-medium">
                บันทึกเพิ่มเติม:
              </span>
              <span className="col-span-2 font-medium text-foreground whitespace-pre-wrap break-words">
                {transaction.note || "-"}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
