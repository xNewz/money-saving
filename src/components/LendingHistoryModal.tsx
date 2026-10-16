import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatThaiDate } from "@/lib/utils";
import type { Transaction, Account } from "@/types";
import { isRawLendingTransaction, isRawLendingExpense, isLendingIncome, isForgivenLending } from "@/types";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  History,
  HeartHandshake,
  Undo2,
} from "lucide-react";

interface LendingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  accounts: Account[];
  onToggleForgive?: (tx: Transaction) => void;
  onForgivePerson?: (personName: string, remainingBalance: number) => void;
}

export const LendingHistoryModal: React.FC<LendingHistoryModalProps> = ({
  isOpen,
  onClose,
  transactions,
  accounts,
  onToggleForgive,
  onForgivePerson,
}) => {
  const [activeTab, setActiveTab] = useState<"byPerson" | "timeline">("byPerson");
  const [filterStatus, setFilterStatus] = useState<"all" | "unpaid" | "settled">("all");
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [personToForgive, setPersonToForgive] = useState<{ name: string; balance: number } | null>(null);

  // Filter all lending-related transactions (including active, repaid, and forgiven)
  const lendingTxs = useMemo(() => {
    return transactions
      .filter((t) => isRawLendingTransaction(t))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // Aggregate by Person (grouped by Note)
  const peopleSummary = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        totalLent: number;
        totalReceived: number;
        totalForgiven: number;
        latestDate: string;
        transactions: Transaction[];
      }
    > = {};

    lendingTxs.forEach((t) => {
      const key = t.note?.trim() || "ไม่ระบุชื่อ";
      if (!map[key]) {
        map[key] = {
          name: key,
          totalLent: 0,
          totalReceived: 0,
          totalForgiven: 0,
          latestDate: t.date,
          transactions: [],
        };
      }
      if (t.type === "expense" && t.category === "ให้ยืม") {
        map[key].totalLent += t.amount;
        if (t.isForgiven) {
          map[key].totalForgiven += t.amount;
        }
      } else if (isLendingIncome(t)) {
        map[key].totalReceived += t.amount;
      }
      map[key].transactions.push(t);
      if (new Date(t.date) > new Date(map[key].latestDate)) {
        map[key].latestDate = t.date;
      }
    });

    return Object.values(map)
      .map((item) => {
        const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
        const net = round2(item.totalLent - item.totalReceived - item.totalForgiven);
        const balance = Math.max(0, net);
        // ได้รับคืนเกินกว่าที่ให้ยืม (มักเกิดจากชื่อในบันทึกช่วยจำไม่ตรงกัน)
        const overpaid = Math.max(0, -net);
        const resolvedAmount = item.totalReceived + item.totalForgiven;
        const percentRepaid = item.totalLent > 0
          ? Math.min(100, Math.round((resolvedAmount / item.totalLent) * 100))
          : 100;
        const isSettled = balance === 0;
        const isFullyForgiven = isSettled && item.totalForgiven > 0 && item.totalReceived === 0;
        const isPartiallyForgiven = isSettled && item.totalForgiven > 0 && item.totalReceived > 0;
        return {
          ...item,
          balance,
          overpaid,
          percentRepaid,
          isSettled,
          isFullyForgiven,
          isPartiallyForgiven,
        };
      })
      .sort((a, b) => {
        // Unpaid first, then sorted by remaining balance desc
        if (!a.isSettled && b.isSettled) return -1;
        if (a.isSettled && !b.isSettled) return 1;
        return b.balance - a.balance;
      });
  }, [lendingTxs]);

  // Totals
  const totals = useMemo(() => {
    let lent = 0;
    let received = 0;
    let forgiven = 0;
    peopleSummary.forEach((p) => {
      lent += p.totalLent;
      received += p.totalReceived;
      forgiven += p.totalForgiven;
    });
    return {
      totalLent: lent,
      totalReceived: received,
      totalForgiven: forgiven,
      // รวมยอดค้างรายคน ไม่ใช่ lent - received รวม เพราะยอดที่รับเกินของคนหนึ่งไม่ควรไปหักหนี้ของอีกคน
      outstanding: Math.round((peopleSummary.reduce((s, p) => s + p.balance, 0) + Number.EPSILON) * 100) / 100,
      activeCount: peopleSummary.filter((p) => !p.isSettled).length,
      settledCount: peopleSummary.filter((p) => p.isSettled).length,
    };
  }, [peopleSummary]);

  // Filtered people
  const filteredPeople = useMemo(() => {
    if (filterStatus === "unpaid") return peopleSummary.filter((p) => !p.isSettled);
    if (filterStatus === "settled") return peopleSummary.filter((p) => p.isSettled);
    return peopleSummary;
  }, [peopleSummary, filterStatus]);

  const getAccountName = (accId?: string) => {
    if (!accId) return "ไม่ระบุบัญชี";
    const acc = accounts.find((a) => a.id === accId);
    return acc ? acc.name : "ทั่วไป";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[94vw] sm:max-w-2xl max-h-[88vh] sm:max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-background shadow-xl">
        {/* Header Section */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-muted/20 shrink-0 text-left">
          <div className="flex items-center gap-3 pr-6">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center text-foreground shrink-0 shadow-xs">
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold truncate">
                ประวัติการให้ยืมและการได้รับคืน
              </DialogTitle>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                ไม่คิดในงบรายจ่าย/รายรับ • แสดงสถานะตามจริง
              </p>
            </div>
          </div>

          {/* Metric Cards Summary - Mobile Optimized */}
          <div className={`grid ${totals.totalForgiven > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-2 mt-3 sm:mt-4`}>
            <div className="bg-purple-500/10 border border-purple-500/20 p-2 sm:p-2.5 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] sm:text-xs font-medium text-purple-700 dark:text-purple-300 truncate">
                ให้ยืมสะสม
              </span>
              <p className="text-xs sm:text-base font-bold text-purple-700 dark:text-purple-300 mt-1 truncate">
                ฿{totals.totalLent.toLocaleString()}
              </p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 sm:p-2.5 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] sm:text-xs font-medium text-emerald-700 dark:text-emerald-300 truncate">
                ได้รับคืนแล้ว
              </span>
              <p className="text-xs sm:text-base font-bold text-emerald-700 dark:text-emerald-300 mt-1 truncate">
                ฿{totals.totalReceived.toLocaleString()}
              </p>
            </div>
            {totals.totalForgiven > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-2 sm:p-2.5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs font-medium text-rose-700 dark:text-rose-300 truncate flex items-center gap-1">
                  <HeartHandshake className="w-3 h-3" />
                  ยกหนี้ให้แล้ว
                </span>
                <p className="text-xs sm:text-base font-bold text-rose-700 dark:text-rose-300 mt-1 truncate">
                  ฿{totals.totalForgiven.toLocaleString()}
                </p>
              </div>
            )}
            <div className="bg-amber-500/10 border border-amber-500/20 p-2 sm:p-2.5 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] sm:text-xs font-medium text-amber-700 dark:text-amber-300 truncate">
                คงค้างปัจจุบัน
              </span>
              <p className="text-xs sm:text-base font-bold text-amber-700 dark:text-amber-300 mt-1 truncate">
                ฿{totals.outstanding.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Tab Navigation - Segmented Control (Full width on mobile) */}
          <div className="space-y-2 mt-3 pt-2 border-t">
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("byPerson")}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "byPerson"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>รายบุคคล ({peopleSummary.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("timeline")}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "timeline"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>ไทม์ไลน์ ({lendingTxs.length})</span>
              </button>
            </div>

            {/* Filter pills under Tab (Horizontal Scroll on Mobile) */}
            {activeTab === "byPerson" && peopleSummary.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setFilterStatus("all")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all ${
                    filterStatus === "all"
                      ? "bg-foreground text-background"
                      : "bg-muted/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ทั้งหมด ({peopleSummary.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("unpaid")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all ${
                    filterStatus === "unpaid"
                      ? "bg-amber-600 text-white dark:bg-amber-500 dark:text-black font-semibold"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                  }`}
                >
                  ยังค้าง ({totals.activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("settled")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all ${
                    filterStatus === "settled"
                      ? "bg-emerald-600 text-white font-semibold"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                  }`}
                >
                  คืนครบแล้ว ({totals.settledCount})
                </button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
          {lendingTxs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Users className="w-6 h-6 opacity-40" />
              </div>
              <p className="font-semibold text-foreground text-sm">ยังไม่มีประวัติการให้ยืมหรือรับคืนเงิน</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                เมื่อคุณบันทึกรายการหมวด &quot;ให้ยืม&quot; หรือ &quot;ได้รับคืน&quot; ข้อมูลจะปรากฏที่นี่
              </p>
            </div>
          ) : activeTab === "byPerson" ? (
            filteredPeople.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                ไม่พบรายการตามเงื่อนไขที่เลือก
              </div>
            ) : (
              filteredPeople.map((person) => {
                const isExpanded = expandedPerson === person.name;
                return (
                  <div
                    key={person.name}
                    className={`border rounded-xl transition-all overflow-hidden bg-card ${
                      isExpanded ? "ring-1 ring-primary/20 shadow-sm" : "hover:border-muted-foreground/30"
                    }`}
                  >
                    {/* Person Card Header - Mobile Optimized 2-layer Layout */}
                    <div
                      onClick={() => setExpandedPerson(isExpanded ? null : person.name)}
                      className="p-3 sm:p-3.5 cursor-pointer hover:bg-muted/30 transition-colors space-y-2"
                    >
                      {/* Row 1: Name + Status Badge + Expand Button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs sm:text-sm ${
                              person.isSettled
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {person.name.substring(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-foreground block truncate">
                              {person.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 shrink-0" />
                              {formatThaiDate(person.latestDate)}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge + Forgive Button + Chevron */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {onForgivePerson && !person.isSettled && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPersonToForgive({ name: person.name, balance: person.balance });
                              }}
                              className="h-7 px-2 text-[11px] font-medium text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg gap-1 shrink-0"
                              title="ยกหนี้ให้ (คิดเป็นรายจ่าย)"
                            >
                              <HeartHandshake className="w-3.5 h-3.5" />
                              <span>ยกหนี้ให้</span>
                            </Button>
                          )}

                          {person.isSettled ? (
                            person.isFullyForgiven ? (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
                                <HeartHandshake className="w-3 h-3" />
                                <span>ยกหนี้ให้แล้ว</span>
                              </span>
                            ) : person.isPartiallyForgiven ? (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>คืน + ยกหนี้ครบ</span>
                              </span>
                            ) : person.overpaid > 0 ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/20"
                                title="ยอดได้รับคืนมากกว่าที่ให้ยืม — ตรวจสอบว่าชื่อในบันทึกช่วยจำตรงกับรายการให้ยืมหรือไม่"
                              >
                                <AlertCircle className="w-3 h-3" />
                                <span>รับเกิน ฿{person.overpaid.toLocaleString()}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>คืนครบแล้ว</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                              <AlertCircle className="w-3 h-3" />
                              <span>ค้าง ฿{person.balance.toLocaleString()}</span>
                            </span>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full text-muted-foreground p-0"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Row 2: Amounts & Mini Progress Bar */}
                      <div className="pt-1 border-t border-muted/40">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-1">
                          <span>
                            ยืม <strong className="text-foreground font-semibold">฿{person.totalLent.toLocaleString()}</strong>
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>
                              คืนแล้ว <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">฿{person.totalReceived.toLocaleString()}</strong>
                            </span>
                            {person.totalForgiven > 0 && (
                              <span>
                                ยกหนี้ <strong className="text-rose-600 dark:text-rose-400 font-semibold">฿{person.totalForgiven.toLocaleString()}</strong>
                              </span>
                            )}
                            <span className="text-[10px]">({person.percentRepaid}%)</span>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              person.isSettled
                                ? person.isFullyForgiven
                                  ? "bg-rose-500"
                                  : "bg-emerald-500"
                                : "bg-gradient-to-r from-amber-500 to-emerald-500"
                            }`}
                            style={{ width: `${person.percentRepaid}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Accordion Transactions Breakdown */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-2.5 sm:p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-muted-foreground px-1 pb-1">
                          <span>ประวัติรายการ ({person.transactions.length})</span>
                          <span>ยอดเงิน</span>
                        </div>
                        <div className="space-y-1.5">
                          {person.transactions.map((tx) => {
                            const isLend = tx.type === "expense" && tx.category === "ให้ยืม";
                            return (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-background border text-xs shadow-2xs gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                      isLend
                                        ? tx.isForgiven
                                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                          : "bg-purple-500/15 text-purple-700 dark:text-purple-300"
                                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                    }`}
                                  >
                                    {isLend ? (
                                      tx.isForgiven ? (
                                        <HeartHandshake className="w-3.5 h-3.5" />
                                      ) : (
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                      )
                                    ) : (
                                      <ArrowDownLeft className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-[11px] sm:text-xs text-foreground truncate flex items-center gap-1.5">
                                      <span>{isLend ? "ให้ยืม" : "ได้รับคืน"}</span>
                                      {tx.isForgiven && (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 font-medium">
                                          ยกหนี้ให้แล้ว
                                        </span>
                                      )}
                                      {tx.note && tx.note !== person.name && (
                                        <span className="text-muted-foreground font-normal truncate"> ({tx.note})</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                      <span>{formatThaiDate(tx.date)}</span>
                                      <span>•</span>
                                      <span className="flex items-center gap-0.5 truncate max-w-[100px]">
                                        <Wallet className="w-2.5 h-2.5 shrink-0" />
                                        {getAccountName(tx.accountId)}
                                      </span>
                                      {tx.isForgiven && (
                                        <>
                                          <span>•</span>
                                          <span className="text-rose-600 dark:text-rose-400 font-medium">คิดเป็นรายจ่ายแล้ว</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div
                                    className={`font-bold text-xs sm:text-sm text-right ${
                                      isLend
                                        ? tx.isForgiven
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-purple-600 dark:text-purple-400"
                                        : "text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {isLend ? "-" : "+"}฿
                                    {tx.amount.toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>

                                  {isLend && onToggleForgive && (
                                    tx.isForgiven ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onToggleForgive(tx)}
                                        className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-rose-600 rounded"
                                        title="ยกเลิกการยกหนี้"
                                      >
                                        <Undo2 className="w-3 h-3 mr-0.5" />
                                        <span>ยกเลิก</span>
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onToggleForgive(tx)}
                                        className="h-6 px-1.5 text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded flex items-center gap-1 font-medium"
                                        title="ยกหนี้ให้รายการนี้ (คิดเป็นรายจ่าย)"
                                      >
                                        <HeartHandshake className="w-3 h-3" />
                                        <span>ยกหนี้</span>
                                      </Button>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* Timeline Tab - Mobile Friendly */
            <div className="space-y-2">
              {lendingTxs.map((tx) => {
                const isLend = tx.type === "expense" && tx.category === "ให้ยืม";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border bg-card hover:bg-muted/20 transition-all text-xs gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isLend
                            ? tx.isForgiven
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                              : "bg-purple-500/15 text-purple-700 dark:text-purple-300"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {isLend ? (
                          tx.isForgiven ? (
                            <HeartHandshake className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          )
                        ) : (
                          <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                          <span
                            className={
                              isLend
                                ? tx.isForgiven
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-purple-600 dark:text-purple-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {tx.category}
                          </span>
                          {tx.isForgiven && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 font-medium">
                              ยกหนี้ให้แล้ว
                            </span>
                          )}
                          <span className="text-muted-foreground font-normal truncate">
                            • {tx.note || "ไม่ระบุ"}
                          </span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="w-2.5 h-2.5" />
                            {formatThaiDate(tx.date)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 truncate max-w-[120px]">
                            <Wallet className="w-2.5 h-2.5 shrink-0" />
                            {getAccountName(tx.accountId)}
                          </span>
                          {tx.isForgiven && (
                            <>
                              <span>•</span>
                              <span className="text-rose-600 dark:text-rose-400 font-medium">เป็นรายจ่าย</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div
                          className={`font-bold text-xs sm:text-sm ${
                            isLend
                              ? tx.isForgiven
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-purple-600 dark:text-purple-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isLend ? "-" : "+"}฿
                          {tx.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
                          {isLend ? (tx.isForgiven ? "ยกหนี้ให้ (รายจ่าย)" : "เงินให้ยืม") : "เงินรับคืน"}
                        </span>
                      </div>

                      {isLend && onToggleForgive && (
                        tx.isForgiven ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleForgive(tx)}
                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-rose-600 rounded"
                            title="ยกเลิกการยกหนี้"
                          >
                            <Undo2 className="w-3 h-3 mr-0.5" />
                            <span>ยกเลิก</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onToggleForgive(tx)}
                            className="h-6 px-1.5 text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded flex items-center gap-1 font-medium"
                            title="ยกหนี้ให้รายการนี้ (คิดเป็นรายจ่าย)"
                          >
                            <HeartHandshake className="w-3 h-3" />
                            <span>ยกหนี้</span>
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Forgive Person Confirmation Dialog */}
        {personToForgive && (
          <Dialog open={!!personToForgive} onOpenChange={() => setPersonToForgive(null)}>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-amber-500" />
                  <span>ยืนยันการยกหนี้ให้</span>
                </DialogTitle>
              </DialogHeader>
              <div className="py-3 space-y-3 text-xs sm:text-sm">
                <p>
                  คุณแน่ใจหรือไม่ว่าต้องการยกหนี้ให้แก่{" "}
                  <strong className="text-foreground font-bold">&quot;{personToForgive.name}&quot;</strong>?
                </p>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>ยอดหนี้ที่ยกให้:</span>
                    <span className="text-base text-amber-600 dark:text-amber-400">
                      ฿{personToForgive.balance.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    ยอดคงค้างจะถูกปรับเป็น 0 และนำยอดนี้ไปคิดเป็น <strong>รายจ่าย</strong> ในงบประมาณของคุณทันที (เงินในบัญชีจริงจะไม่ถูกหักซ้ำ)
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPersonToForgive(null)}
                  className="rounded-xl text-xs h-8"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (onForgivePerson) {
                      onForgivePerson(personToForgive.name, personToForgive.balance);
                    }
                    setPersonToForgive(null);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs h-8 gap-1.5 shadow-sm"
                >
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>ยืนยันยกหนี้ให้</span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Footer */}
        <div className="p-3 border-t bg-muted/20 flex justify-end shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl px-4 text-xs h-8"
          >
            ปิด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
