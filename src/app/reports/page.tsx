"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Transaction, Account } from "@/types";
import { EXPENSE_CATEGORY_GROUPS, isLendingExpense, isLendingIncome, isLendingTransaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, Calendar, PieChart as PieChartIcon, Target, Users, Clock } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subMonths, isAfter, isBefore, startOfMonth, endOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { formatThaiDate } from "@/lib/utils";

const MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

export default function Reports() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"yearly" | "monthly">("yearly");

  useEffect(() => {
    if (!user) return;

    // Fetch Transactions
    const qTxs = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((doc) => txs.push({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(txs);
      
      // Assume accounts load fast enough or use separate loading state if needed.
      // For simplicity, stopping loading here.
      setLoadingData(false);
    });

    const qAccs = query(collection(db, "accounts"), where("userId", "==", user.uid));
    const unsubAccs = onSnapshot(qAccs, (snapshot) => {
      const accs: Account[] = [];
      snapshot.forEach((doc) => accs.push({ id: doc.id, ...doc.data() } as Account));
      setAccounts(accs);
    });

    return () => {
      unsubTxs();
      unsubAccs();
    };
  }, [user]);

  // Aggregate Data
  const { yearlyData, topExpenses, totalYearIncome, totalYearExpense, groupMap, sortedIncomeCategories, sortedExpenseCategories } = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i],
      income: 0,
      expense: 0,
      balance: 0,
      monthIndex: i
    }));

    const incomeCategoryMap: Record<string, number> = {};
    const expenseCategoryMap: Record<string, number> = {};
    const groupMap: Record<string, number> = {
      "รายจ่ายคงที่": 0,
      "รายจ่ายผันแปร": 0,
      "เงินออม/เงินลงทุน": 0,
      "เงินผ่อนหนี้": 0
    };
    
    const categoryToGroup: Record<string, string> = {};
    Object.entries(EXPENSE_CATEGORY_GROUPS).forEach(([group, cats]) => {
      cats.forEach(c => categoryToGroup[c] = group);
    });

    let periodIncome = 0;
    let periodExpense = 0;

    transactions.forEach(tx => {
      const date = new Date(tx.date);
      
      const isMatch = viewMode === 'yearly' 
        ? date.getFullYear() === selectedYear 
        : date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;

      if (isMatch && tx.type !== "transfer" && !isLendingTransaction(tx)) {
        if (tx.type === "income") {
          periodIncome += tx.amount;
          incomeCategoryMap[tx.category] = (incomeCategoryMap[tx.category] || 0) + tx.amount;
        } else if (tx.type === "expense") {
          periodExpense += tx.amount;
          expenseCategoryMap[tx.category] = (expenseCategoryMap[tx.category] || 0) + tx.amount;
          
          const group = categoryToGroup[tx.category] || "รายจ่ายผันแปร";
          groupMap[group] += tx.amount;
        }
      }

      if (date.getFullYear() === selectedYear && tx.type !== "transfer" && !isLendingTransaction(tx)) {
        const m = date.getMonth();
        if (tx.type === "income") data[m].income += tx.amount;
        if (tx.type === "expense") data[m].expense += tx.amount;
      }
    });

    // Calculate balance per month
    data.forEach(d => {
      d.balance = d.income - d.expense;
    });

    const sortedIncomeCategories = Object.keys(incomeCategoryMap)
      .map(cat => ({ name: cat, value: incomeCategoryMap[cat] }))
      .sort((a, b) => b.value - a.value);

    const sortedExpenseCategories = Object.keys(expenseCategoryMap)
      .map(cat => ({ name: cat, value: expenseCategoryMap[cat] }))
      .sort((a, b) => b.value - a.value);

    return { 
      yearlyData: data, 
      topExpenses: sortedExpenseCategories.slice(0, 5),
      totalYearIncome: periodIncome,
      totalYearExpense: periodExpense,
      groupMap,
      sortedIncomeCategories,
      sortedExpenseCategories
    };
  }, [transactions, selectedYear, selectedMonth, viewMode]);

  const outstandingLends = useMemo(() => {
    const lentOutBalances: Record<string, { totalLent: number, totalReceived: number, balance: number, latestDate: string }> = {};

    transactions.forEach(t => {
      if (t.type === 'expense' && t.category === 'ให้ยืม') {
        const key = t.note?.trim() || 'ไม่ระบุ';
        if (!lentOutBalances[key]) lentOutBalances[key] = { totalLent: 0, totalReceived: 0, balance: 0, latestDate: t.date };
        lentOutBalances[key].totalLent += t.amount;
        if (new Date(t.date) > new Date(lentOutBalances[key].latestDate)) {
            lentOutBalances[key].latestDate = t.date;
        }
      } else if (t.type === 'income' && t.category === 'ได้รับคืน') {
        const key = t.note?.trim() || 'ไม่ระบุ';
        if (!lentOutBalances[key]) {
            lentOutBalances[key] = { totalLent: 0, totalReceived: 0, balance: 0, latestDate: t.date };
        }
        lentOutBalances[key].totalReceived += t.amount;
      }
    });

    return Object.entries(lentOutBalances)
      .map(([note, data]) => ({ note, ...data, balance: data.totalLent - data.totalReceived }))
      .filter(item => item.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [transactions]);

  const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 md:pb-8 p-3 sm:p-4 md:p-8 transition-colors font-sans">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-40 py-3 -mx-3 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0 md:py-4 md:relative md:bg-transparent md:backdrop-blur-none border-b md:border-none">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="rounded-full w-8 h-8 sm:w-9 sm:h-9">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="flex flex-col">
              <h1 className="text-base sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                รายงานเชิงลึก
              </h1>
              <p className="text-muted-foreground text-[10px] sm:text-sm font-medium">ภาพรวมรายปีและการวิเคราะห์</p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 items-center flex-wrap justify-end">
            <div className="hidden sm:flex bg-muted/50 p-1 rounded-xl mr-1">
              <Button size="sm" variant={viewMode === 'monthly' ? 'default' : 'ghost'} onClick={() => setViewMode('monthly')} className="rounded-lg h-8 text-xs font-medium">รายเดือน</Button>
              <Button size="sm" variant={viewMode === 'yearly' ? 'default' : 'ghost'} onClick={() => setViewMode('yearly')} className="rounded-lg h-8 text-xs font-medium">รายปี</Button>
            </div>
            {/* Mobile view mode toggle */}
            <div className="flex sm:hidden bg-muted/50 p-0.5 rounded-lg">
              <Button size="sm" variant={viewMode === 'monthly' ? 'default' : 'ghost'} onClick={() => setViewMode('monthly')} className="rounded-md h-7 text-[10px] px-2 font-medium">เดือน</Button>
              <Button size="sm" variant={viewMode === 'yearly' ? 'default' : 'ghost'} onClick={() => setViewMode('yearly')} className="rounded-md h-7 text-[10px] px-2 font-medium">ปี</Button>
            </div>
            
            {viewMode === 'monthly' && (
              <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                <SelectTrigger className="w-[70px] sm:w-[90px] border shadow-sm bg-card hover:bg-muted/50 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm h-8 sm:h-9">
                  <SelectValue placeholder="เดือน" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={i.toString()} className="rounded-lg">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger className="w-[65px] sm:w-[90px] border shadow-sm bg-card hover:bg-muted/50 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm h-8 sm:h-9">
                <SelectValue placeholder="ปี" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {YEARS.map(y => (
                  <SelectItem key={y} value={y.toString()} className="rounded-lg">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ModeToggle />
          </div>
        </header>

        {/* Summary Cards */}
        <section className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 shadow-sm rounded-xl sm:rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-[10px] sm:text-sm font-medium text-emerald-600 dark:text-emerald-500 leading-tight">รายรับ</CardTitle>
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-500" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {loadingData ? <Skeleton className="h-6 sm:h-8 w-2/3" /> : (
                <div className="text-sm sm:text-2xl lg:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500">
                  +฿{totalYearIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent border-destructive/20 shadow-sm rounded-xl sm:rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-[10px] sm:text-sm font-medium text-destructive leading-tight">รายจ่าย</CardTitle>
              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {loadingData ? <Skeleton className="h-6 sm:h-8 w-2/3" /> : (
                <div className="text-sm sm:text-2xl lg:text-3xl font-bold tracking-tight text-destructive">
                  -฿{totalYearExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-sm rounded-xl sm:rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-[10px] sm:text-sm font-medium text-primary leading-tight">สุทธิ</CardTitle>
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {loadingData ? <Skeleton className="h-6 sm:h-8 w-2/3" /> : (
                <div className={`text-sm sm:text-2xl lg:text-3xl font-bold tracking-tight ${totalYearIncome - totalYearExpense >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                  ฿{(totalYearIncome - totalYearExpense).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Net Balance Formula Breakdown */}
        <section>
          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50 overflow-hidden bg-card/50">
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                สรุปสุทธิ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {loadingData ? <Skeleton className="h-10 w-full" /> : (
                <>
                  {/* Mobile: vertical list */}
                  <div className="flex flex-col gap-1.5 sm:hidden">
                    <div className="flex justify-between text-xs"><span className="text-emerald-600 dark:text-emerald-400 font-medium">รายรับ</span><span className="font-semibold text-emerald-600 dark:text-emerald-400">+฿{totalYearIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-rose-600 dark:text-rose-400 font-medium">คงที่</span><span className="font-semibold text-rose-600 dark:text-rose-400">-฿{groupMap["รายจ่ายคงที่"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-amber-600 dark:text-amber-400 font-medium">ผันแปร</span><span className="font-semibold text-amber-600 dark:text-amber-400">-฿{groupMap["รายจ่ายผันแปร"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-blue-600 dark:text-blue-400 font-medium">ออม/ลงทุน</span><span className="font-semibold text-blue-600 dark:text-blue-400">-฿{groupMap["เงินออม/เงินลงทุน"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-purple-600 dark:text-purple-400 font-medium">ผ่อนหนี้</span><span className="font-semibold text-purple-600 dark:text-purple-400">-฿{groupMap["เงินผ่อนหนี้"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                    <div className="border-t pt-1.5 mt-0.5 flex justify-between"><span className="text-xs font-bold">สุทธิ</span><span className={`text-sm px-2.5 py-1 rounded-lg font-bold ${(totalYearIncome - totalYearExpense) >= 0 ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>฿{(totalYearIncome - totalYearExpense).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                  </div>
                  {/* Desktop: horizontal badges */}
                  <div className="hidden sm:flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg whitespace-nowrap">รายรับ ฿{totalYearIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="px-2.5 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg whitespace-nowrap">คงที่ ฿{groupMap["รายจ่ายคงที่"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg whitespace-nowrap">ผันแปร ฿{groupMap["รายจ่ายผันแปร"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg whitespace-nowrap">ออม/ลงทุน ฿{groupMap["เงินออม/เงินลงทุน"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg whitespace-nowrap">ผ่อนหนี้ ฿{groupMap["เงินผ่อนหนี้"].toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="text-muted-foreground font-bold">=</span>
                    <span className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shadow-sm ${(totalYearIncome - totalYearExpense) >= 0 ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                      สุทธิ ฿{(totalYearIncome - totalYearExpense).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Outstanding Lends Section */}
        {outstandingLends.length > 0 && (
          <section>
            <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50 overflow-hidden bg-card/50">
              <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 text-violet-500" />
                  </div>
                  ให้ยืมคงค้าง
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {outstandingLends.map(lend => (
                    <div key={lend.note} className="flex justify-between items-center bg-background p-2.5 sm:p-4 rounded-lg sm:rounded-xl border border-muted/50 shadow-sm gap-2">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-xs sm:text-sm truncate">{lend.note}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" /> <span className="truncate">{formatThaiDate(lend.latestDate)}</span>
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="font-bold text-violet-500 text-sm sm:text-base">฿{lend.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                          (ยืม {lend.totalLent.toLocaleString()} / คืน {lend.totalReceived.toLocaleString()})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Charts Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
          {/* Yearly Overview Bar Chart */}
          <Card className="lg:col-span-2 rounded-xl sm:rounded-2xl shadow-sm border-muted/50">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-base font-semibold">สรุปรายรับ - รายจ่ายรายปี</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              {loadingData ? <Skeleton className="h-[200px] sm:h-[300px] w-full" /> : (
                <div className="h-[200px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `฿${val >= 1000 ? (val/1000)+'k' : val}`} />
                      <Tooltip 
                        formatter={(value: any, name: any) => [`฿${Number(value).toLocaleString()}`, name === 'income' ? 'รายรับ' : 'รายจ่าย']} 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                      />
                      <Legend formatter={(value) => value === 'income' ? 'รายรับ' : 'รายจ่าย'} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Expenses */}
          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50 flex flex-col">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                Top 5 รายจ่าย
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {loadingData ? (
                <div className="space-y-4">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : topExpenses.length > 0 ? (
                <div className="space-y-4">
                  {topExpenses.map((expense, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium truncate">{expense.name}</span>
                        <span className="font-bold text-destructive">฿{expense.value.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-destructive/80 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${(expense.value / totalYearExpense) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <PieChartIcon className="w-12 h-12 opacity-20 mb-2" />
                  <p>ไม่มีข้อมูลรายจ่ายในปีนี้</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cashflow Line Chart */}
          <Card className="lg:col-span-3 rounded-xl sm:rounded-2xl shadow-sm border-muted/50">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                กระแสเงินสด
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              {loadingData ? <Skeleton className="h-[200px] sm:h-[300px] w-full" /> : (
                <div className="h-[200px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `฿${val >= 1000 ? (val/1000)+'k' : val}`} />
                      <Tooltip 
                        formatter={(value: any) => [`฿${Number(value).toLocaleString()}`, 'เงินคงเหลือ (รายเดือน)']} 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Category Breakdowns */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-base font-semibold text-emerald-600 dark:text-emerald-500">รายรับตามหมวดหมู่</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {loadingData ? <Skeleton className="h-[200px] w-full" /> : sortedIncomeCategories.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {sortedIncomeCategories.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-medium truncate">{item.name}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-500">+฿{item.value.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                      </div>
                      <div className="w-full bg-muted/50 rounded-full h-1.5 sm:h-2 overflow-hidden">
                        <div 
                          className="bg-emerald-500/80 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${totalYearIncome > 0 ? (item.value / totalYearIncome) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-muted-foreground text-sm">
                  <p>ไม่มีรายรับใน{viewMode === 'yearly' ? 'ปี' : 'เดือน'}นี้</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-base font-semibold text-destructive">รายจ่ายตามหมวดหมู่</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {loadingData ? <Skeleton className="h-[200px] w-full" /> : sortedExpenseCategories.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {sortedExpenseCategories.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-medium truncate">{item.name}</span>
                        <span className="font-bold text-destructive">-฿{item.value.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                      </div>
                      <div className="w-full bg-muted/50 rounded-full h-1.5 sm:h-2 overflow-hidden">
                        <div 
                          className="bg-destructive/80 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${totalYearExpense > 0 ? (item.value / totalYearExpense) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-muted-foreground text-sm">
                  <p>ไม่มีรายจ่ายใน{viewMode === 'yearly' ? 'ปี' : 'เดือน'}นี้</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
