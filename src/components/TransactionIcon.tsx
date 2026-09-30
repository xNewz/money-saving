import React from "react";
import { ArrowRightLeft, Users } from "lucide-react";
import type { Transaction } from "@/types";
import { isLendingTransaction } from "@/types";

interface TransactionIconProps {
  transaction: Transaction;
  className?: string;
  iconClassName?: string;
}

export function TransactionIcon({ transaction, className = "", iconClassName = "" }: TransactionIconProps) {
  const isTransfer = transaction.type === "transfer";
  const isIncome = transaction.type === "income";
  const isLend = isLendingTransaction(transaction);

  const baseClasses = "shrink-0 rounded-full flex items-center justify-center font-bold shadow-sm";
  
  const colorClasses = isTransfer
    ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
    : isLend
    ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400"
    : isIncome
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
    : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400";

  return (
    <div className={`${baseClasses} ${colorClasses} ${className}`}>
      {isTransfer ? (
        <ArrowRightLeft className={iconClassName} />
      ) : isLend ? (
        <Users className={iconClassName} />
      ) : (
        transaction.category.substring(0, 1)
      )}
    </div>
  );
}
