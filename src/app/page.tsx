"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, addDoc, updateDoc, getDocs, setDoc } from "firebase/firestore";
import type { Transaction, Account, UserSettings, Debt, Subscription } from "@/types";
import { EXPENSE_CATEGORY_GROUPS, EXTENDED_BANK_LISTS, isLendingExpense, isLendingIncome, isLendingTransaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, PlusCircle, LogOut, TrendingUp, TrendingDown, Wallet, MoreVertical, Edit2, Trash2, Download, CreditCard, Filter, ArrowRightLeft, Target, Calculator, Menu, BarChart2, Sparkles, MonitorPlay, Users, Clock, Eye, EyeOff, History, HeartHandshake, UserCircle } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";
import { TransactionDetailsModal } from "@/components/TransactionDetailsModal";
import { TransactionIcon } from "@/components/TransactionIcon";
import { TransactionAmount } from "@/components/TransactionAmount";
import { AccountModal } from "@/components/AccountModal";
import { BudgetModal } from "@/components/BudgetModal";
import { LendingHistoryModal } from "@/components/LendingHistoryModal";
import { ProfileModal } from "@/components/ProfileModal";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ModeToggle } from "@/components/ModeToggle";
import { format } from "date-fns";
import { formatThaiDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { LendReminderBell, LendReminderBanner } from "@/components/LendReminders";
import { computeLendReminders, describeReminder, DEFAULT_LEND_REMINDER_DAYS } from "@/lib/lendReminders";
import { getLendingIncomeExcessMap } from "@/lib/lendingIncome";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658', '#ef5350'];

type MobileChartTab = 'pie' | 'bar';
type ViewMode = 'calendar' | 'cycle';

function getCurrentCycleMonthYear(date: Date, paydayDate: number) {
  const monthOffset = paydayDate > 15 ? -1 : 0;
  const checkMonth = (y: number, m: number) => {
    const start = new Date(y, m + monthOffset, paydayDate);
    const end = new Date(y, m + monthOffset + 1, paydayDate - 1);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  };

  const y = date.getFullYear();
  const m = date.getMonth();

  if (checkMonth(y, m)) return { month: m, year: y };
  
  const prevDate = new Date(y, m - 1, 1);
  if (checkMonth(prevDate.getFullYear(), prevDate.getMonth())) {
    return { month: prevDate.getMonth(), year: prevDate.getFullYear() };
  }

  const nextDate = new Date(y, m + 1, 1);
  if (checkMonth(nextDate.getFullYear(), nextDate.getMonth())) {
    return { month: nextDate.getMonth(), year: nextDate.getFullYear() };
  }

  return { month: m, year: y }; 
}

export default function Dashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isLendingHistoryOpen, setIsLendingHistoryOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | undefined>(undefined);
  const [transactionToView, setTransactionToView] = useState<Transaction | undefined>(undefined);
  const [accountToEdit, setAccountToEdit] = useState<Account | undefined>(undefined);
  
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [loadingAccs, setLoadingAccs] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [hasSetInitialCycle, setHasSetInitialCycle] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cycle');
  
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const [tableDateFilter, setTableDateFilter] = useState<string | 'all'>('all');
  const [tableAccountFilter, setTableAccountFilter] = useState<string | 'all'>('all');
  const ITEMS_PER_PAGE = 10;
  const [hideBalance, setHideBalance] = useState<boolean>(false);
  const [mobileChartsOpen, setMobileChartsOpen] = useState(false);
  const [mobileChartTab, setMobileChartTab] = useState<MobileChartTab>('pie');

  useEffect(() => {
    const saved = localStorage.getItem('hideBalance');
    if (saved) {
      setHideBalance(saved === 'true');
    }
    const savedMode = localStorage.getItem('viewMode');
    if (savedMode === 'calendar' || savedMode === 'cycle') {
      setViewMode(savedMode as ViewMode);
    }
  }, []);

  const toggleHideBalance = () => {
    const newValue = !hideBalance;
    setHideBalance(newValue);
    localStorage.setItem('hideBalance', newValue.toString());
  };

  useEffect(() => {
    setTableDateFilter('all');
    setCurrentPage(1);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (settingsLoaded && !hasSetInitialCycle) {
      const today = new Date();
      const savedMode = localStorage.getItem('viewMode') as ViewMode | null;
      const initialMode = savedMode || 'cycle';
      const payday = initialMode === 'calendar' ? 1 : (userSettings?.paydayDate || 1);
      const cycle = getCurrentCycleMonthYear(today, payday);
      if (selectedMonth !== cycle.month || selectedYear !== cycle.year) {
        setSelectedMonth(cycle.month);
        setSelectedYear(cycle.year);
      }
      setHasSetInitialCycle(true);
    }
  }, [settingsLoaded, userSettings, hasSetInitialCycle, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!user) return;

    // Fetch Transactions
    const qTxs = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc")
    );
    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((doc) => {
        txs.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(txs);
      setLoadingTxs(false);
    }, (error) => {
      console.error("Transactions fetch error:", error);
      setLoadingTxs(false);
      toast.error("กำลังเตรียมฐานข้อมูล รายการธุรกรรมจะปรากฏขึ้นในไม่ช้า");
    });

    // Fetch Accounts
    const qAccs = query(
      collection(db, "accounts"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "asc")
    );
    const unsubAccs = onSnapshot(qAccs, (snapshot) => {
      const accs: Account[] = [];
      snapshot.forEach((doc) => {
        accs.push({ id: doc.id, ...doc.data() } as Account);
      });
      setAccounts(accs);
      setLoadingAccs(false);
    }, (error) => {
      console.error("Accounts fetch error:", error);
      setLoadingAccs(false);
      toast.error("กำลังเตรียมฐานข้อมูล บัญชีของคุณจะปรากฏขึ้นในไม่ช้า");
    });

    // Fetch Debts
    const qDebts = query(
      collection(db, "debts"),
      where("userId", "==", user.uid)
    );
    const unsubDebts = onSnapshot(qDebts, (snapshot) => {
      const d: Debt[] = [];
      snapshot.forEach((doc) => d.push({ id: doc.id, ...doc.data() } as Debt));
      setDebts(d);
    });

    // Fetch Settings (Budget)
    const unsubSettings = onSnapshot(doc(db, "settings", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserSettings({ id: docSnap.id, ...docSnap.data() } as UserSettings);
      } else {
        setUserSettings(null);
      }
      setSettingsLoaded(true);
    });

    return () => {
      unsubTxs();
      unsubAccs();
      unsubSettings();
      unsubDebts();
    };
  }, [user]);

  // Subscription Auto-Processor
  useEffect(() => {
    if (!user) return;
    
    const processSubscriptions = async () => {
      try {
        const qSubs = query(collection(db, "subscriptions"), where("userId", "==", user.uid), where("isActive", "==", true));
        const querySnapshot = await getDocs(qSubs);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        querySnapshot.forEach(async (docSnap) => {
          const sub = { id: docSnap.id, ...docSnap.data() } as Subscription;
          let nextDate = new Date(sub.nextBillingDate);
          nextDate.setHours(0, 0, 0, 0);
          
          let hasUpdates = false;
          let currentNextDate = nextDate;

          // While the nextBillingDate is today or in the past
          while (currentNextDate <= today) {
            hasUpdates = true;
            
            // Create transaction
            await addDoc(collection(db, "transactions"), {
              userId: user.uid,
              accountId: sub.accountId,
              amount: sub.amount,
              type: "expense",
              category: sub.category,
              date: currentNextDate.toISOString(),
              note: `รายจ่ายประจำ: ${sub.name}`,
              createdAt: Date.now(),
            });

            // Calculate next billing date
            if (sub.cycle === "monthly") {
              currentNextDate.setMonth(currentNextDate.getMonth() + 1);
            } else {
              currentNextDate.setFullYear(currentNextDate.getFullYear() + 1);
            }
          }

          if (hasUpdates) {
            // Update the subscription's next billing date
            await updateDoc(doc(db, "subscriptions", sub.id), {
              nextBillingDate: currentNextDate.toISOString().split("T")[0]
            });
            toast.success(`หักเงินรายจ่าย ${sub.name} อัตโนมัติ`);
          }
        });
      } catch (error) {
        console.error("Error processing subscriptions:", error);
      }
    };

    processSubscriptions();
  }, [user]);

  const actualPayday = userSettings?.paydayDate || 1;
  const paydayDate = viewMode === 'calendar' ? 1 : actualPayday;
  const monthOffset = paydayDate > 15 ? -1 : 0;
  const cycleStartDate = new Date(selectedYear, selectedMonth + monthOffset, paydayDate);
  const cycleEndDate = new Date(selectedYear, selectedMonth + monthOffset + 1, paydayDate - 1);
  cycleEndDate.setHours(23, 59, 59, 999);

  const filteredTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= cycleStartDate && d <= cycleEndDate;
  });

  const daysInMonth = Math.round((cycleEndDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));

  const transactionsForTable = filteredTransactions.filter(t => {
    if (tableDateFilter !== 'all' && format(new Date(t.date), 'yyyy-MM-dd') !== tableDateFilter) return false;
    if (tableAccountFilter !== 'all' && t.accountId !== tableAccountFilter && t.toAccountId !== tableAccountFilter) return false;
    return true;
  });

  const paginatedTransactions = transactionsForTable.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(transactionsForTable.length / ITEMS_PER_PAGE);

  // Calculate excess from lending payback transactions that exceed debt
  const lendingExcessMap = React.useMemo(() => {
    return getLendingIncomeExcessMap(transactions);
  }, [transactions]);

  // Exclude lending / payback from budget and income/expense totals,
  // except any payback excess that exceeds the debt amount (counted as income)
  const totalIncome = filteredTransactions
    .reduce((acc, t) => {
      if (t.type !== "income") return acc;
      if (!isLendingIncome(t)) return acc + t.amount;
      const excess = lendingExcessMap.get(t.id) || 0;
      return acc + excess;
    }, 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense" && !isLendingExpense(t))
    .reduce((acc, t) => acc + t.amount, 0);

  const allTimeIncome = transactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const allTimeExpense = transactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const totalInitialBalances = accounts.reduce((acc, a) => acc + a.initialBalance, 0);
  const overallBalance = Math.round((totalInitialBalances + allTimeIncome - allTimeExpense + Number.EPSILON) * 100) / 100;

  const totalOutstandingDebt = debts.reduce((sum, d) => {
    const paidTxs = transactions.filter(t => t.debtId === d.id && t.type === "expense");
    const totalPaid = paidTxs.reduce((acc, t) => acc + t.amount, 0);
    return sum + Math.max(0, d.remainingAmount - totalPaid);
  }, 0);

  const expensesByCategory = filteredTransactions
    .filter(t => t.type === 'expense' && !isLendingExpense(t))
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const pieChartData = Object.keys(expensesByCategory).map(key => ({
    name: key,
    value: expensesByCategory[key]
  })).sort((a, b) => b.value - a.value);

  // Group buckets for Net Balance calculation
  const categoryToGroup: Record<string, string> = {};
  Object.entries(EXPENSE_CATEGORY_GROUPS).forEach(([group, cats]) => {
    cats.forEach(c => categoryToGroup[c] = group);
  });

  const expensesByBucket = filteredTransactions
    .filter(t => t.type === 'expense' && !isLendingExpense(t))
    .reduce((acc, t) => {
      const group = categoryToGroup[t.category] || "รายจ่ายผันแปร";
      acc[group] = (acc[group] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const fixedExp = expensesByBucket["รายจ่ายคงที่"] || 0;
  const variableExp = expensesByBucket["รายจ่ายผันแปร"] || 0;
  const savingExp = expensesByBucket["เงินออม/เงินลงทุน"] || 0;
  const debtExp = expensesByBucket["เงินผ่อนหนี้"] || 0;
  const netBalanceMonthly = totalIncome - (fixedExp + variableExp + savingExp + debtExp);

  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(cycleStartDate);
    d.setDate(d.getDate() + i);
    return { day: d.getDate(), displayDate: formatThaiDate(d, 'd MMM'), income: 0, expense: 0 };
  });

  filteredTransactions.forEach(tx => {
    if (tx.type === "transfer") return; // Ignore transfers in charts
    const d = new Date(tx.date);
    const dayIndex = Math.floor((d.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
    if (dayIndex >= 0 && dayIndex < daysInMonth) {
      if (tx.type === "income") {
        if (!isLendingIncome(tx)) {
          dailyData[dayIndex].income += tx.amount;
        } else {
          const excess = lendingExcessMap.get(tx.id) || 0;
          if (excess > 0) {
            dailyData[dayIndex].income += excess;
          }
        }
      } else if (!isLendingExpense(tx)) {
        dailyData[dayIndex].expense += tx.amount;
      }
    }
  });

  const handleDeleteTx = async (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) {
      try {
        await deleteDoc(doc(db, "transactions", id));
        toast.success("ลบรายการเรียบร้อยแล้ว");
      } catch (error) {
        toast.error("ไม่สามารถลบรายการได้");
        console.error(error);
      }
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const hasTxs = transactions.some(t => t.accountId === id || t.toAccountId === id);
    if (hasTxs) {
      toast.error("ไม่สามารถลบบัญชีที่มีรายการธุรกรรม/โอนเงินอยู่ได้ กรุณาลบหรือย้ายรายการก่อน");
      return;
    }

    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีนี้?")) {
      try {
        await deleteDoc(doc(db, "accounts", id));
        toast.success("ลบบัญชีเรียบร้อยแล้ว");
      } catch (error) {
        toast.error("ไม่สามารถลบบัญชีได้");
        console.error(error);
      }
    }
  };

  const handleEditTx = (tx: Transaction) => {
    setTransactionToEdit(tx);
    setIsModalOpen(true);
  };

  const handleToggleForgiveDebt = async (tx: Transaction) => {
    try {
      if (tx.isForgiven) {
        await updateDoc(doc(db, "transactions", tx.id), {
          isForgiven: false,
          forgivenAt: null,
        });
        toast.success("ยกเลิกการยกหนี้แล้ว (กลับเป็นเงินให้ยืมปกติ ไม่คิดในงบ)");
      } else {
        await updateDoc(doc(db, "transactions", tx.id), {
          isForgiven: true,
          forgivenAt: Date.now(),
        });
        toast.success(`ยกหนี้ให้ ฿${tx.amount.toLocaleString()} เรียบร้อยแล้ว (คิดเป็นรายจ่าย)`);
      }
      if (transactionToView && transactionToView.id === tx.id) {
        setTransactionToView({
          ...transactionToView,
          isForgiven: !transactionToView.isForgiven,
        });
      }
    } catch (error) {
      console.error("Error toggling forgiven debt: ", error);
      toast.error("ไม่สามารถปรับสถานะการยกหนี้ได้");
    }
  };

  const handleForgivePerson = async (personName: string, remainingBalance: number) => {
    if (remainingBalance <= 0) return;
    try {
      // Find unforgiven lending transactions for this person
      const targetTxs = transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category === "ให้ยืม" &&
            (t.note?.trim() || "ไม่ระบุ") === (personName.trim() || "ไม่ระบุ") &&
            !t.isForgiven
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (targetTxs.length === 0) {
        toast.error("ไม่พบรายการให้ยืมที่คงค้างของบุคคลนี้");
        return;
      }

      let amountLeftToForgive = remainingBalance;

      for (const tx of targetTxs) {
        if (amountLeftToForgive <= 0) break;

        if (tx.amount <= amountLeftToForgive) {
          // Forgive entire transaction
          await updateDoc(doc(db, "transactions", tx.id), {
            isForgiven: true,
            forgivenAt: Date.now(),
          });
          amountLeftToForgive -= tx.amount;
        } else {
          // Partial forgiveness: split transaction
          const unforgivenPart = tx.amount - amountLeftToForgive;
          const forgivenPart = amountLeftToForgive;

          await updateDoc(doc(db, "transactions", tx.id), {
            amount: unforgivenPart,
          });

          await addDoc(collection(db, "transactions"), {
            userId: tx.userId,
            accountId: tx.accountId || null,
            toAccountId: tx.toAccountId || null,
            amount: forgivenPart,
            type: "expense",
            category: "ให้ยืม",
            date: tx.date,
            note: tx.note || "",
            createdAt: Date.now(),
            isForgiven: true,
            forgivenAt: Date.now(),
          });

          amountLeftToForgive = 0;
          break;
        }
      }

      toast.success(`ยกหนี้ให้ "${personName}" จำนวน ฿${remainingBalance.toLocaleString()} เรียบร้อยแล้ว (คิดเป็นรายจ่าย)`);
    } catch (error) {
      console.error("Error forgiving person debt: ", error);
      toast.error("เกิดข้อผิดพลาดในการยกหนี้");
    }
  };

  const handleViewTx = (tx: Transaction) => {
    setTransactionToView(tx);
    setIsViewModalOpen(true);
  };

  const handleCloseTxModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setTransactionToEdit(undefined), 300);
  };

  const handleEditAccount = (acc: Account) => {
    setAccountToEdit(acc);
    setIsAccountModalOpen(true);
  };

  const handleCloseAccountModal = () => {
    setIsAccountModalOpen(false);
    setTimeout(() => setAccountToEdit(undefined), 300);
  };

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
      toast.error("ไม่มีรายการให้ส่งออก");
      return;
    }
    const csvContent = [
      ["วันที่", "ประเภท", "จากบัญชี", "เข้าบัญชี", "หมวดหมู่", "จำนวนเงิน", "บันทึกช่วยจำ"],
      ...filteredTransactions.map(t => {
        const acc = accounts.find(a => a.id === t.accountId);
        const toAcc = accounts.find(a => a.id === t.toAccountId);
        
        let typeStr = t.type === 'income' ? 'รายรับ' : 'รายจ่าย';
        if (t.type === 'transfer') typeStr = 'โอนเงิน';

        return [
          t.date,
          typeStr,
          `"${acc ? acc.name : 'ทั่วไป'}"`,
          `"${toAcc ? toAcc.name : '-'}"`,
          t.category,
          t.amount,
          `"${t.note || ""}"`
        ];
      })
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_${selectedYear}_${selectedMonth + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("ส่งออกข้อมูลสำเร็จ");
  };

  const MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const getAccountBalance = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    
    // Income/Expense
    const accTxs = transactions.filter(t => t.accountId === accountId && t.type !== 'transfer');
    const inc = accTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = accTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    
    // Transfers
    const transfersOut = transactions.filter(t => t.type === 'transfer' && t.accountId === accountId).reduce((s, t) => s + t.amount, 0);
    const transfersIn = transactions.filter(t => t.type === 'transfer' && t.toAccountId === accountId).reduce((s, t) => s + t.amount, 0);

    const total = acc.initialBalance + inc - exp - transfersOut + transfersIn;
    return Math.round((total + Number.EPSILON) * 100) / 100;
  };

  // Budget calculations
  const budget = userSettings?.monthlyBudget || 0;
  const percentUsed = budget > 0 ? (totalExpense / budget) * 100 : 0;
  const isOverBudget = percentUsed >= 100;

  const today = new Date();
  const isCurrentMonth = today >= cycleStartDate && today <= cycleEndDate;
  
  const spentToday = isCurrentMonth 
    ? filteredTransactions
        .filter(t => {
          if (t.type !== 'expense' || isLendingExpense(t)) return false;
          const d = new Date(t.date);
          return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
        })
        .reduce((acc, t) => acc + t.amount, 0)
    : 0;

  let daysLeftIncludingToday = daysInMonth;
  if (isCurrentMonth) {
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    daysLeftIncludingToday = Math.round((cycleEndDate.getTime() - todayStart.getTime()) / 86400000);
  }

  const expenseBeforeToday = isCurrentMonth ? totalExpense - spentToday : totalExpense;
  
  const averageBudgetPerDay = isCurrentMonth 
    ? Math.max(0, (budget - expenseBeforeToday) / daysLeftIncludingToday)
    : budget / daysInMonth;

  const remainingDailyBudget = averageBudgetPerDay - spentToday;

  const daysLeftAfterToday = daysLeftIncludingToday - 1;
  const futureAverageBudget = daysLeftAfterToday > 0 
    ? Math.max(0, (budget - totalExpense) / daysLeftAfterToday) 
    : 0;

  // Outstanding Lent amounts
  const lentOutBalances: Record<string, { totalLent: number, totalReceived: number, totalForgiven: number, balance: number, latestDate: string }> = {};

  transactions.forEach(t => {
    if (t.type === 'expense' && t.category === 'ให้ยืม') {
      const key = t.note?.trim() || 'ไม่ระบุ';
      if (!lentOutBalances[key]) lentOutBalances[key] = { totalLent: 0, totalReceived: 0, totalForgiven: 0, balance: 0, latestDate: t.date };
      lentOutBalances[key].totalLent += t.amount;
      if (t.isForgiven) {
        lentOutBalances[key].totalForgiven += t.amount;
      }
      if (new Date(t.date) > new Date(lentOutBalances[key].latestDate)) {
          lentOutBalances[key].latestDate = t.date;
      }
    } else if (t.type === 'income' && t.category === 'ได้รับคืน') {
      const key = t.note?.trim() || 'ไม่ระบุ';
      if (!lentOutBalances[key]) {
          lentOutBalances[key] = { totalLent: 0, totalReceived: 0, totalForgiven: 0, balance: 0, latestDate: t.date };
      }
      lentOutBalances[key].totalReceived += t.amount;
    }
  });

  const outstandingLends = Object.entries(lentOutBalances)
    .map(([note, data]) => ({ note, ...data, balance: Math.max(0, data.totalLent - data.totalReceived - data.totalForgiven) }))
    .filter(item => item.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  // Lend reminders (แจ้งเตือนทวงเงิน)
  const lendReminderDays = userSettings?.lendReminderDays || DEFAULT_LEND_REMINDER_DAYS;
  const lendReminders = computeLendReminders(transactions, lendReminderDays);
  const reminderByNote = Object.fromEntries(lendReminders.map(r => [r.note, r]));

  const handleChangeReminderDays = async (days: number) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "settings", user.uid), { lendReminderDays: days, updatedAt: Date.now() }, { merge: true });
      toast.success(`จะเตือนทวงเมื่อค้างเกิน ${days} วัน`);
    } catch (error) {
      console.error("Error saving reminder setting:", error);
      toast.error("บันทึกการตั้งค่าไม่สำเร็จ");
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 md:pb-8 p-3 sm:p-4 md:p-8 transition-colors font-sans">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-40 py-3 -mx-3 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0 md:py-4 md:relative md:bg-transparent md:backdrop-blur-none border-b md:border-none">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 pr-2">
            <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted border overflow-hidden hover:opacity-80 transition-opacity flex-shrink-0 shadow-sm">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-4 h-4 sm:w-6 sm:h-6 text-muted-foreground" />
              )}
            </button>
            <div className="flex flex-col min-w-0 flex-1 justify-center">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <img src="/icon.svg" alt="Kebhom" className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow-sm" />
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent truncate pb-0.5">
                  Kebhom
                </h1>
              </div>
              <p className="text-muted-foreground text-[11px] sm:text-sm font-medium truncate w-full">ยินดีต้อนรับ, <span className="text-foreground">{user?.displayName || "ผู้ใช้"}</span></p>
            </div>
          </div>
          <div className="flex gap-1 items-center flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={toggleHideBalance} className="rounded-full w-8 h-8 sm:w-9 sm:h-9">
              {hideBalance ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />}
            </Button>
            <LendReminderBell
              reminders={lendReminders}
              reminderDays={lendReminderDays}
              onChangeReminderDays={handleChangeReminderDays}
              onOpenHistory={() => setIsLendingHistoryOpen(true)}
            />
            <ModeToggle />
            
            <Button onClick={() => { setAccountToEdit(undefined); setIsAccountModalOpen(true); }} variant="secondary" className="hidden sm:flex gap-2 rounded-full shadow-sm hover:shadow transition-all">
              <CreditCard className="w-4 h-4" />
              <span>เพิ่มบัญชี</span>
            </Button>
            
            <Button onClick={() => { setTransactionToEdit(undefined); setIsModalOpen(true); }} className="hidden sm:flex gap-2 rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <PlusCircle className="w-4 h-4" />
              <span>เพิ่มรายการ</span>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full w-8 h-8 sm:w-9 sm:h-9 shadow-sm hover:shadow transition-all">
                  <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="font-semibold text-muted-foreground">เมนูเพิ่มเติม</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)} className="rounded-lg cursor-pointer py-2.5">
                  <UserCircle className="w-4 h-4 mr-2 text-blue-500" />
                  <span className="font-medium text-blue-600 dark:text-blue-400">แก้ไขโปรไฟล์</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/insights")} className="rounded-lg cursor-pointer py-2.5">
                  <Sparkles className="w-4 h-4 mr-2 text-violet-500" />
                  <span className="text-violet-600 dark:text-violet-400 font-medium">ผู้ช่วยวิเคราะห์ (AI)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/reports")} className="rounded-lg cursor-pointer py-2.5">
                  <BarChart2 className="w-4 h-4 mr-2" />
                  <span>รายงานเชิงลึก</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/goals")} className="rounded-lg cursor-pointer py-2.5">
                  <Target className="w-4 h-4 mr-2" />
                  <span>เป้าหมายการออม</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/subscriptions")} className="rounded-lg cursor-pointer py-2.5">
                  <MonitorPlay className="w-4 h-4 mr-2" />
                  <span>รายจ่ายประจำ</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/debts")} className="rounded-lg cursor-pointer py-2.5">
                  <CreditCard className="w-4 h-4 mr-2" />
                  <span>จัดการหนี้สิน</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/tax")} className="rounded-lg cursor-pointer py-2.5">
                  <Calculator className="w-4 h-4 mr-2" />
                  <span>คำนวณภาษี</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsBudgetModalOpen(true)} className="rounded-lg cursor-pointer py-2.5">
                  <Target className="w-4 h-4 mr-2" />
                  <span>ตั้งงบประมาณ</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsLendingHistoryOpen(true)} className="rounded-lg cursor-pointer py-2.5">
                  <History className="w-4 h-4 mr-2" />
                  <span>ประวัติให้ยืม-คืนเงิน</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport} className="rounded-lg cursor-pointer py-2.5">
                  <Download className="w-4 h-4 mr-2" />
                  <span>ส่งออกข้อมูล (CSV)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive rounded-lg cursor-pointer py-2.5">
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>ออกจากระบบ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Floating Action Buttons (Mobile) */}
        <div className="md:hidden fixed bottom-4 right-3 z-50 flex flex-col gap-2 items-end">
          <button
            onClick={() => { setAccountToEdit(undefined); setIsAccountModalOpen(true); }}
            className="w-10 h-10 bg-secondary text-secondary-foreground rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all border"
          >
            <CreditCard className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTransactionToEdit(undefined); setIsModalOpen(true); }}
            className="w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Lend reminder banner */}
        <LendReminderBanner reminders={lendReminders} onOpenHistory={() => setIsLendingHistoryOpen(true)} />

        {/* My Accounts */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight">บัญชีของฉัน</h2>
            <Button variant="ghost" size="sm" onClick={() => setIsBudgetModalOpen(true)} className="sm:hidden text-muted-foreground h-7 px-2 text-xs">
              <Target className="w-3.5 h-3.5 mr-1" /> ตั้งงบ
            </Button>
          </div>
          
          {loadingAccs ? (
            <div className="flex gap-3 overflow-x-auto pb-3 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin]">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 sm:h-28 w-48 sm:w-64 shrink-0 rounded-xl sm:rounded-2xl" />)}
            </div>
          ) : accounts.length > 0 ? (
            <div className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-3 sm:pb-4 pt-0.5 snap-x snap-mandatory [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin]">
              {accounts.map(acc => {
                const bal = getAccountBalance(acc.id);
                return (
                  <Card key={acc.id} className="w-44 sm:w-64 shrink-0 snap-start shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group border-muted/50 rounded-xl sm:rounded-2xl cursor-pointer" onClick={() => handleEditAccount(acc)}>
                    <div className="absolute top-0 left-0 w-1 sm:w-1.5 h-full transition-all group-hover:w-2" style={{ backgroundColor: acc.color }} />
                    <CardHeader className="py-2.5 sm:py-4 px-3.5 sm:px-5 flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                      <CardTitle className="text-xs sm:text-sm font-semibold truncate flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
                        {acc.bankSymbol && EXTENDED_BANK_LISTS[acc.bankSymbol] ? (
                          <img src={EXTENDED_BANK_LISTS[acc.bankSymbol].icon} alt={EXTENDED_BANK_LISTS[acc.bankSymbol].name} className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm" />
                        ) : (
                          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                        )}
                        {acc.name}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5 sm:h-6 sm:w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditAccount(acc); }} className="rounded-lg cursor-pointer">
                            <Edit2 className="h-4 w-4 mr-2" /> แก้ไข
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc.id); }} className="text-destructive focus:text-destructive rounded-lg cursor-pointer">
                            <Trash2 className="h-4 w-4 mr-2" /> ลบ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="px-3.5 sm:px-5 pb-3 sm:pb-5">
                      <div className={`text-lg sm:text-2xl font-bold tracking-tight ${bal >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                        {hideBalance ? '฿***' : `฿${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed shadow-none bg-transparent rounded-xl sm:rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center p-6 sm:p-8 text-muted-foreground">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 opacity-50" />
                </div>
                <p className="font-medium text-sm">ยังไม่มีบัญชี</p>
                <Button variant="link" onClick={() => setIsAccountModalOpen(true)} className="mt-1 text-sm">สร้างบัญชีแรกของคุณ</Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Filter Controls & Summary Cards */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 bg-card p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border shadow-sm">
            <div className="bg-primary/10 p-1.5 sm:p-2 rounded-full text-primary shrink-0">
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
              <SelectTrigger className="w-[100px] sm:w-[130px] border-none shadow-none bg-transparent hover:bg-muted/50 rounded-full font-medium text-xs sm:text-sm h-8 sm:h-9">
                <SelectValue placeholder="เดือน" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={i.toString()} className="rounded-lg">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger className="w-[75px] sm:w-[90px] border-none shadow-none bg-transparent hover:bg-muted/50 rounded-full font-medium text-xs sm:text-sm h-8 sm:h-9">
                <SelectValue placeholder="ปี" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {YEARS.map(y => (
                  <SelectItem key={y} value={y.toString()} className="rounded-lg">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="hidden sm:flex items-center text-xs font-medium text-muted-foreground ml-2 px-3 py-1.5 bg-muted/30 rounded-full border border-muted/50">
              {viewMode === 'calendar' ? 'ปฏิทิน' : 'รอบบิล'}: {formatThaiDate(cycleStartDate, "d MMM")} - {formatThaiDate(cycleEndDate, "d MMM")}
            </div>
            
            <div className="flex-1" />

            <div className="hidden sm:flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-muted/50">
              <Button 
                variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => { setViewMode('calendar'); localStorage.setItem('viewMode', 'calendar'); }}
                className={`h-7 px-3 text-xs rounded-md ${viewMode === 'calendar' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                ปฏิทิน
              </Button>
              <Button 
                variant={viewMode === 'cycle' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => { setViewMode('cycle'); localStorage.setItem('viewMode', 'cycle'); }}
                className={`h-7 px-3 text-xs rounded-md ${viewMode === 'cycle' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                รอบบิล
              </Button>
            </div>

            <Button onClick={handleExport} variant="ghost" size="icon" className="sm:hidden w-8 h-8 rounded-full text-muted-foreground hover:text-foreground shrink-0">
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="sm:hidden flex items-center justify-between px-1 mt-2">
            <div className="text-[10px] font-medium text-muted-foreground">
              *{viewMode === 'calendar' ? 'ปฏิทิน' : 'รอบบิล'}: {formatThaiDate(cycleStartDate, "d MMM")} - {formatThaiDate(cycleEndDate, "d MMM yyyy")}
            </div>
            <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg border border-muted/50 shrink-0">
              <Button 
                variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => { setViewMode('calendar'); localStorage.setItem('viewMode', 'calendar'); }}
                className={`h-6 px-2 text-[10px] rounded-md ${viewMode === 'calendar' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                ปฏิทิน
              </Button>
              <Button 
                variant={viewMode === 'cycle' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => { setViewMode('cycle'); localStorage.setItem('viewMode', 'cycle'); }}
                className={`h-6 px-2 text-[10px] rounded-md ${viewMode === 'cycle' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                รอบบิล
              </Button>
            </div>
          </div>

          {/* Summary Cards - 2x2 on mobile, 4-col on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl sm:rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-[11px] sm:text-sm font-medium text-primary leading-tight">เงินคงเหลือ</CardTitle>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {loadingTxs || loadingAccs ? (
                  <Skeleton className="h-6 sm:h-8 w-2/3" />
                ) : (
                  <div className={`text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight ${overallBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                    {hideBalance ? '฿***' : `฿${overallBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl sm:rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-[11px] sm:text-sm font-medium text-amber-600 dark:text-amber-500 leading-tight">ยอดหนี้</CardTitle>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-500" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {loadingTxs ? (
                  <Skeleton className="h-6 sm:h-8 w-2/3" />
                ) : (
                  <div className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-500">
                    {hideBalance ? '฿***' : `฿${totalOutstandingDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl sm:rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-[11px] sm:text-sm font-medium text-emerald-600 dark:text-emerald-500 leading-tight">รายรับ</CardTitle>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {loadingTxs ? (
                  <Skeleton className="h-6 sm:h-8 w-2/3" />
                ) : (
                  <div className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500">
                    {hideBalance ? '฿***' : `+฿${totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent border-destructive/20 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl sm:rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-[11px] sm:text-sm font-medium text-destructive leading-tight">รายจ่าย</CardTitle>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                  <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {loadingTxs ? (
                  <Skeleton className="h-6 sm:h-8 w-2/3" />
                ) : (
                  <div className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight text-destructive">
                    {hideBalance ? '฿***' : `-฿${totalExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Net Balance Formula Breakdown */}
          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50 overflow-hidden bg-card/50">
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                สรุปสุทธิ (เดือนนี้)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {/* Mobile: vertical list layout */}
              <div className="flex flex-col gap-1.5 sm:hidden">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">รายรับ</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">+฿{totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-rose-600 dark:text-rose-400 font-medium">คงที่</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">-฿{fixedExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-600 dark:text-amber-400 font-medium">ผันแปร</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">-฿{variableExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">ออม/ลงทุน</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">-฿{savingExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-600 dark:text-purple-400 font-medium">จ่ายหนี้</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">-฿{debtExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="border-t pt-1.5 mt-0.5 flex items-center justify-between">
                  <span className="text-xs font-bold">สุทธิ</span>
                  <span className={`text-sm px-2.5 py-1 rounded-lg font-bold ${netBalanceMonthly >= 0 ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                    ฿{netBalanceMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              {/* Desktop: horizontal badge layout */}
              <div className="hidden sm:flex flex-wrap items-center gap-2 text-sm font-medium">
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg whitespace-nowrap">รายรับ ฿{totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-muted-foreground">-</span>
                <span className="px-2.5 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg whitespace-nowrap">คงที่ ฿{fixedExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-muted-foreground">-</span>
                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg whitespace-nowrap">ผันแปร ฿{variableExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-muted-foreground">-</span>
                <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg whitespace-nowrap">ออม/ลงทุน ฿{savingExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-muted-foreground">-</span>
                <span className="px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg whitespace-nowrap">จ่ายหนี้ ฿{debtExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-muted-foreground font-bold">=</span>
                <span className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shadow-sm ${netBalanceMonthly >= 0 ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                  สุทธิ ฿{netBalanceMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Outstanding Lends */}
          {outstandingLends.length > 0 && (
            <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50 overflow-hidden bg-card/50">
              <CardHeader className="pb-1 sm:pb-2 flex flex-row items-center justify-between space-y-0 p-3 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 text-violet-500" />
                  </div>
                  ให้ยืมที่ยังไม่ได้คืน
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsLendingHistoryOpen(true)}
                  className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground rounded-lg gap-1 sm:gap-1.5 h-7 sm:h-8 px-2 font-medium"
                >
                  <History className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">ดูประวัติทั้งหมด</span>
                  <span className="sm:hidden">ดูทั้งหมด</span>
                </Button>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                  {outstandingLends.map(lend => (
                    <div key={lend.note} className="flex justify-between items-center bg-background p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-muted/50 shadow-sm gap-2">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-xs sm:text-sm truncate">{lend.note}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-0.5 min-w-0">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                          <span className="truncate">{formatThaiDate(lend.latestDate)}</span>
                          {reminderByNote[lend.note] && (() => {
                            const r = reminderByNote[lend.note];
                            const cls = r.status === 'overdue'
                              ? 'bg-destructive/10 text-destructive'
                              : r.status === 'today'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : r.status === 'upcoming'
                                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                  : 'bg-muted text-muted-foreground';
                            return (
                              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold whitespace-nowrap ${cls}`}>
                                {r.status === 'scheduled' ? `นัด ${formatThaiDate(r.dueDate, 'd MMM')}` : describeReminder(r)}
                              </span>
                            );
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-violet-500 text-sm sm:text-base">฿{lend.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                            (ยืม {lend.totalLent.toLocaleString()} / คืน {lend.totalReceived.toLocaleString()}{lend.totalForgiven > 0 ? ` / ยกหนี้ ${lend.totalForgiven.toLocaleString()}` : ''})
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleForgivePerson(lend.note, lend.balance)}
                          className="text-[10px] sm:text-xs h-6 sm:h-7 px-1.5 sm:px-2 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md sm:rounded-lg gap-1 shrink-0"
                          title="ยกหนี้ให้ทั้งหมด (คิดเป็นรายจ่าย)"
                        >
                          <HeartHandshake className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="hidden sm:inline">ยกหนี้ให้</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Budget Progress Bar */}
          {budget > 0 && (
            <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50 overflow-hidden bg-card/50">
              <CardContent className="p-3 sm:p-6">
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">งบเดือน</p>
                      <span className="text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                        {remainingDailyBudget < 0 && isCurrentMonth 
                          ? `฿${futureAverageBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}/วัน`
                          : `฿${averageBudgetPerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}/วัน`
                        }
                      </span>
                    </div>
                    {budget > 0 && isCurrentMonth && (
                      <span className={`text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-semibold inline-block ${
                        remainingDailyBudget >= 0 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {remainingDailyBudget >= 0 
                          ? `วันนี้เหลือ ฿${remainingDailyBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}` 
                          : `เกินไป ฿${Math.abs(remainingDailyBudget).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        }
                      </span>
                    )}
                    <div className="flex items-baseline gap-1.5 sm:gap-2">
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight">฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 0 })}</h3>
                      <span className="text-xs sm:text-sm text-muted-foreground">/ ฿{budget.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className={`text-xs sm:text-sm font-bold shrink-0 ml-2 ${isOverBudget ? 'text-destructive' : percentUsed > 80 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {percentUsed.toFixed(0)}%
                  </div>
                </div>
                <Progress 
                  value={Math.min(percentUsed, 100)} 
                  className="h-2.5 sm:h-3"
                  indicatorClassName={isOverBudget ? "bg-destructive" : percentUsed > 80 ? "bg-amber-500" : "bg-emerald-500"}
                />
                {isOverBudget && (
                  <p className="text-[10px] sm:text-xs text-destructive mt-1.5 sm:mt-2 font-medium">⚠️ ใช้จ่ายเกินงบแล้ว!</p>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        {/* Charts Section - Collapsible on mobile, side-by-side on desktop */}
        <section>
          {/* Mobile: Collapsible chart with tabs */}
          <div className="lg:hidden">
            <Card className="rounded-xl shadow-sm border-muted/50 overflow-hidden">
              <button
                onClick={() => setMobileChartsOpen(!mobileChartsOpen)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
              >
                <span className="text-xs font-semibold flex items-center gap-2">
                  <BarChart2 className="w-3.5 h-3.5 text-primary" />
                  กราฟสรุป
                </span>
                <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${mobileChartsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileChartsOpen && (
                <div className="border-t">
                  {/* Tab buttons */}
                  <div className="flex border-b">
                    <button
                      onClick={() => setMobileChartTab('pie')}
                      className={`flex-1 text-[11px] font-medium py-2 transition-colors ${mobileChartTab === 'pie' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground'}`}
                    >
                      หมวดหมู่
                    </button>
                    <button
                      onClick={() => setMobileChartTab('bar')}
                      className={`flex-1 text-[11px] font-medium py-2 transition-colors ${mobileChartTab === 'bar' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground'}`}
                    >
                      รายวัน
                    </button>
                  </div>
                  <div className="p-3">
                    {mobileChartTab === 'pie' ? (
                      loadingTxs ? (
                        <Skeleton className="h-[200px] w-[200px] mx-auto rounded-full" />
                      ) : pieChartData.length > 0 ? (
                        <div className="h-[220px] w-full">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                              <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value" stroke="none">
                                {pieChartData.map((_entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: any) => `฿${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                              />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs font-medium">
                          ไม่มีรายจ่ายในเดือนนี้
                        </div>
                      )
                    ) : (
                      loadingTxs ? (
                        <Skeleton className="h-[200px] w-full" />
                      ) : filteredTransactions.length > 0 ? (
                        <div className="h-[220px] w-full">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={5} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `฿${val}`} />
                              <Tooltip 
                                formatter={(value: any, name: any) => [`฿${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2})}`, name === 'income' ? 'รายรับ' : 'รายจ่าย']} 
                                labelFormatter={(label, payload) => {
                                  if (payload && payload.length > 0) {
                                    return `วันที่ ${payload[0].payload.displayDate}`;
                                  }
                                  return `วันที่ ${label}`;
                                }}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '11px' }}
                              />
                              <Legend formatter={(value) => value === 'income' ? 'รายรับ' : 'รายจ่าย'} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                              <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={16} />
                              <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={16} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs font-medium">
                          ไม่มีข้อมูลในเดือนนี้
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Desktop: Side-by-side charts */}
          <div className="hidden lg:grid grid-cols-2 gap-6">
            <Card className="rounded-2xl shadow-sm border-muted/50">
              <CardHeader>
                <CardTitle className="text-base font-semibold">รายจ่ายแบ่งตามหมวดหมู่</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pb-6">
                {loadingTxs ? (
                  <Skeleton className="h-[250px] w-[250px] rounded-full" />
                ) : pieChartData.length > 0 ? (
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                          {pieChartData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => `฿${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm font-medium">
                    ไม่มีรายจ่ายในเดือนนี้
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-muted/50">
              <CardHeader>
                <CardTitle className="text-base font-semibold">รายงานรายวัน</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pb-6">
                {loadingTxs ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : filteredTransactions.length > 0 ? (
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `฿${val}`} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [`฿${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2})}`, name === 'income' ? 'รายรับ' : 'รายจ่าย']} 
                          labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0) {
                              return `วันที่ ${payload[0].payload.displayDate}`;
                            }
                            return `วันที่ ${label}`;
                          }}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 500 }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        />
                        <Legend formatter={(value) => value === 'income' ? 'รายรับ' : 'รายจ่าย'} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                        <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm font-medium">
                    ไม่มีข้อมูลในเดือนนี้
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Transactions List */}
        <section>
          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-muted/50 py-2.5 sm:py-3 px-3 sm:px-6 flex flex-row justify-between items-center space-y-0">
              <CardTitle className="text-sm sm:text-base font-semibold">ธุรกรรมล่าสุด</CardTitle>
              <div className="flex items-center gap-1.5 sm:gap-2">
              <Select value={tableAccountFilter} onValueChange={(val) => { setTableAccountFilter(val); setCurrentPage(1); }}>
                <SelectTrigger className="w-[100px] sm:w-[140px] h-7 sm:h-8 text-[10px] sm:text-xs border border-muted/50 shadow-sm bg-background hover:bg-muted/50 rounded-full font-medium">
                  <SelectValue placeholder="บัญชี" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-[250px]">
                  <SelectItem value="all" className="rounded-lg text-xs">ทุกบัญชี</SelectItem>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id} className="rounded-lg text-xs">
                      <div className="flex items-center gap-1.5">
                        {acc.bankSymbol && EXTENDED_BANK_LISTS[acc.bankSymbol] ? (
                          <img src={EXTENDED_BANK_LISTS[acc.bankSymbol].icon} alt={EXTENDED_BANK_LISTS[acc.bankSymbol].name} className="w-3.5 h-3.5 rounded-sm" />
                        ) : (
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                        )}
                        <span className="truncate max-w-[90px]">{acc.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tableDateFilter} onValueChange={(val) => { setTableDateFilter(val); setCurrentPage(1); }}>
                <SelectTrigger className="w-[100px] sm:w-[125px] h-7 sm:h-8 text-[10px] sm:text-xs border border-muted/50 shadow-sm bg-background hover:bg-muted/50 rounded-full font-medium">
                  <SelectValue placeholder="วันที่" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-[200px]">
                  <SelectItem value="all" className="rounded-lg text-xs">ทั้งหมด (รอบนี้)</SelectItem>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = new Date(cycleStartDate);
                    d.setDate(d.getDate() + i);
                    return (
                      <SelectItem key={i} value={format(d, 'yyyy-MM-dd')} className="rounded-lg text-xs">
                        {formatThaiDate(d, 'd MMM')}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTxs ? (
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-14 sm:h-16 w-full rounded-lg sm:rounded-xl" />
                  ))}
                </div>
              ) : transactionsForTable.length > 0 ? (
                <div className="divide-y divide-muted/50">
                  {paginatedTransactions.map((tx) => {
                    const acc = accounts.find(a => a.id === tx.accountId);
                    const toAcc = accounts.find(a => a.id === tx.toAccountId);
                    const isIncome = tx.type === 'income';
                    const isTransfer = tx.type === 'transfer';
                    
                    return (
                      <div 
                        key={tx.id} 
                        onClick={() => handleViewTx(tx)}
                        className="group flex justify-between items-center p-2.5 sm:p-4 sm:px-6 hover:bg-muted/30 transition-colors duration-200 relative gap-2 sm:gap-4 cursor-pointer"
                      >
                        {acc && <div className="absolute top-0 left-0 w-0.5 sm:w-1 h-full" style={{ backgroundColor: isTransfer ? '#3b82f6' : acc.color }} />}
                        
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 pl-1 sm:pl-2">
                          <TransactionIcon 
                            transaction={tx} 
                            className="w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm" 
                            iconClassName="w-3.5 h-3.5 sm:w-4 sm:h-4" 
                          />
                          
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-semibold text-foreground tracking-tight truncate text-xs sm:text-sm">
                              {isTransfer ? 'โอนเงิน' : ((tx.category === 'ให้ยืม' || tx.category === 'ได้รับคืน') && tx.note) ? `${tx.category}: ${tx.note}` : tx.category}
                            </span>
                            {/* Mobile: simplified subtitle */}
                            <div className="flex items-center gap-1.5 mt-0.5 min-w-0 sm:hidden">
                              <span className="text-[10px] text-muted-foreground font-medium truncate">
                                {formatThaiDate(tx.date, "d MMM HH:mm")}
                              </span>
                              {isTransfer ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-medium truncate max-w-[80px]">
                                  {acc?.name}→{toAcc?.name}
                                </span>
                              ) : acc ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium truncate max-w-[60px]">
                                  {acc.name}
                                </span>
                              ) : null}
                              {tx.category === 'ให้ยืม' && tx.isForgiven && (
                                <HeartHandshake className="w-3 h-3 text-rose-500 shrink-0" />
                              )}
                              {isLendingTransaction(tx) && !tx.isForgiven && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300">ไม่นับงบ</span>
                              )}
                            </div>
                            {/* Desktop: full detail subtitle */}
                            <div className="hidden sm:flex items-center gap-2 mt-0.5 flex-wrap min-w-0">
                              {isTransfer ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium truncate max-w-[200px]">
                                  {acc?.name} ➡️ {toAcc?.name}
                                </span>
                              ) : acc ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-background border text-muted-foreground font-medium truncate max-w-[100px]">
                                  {acc.name}
                                </span>
                              ) : null}
                              {tx.category === 'ให้ยืม' && tx.isForgiven ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1">
                                  <HeartHandshake className="w-3 h-3" />
                                  ยกหนี้ให้แล้ว (เป็นรายจ่าย)
                                </span>
                              ) : isLendingTransaction(tx) ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-medium">
                                  ไม่นับในงบ
                                </span>
                              ) : null}
                              <span className="text-xs text-muted-foreground font-medium truncate flex-1 min-w-0">
                                {formatThaiDate(tx.date, "d MMM yyyy HH:mm")} {tx.note && `• ${tx.note}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                          <div className="flex flex-col items-end">
                            <TransactionAmount 
                              transaction={tx} 
                              className="text-xs sm:text-base"
                              minimumFractionDigits={2}
                              maximumFractionDigits={2}
                            />
                            {isLendingTransaction(tx) && (
                              <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                                {tx.category === 'ให้ยืม' ? 'ให้ยืม' : 'รับคืน'}
                              </span>
                            )}
                          </div>
                          
                          {/* Dropdown menu (Desktop & Mobile) */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()} 
                                className="h-9 w-9 sm:h-8 sm:w-8 rounded-full text-muted-foreground hover:text-foreground flex shrink-0"
                              >
                                <MoreVertical className="h-5 w-5 sm:h-4 sm:w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              {tx.category === 'ให้ยืม' && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleForgiveDebt(tx);
                                  }}
                                  className="rounded-lg cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600"
                                >
                                  <HeartHandshake className="h-4 w-4 mr-2" />
                                  {tx.isForgiven ? "ยกเลิกการยกหนี้" : "ยกหนี้ให้ (คิดเป็นรายจ่าย)"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditTx(tx); }} className="rounded-lg cursor-pointer">
                                <Edit2 className="h-4 w-4 mr-2" /> แก้ไข
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteTx(tx.id); }} className="text-destructive focus:text-destructive rounded-lg cursor-pointer">
                                <Trash2 className="h-4 w-4 mr-2" /> ลบ
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-3 sm:gap-4 py-3 sm:py-4 bg-muted/10">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-full hover:bg-muted/50 h-7 sm:h-8 text-xs sm:text-sm px-3">ก่อนหน้า</Button>
                      <span className="text-xs sm:text-sm font-medium text-muted-foreground">{currentPage}/{totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-full hover:bg-muted/50 h-7 sm:h-8 text-xs sm:text-sm px-3">ถัดไป</Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12 text-muted-foreground flex flex-col items-center px-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center mb-3 sm:mb-4">
                    <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 opacity-40" />
                  </div>
                  <p className="mb-1 sm:mb-2 font-medium text-foreground text-sm sm:text-base">ไม่พบรายการใน{tableDateFilter === 'all' ? 'รอบนี้' : `วันที่ ${formatThaiDate(new Date(tableDateFilter), 'd MMM')}`}{tableAccountFilter !== 'all' && ` (บัญชี ${accounts.find(a => a.id === tableAccountFilter)?.name ?? ''})`}</p>
                  <p className="text-xs sm:text-sm">เพิ่มรายการแรกเพื่อเริ่มติดตามการใช้จ่าย</p>
                  {accounts.length === 0 && (
                    <p className="text-xs sm:text-sm text-destructive mt-2">กรุณาสร้างบัญชีก่อนเพิ่มรายการ</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

        <TransactionModal
          isOpen={isModalOpen}
          onClose={handleCloseTxModal}
          existingTransaction={transactionToEdit}
          accounts={accounts}
        />
        
        <TransactionDetailsModal
          isOpen={isViewModalOpen}
          onClose={() => { setIsViewModalOpen(false); setTimeout(() => setTransactionToView(undefined), 300); }}
          transaction={transactionToView}
          accounts={accounts}
          onToggleForgive={handleToggleForgiveDebt}
        />

        <AccountModal
          isOpen={isAccountModalOpen}
          onClose={handleCloseAccountModal}
          existingAccount={accountToEdit}
          currentBalance={accountToEdit ? getAccountBalance(accountToEdit.id) : undefined}
          onDelete={handleDeleteAccount}
        />

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        currentBudget={userSettings?.monthlyBudget || 0}
        currentPayday={userSettings?.paydayDate || 1}
      />

      <LendingHistoryModal
        isOpen={isLendingHistoryOpen}
        onClose={() => setIsLendingHistoryOpen(false)}
        transactions={transactions}
        accounts={accounts}
        onToggleForgive={handleToggleForgiveDebt}
        onForgivePerson={handleForgivePerson}
      />

      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </div>
  );
};
