import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import type { Transaction, Account } from "@/types";
import { ArrowRightLeft } from "lucide-react";

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | undefined;
  accounts: Account[];
}

export function TransactionDetailsModal({
  isOpen,
  onClose,
  transaction,
  accounts,
}: TransactionDetailsModalProps) {
  if (!transaction) return null;

  const isTransfer = transaction.type === "transfer";
  const isIncome = transaction.type === "income";

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
                  : isIncome
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
              }`}
            >
              {isTransfer ? (
                <ArrowRightLeft className="w-5 h-5" />
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
          </div>

          <div className="grid gap-4 text-sm bg-background p-4 rounded-xl border border-muted/50 shadow-sm">
            <div className="grid grid-cols-3 items-start gap-4">
              <span className="text-muted-foreground font-medium">วันที่:</span>
              <span className="col-span-2 font-semibold">
                {format(new Date(transaction.date), "d MMM yyyy")}
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
