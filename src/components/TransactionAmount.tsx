import React from "react";
import type { Transaction } from "@/types";
import { isLendingTransaction } from "@/types";

interface TransactionAmountProps {
  transaction: Transaction;
  className?: string;
  showSign?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function TransactionAmount({ 
  transaction, 
  className = "", 
  showSign = true,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
}: TransactionAmountProps) {
  const isTransfer = transaction.type === "transfer";
  const isIncome = transaction.type === "income";
  const isLend = isLendingTransaction(transaction);

  const colorClass = isTransfer
    ? "text-blue-600 dark:text-blue-500"
    : isLend
    ? "text-purple-600 dark:text-purple-400"
    : isIncome
    ? "text-emerald-600 dark:text-emerald-500"
    : "text-rose-600 dark:text-rose-500";

  const sign = showSign ? (isTransfer ? "" : isIncome ? "+" : "-") : "";
  const formattedAmount = transaction.amount.toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  return (
    <span className={`font-bold tracking-tight ${colorClass} ${className}`}>
      {sign}฿{formattedAmount}
    </span>
  );
}
