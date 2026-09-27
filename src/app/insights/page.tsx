"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import type { Transaction, UserSettings } from "@/types";
import { isLendingExpense } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, AlertTriangle, TrendingUp, TrendingDown, Lightbulb, Brain, CheckCircle2, Target } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { isSameMonth, subMonths } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";

type AlertType = 'warning' | 'success' | 'info';

const MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

interface InsightAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  icon: React.ReactNode;
}

export default function Insights() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (!user) return;

    // Fetch Transactions
    const qTxs = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((doc) => txs.push({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(txs);
      setLoadingData(false);
    });

    // Fetch Settings (Budget)
    const unsubSettings = onSnapshot(doc(db, "settings", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserSettings({ id: docSnap.id, ...docSnap.data() } as UserSettings);
      } else {
        setUserSettings(null);
      }
    });

    return () => {
      unsubTxs();
      unsubSettings();
    };
  }, [user]);

  // Aggregate Data and Generate Insights
  const { chartData, alerts, currentMonthTotal, lastMonthTotal } = useMemo(() => {
    if (transactions.length === 0) return { chartData: [], alerts: [], currentMonthTotal: 0, lastMonthTotal: 0 };

    const paydayDate = userSettings?.paydayDate || 1;
    const monthOffset = paydayDate > 15 ? -1 : 0;
    
    // Current Cycle
    const cycleStartDate = new Date(selectedYear, selectedMonth + monthOffset, paydayDate);
    const cycleEndDate = new Date(selectedYear, selectedMonth + monthOffset + 1, paydayDate - 1);
    cycleEndDate.setHours(23, 59, 59, 999);

    // Last Cycle
    const lastCycleStartDate = new Date(selectedYear, selectedMonth + monthOffset - 1, paydayDate);
    const lastCycleEndDate = new Date(selectedYear, selectedMonth + monthOffset, paydayDate - 1);
    lastCycleEndDate.setHours(23, 59, 59, 999);

    const currentMonthTxs = transactions.filter(t => {
      if (t.type !== 'expense' || isLendingExpense(t)) return false;
      const d = new Date(t.date);
      return d >= cycleStartDate && d <= cycleEndDate;
    });

    const lastMonthTxs = transactions.filter(t => {
      if (t.type !== 'expense' || isLendingExpense(t)) return false;
      const d = new Date(t.date);
      return d >= lastCycleStartDate && d <= lastCycleEndDate;
    });

    let currentTotal = 0;
    let lastTotal = 0;

    const categoryMap: Record<string, { current: number; last: number }> = {};

    currentMonthTxs.forEach(tx => {
      currentTotal += tx.amount;
      if (!categoryMap[tx.category]) categoryMap[tx.category] = { current: 0, last: 0 };
      categoryMap[tx.category].current += tx.amount;
    });

    lastMonthTxs.forEach(tx => {
      lastTotal += tx.amount;
      if (!categoryMap[tx.category]) categoryMap[tx.category] = { current: 0, last: 0 };
      categoryMap[tx.category].last += tx.amount;
    });

    // Prepare chart data
    const chartData = Object.keys(categoryMap)
      .map(cat => ({
        category: cat,
        "เดือนนี้": categoryMap[cat].current,
        "เดือนที่แล้ว": categoryMap[cat].last,
        diff: categoryMap[cat].current - categoryMap[cat].last
      }))
      .sort((a, b) => b["เดือนนี้"] - a["เดือนนี้"]); // Sort by highest spending this month

    // Generate Insights Alerts
    const newAlerts: InsightAlert[] = [];

    // Rule 1: Overall Spending
    if (lastTotal > 0) {
      const diffPercent = ((currentTotal - lastTotal) / lastTotal) * 100;
      if (diffPercent > 20) {
        newAlerts.push({
          id: 'overall_high',
          type: 'warning',
          title: 'เตือนภัย: ใช้เงินเยอะผิดปกติ!',
          message: `เดือนนี้คุณใช้จ่ายไปแล้ว ฿${currentTotal.toLocaleString()} ซึ่งสูงกว่าเดือนที่แล้วถึง ${diffPercent.toFixed(1)}% ระมัดระวังการใช้เงินด้วยนะครับ`,
          icon: <AlertTriangle className="w-5 h-5 text-rose-500" />
        });
      } else if (diffPercent < -10 && currentTotal > 0) { // If they saved money
        newAlerts.push({
          id: 'overall_low',
          type: 'success',
          title: 'เยี่ยมมาก! คุณประหยัดเงินได้ดีเยี่ยม',
          message: `คุณใช้จ่ายน้อยลง ${Math.abs(diffPercent).toFixed(1)}% เมื่อเทียบกับเดือนที่แล้ว ถือเป็นการเริ่มต้นที่ดี!`,
          icon: <Sparkles className="w-5 h-5 text-emerald-500" />
        });
      }
    } else if (currentTotal > 0 && lastTotal === 0) {
        newAlerts.push({
          id: 'welcome',
          type: 'info',
          title: 'ยินดีต้อนรับสู่เดือนแรก',
          message: `ดูเหมือนว่าเดือนที่แล้วจะยังไม่มีข้อมูล ระบบจะเริ่มเปรียบเทียบเชิงลึกได้ในเดือนถัดไปครับ!`,
          icon: <Lightbulb className="w-5 h-5 text-blue-500" />
        });
    }

    // Rule 2: Category Spikes
    chartData.forEach(item => {
      if (item["เดือนที่แล้ว"] > 0) {
        const catDiffPercent = ((item["เดือนนี้"] - item["เดือนที่แล้ว"]) / item["เดือนที่แล้ว"]) * 100;
        if (catDiffPercent > 30 && item["เดือนนี้"] > 500) { // Only alert if significant amount (> 500 thb)
          newAlerts.push({
            id: `cat_spike_${item.category}`,
            type: 'warning',
            title: `เตือนภัยหมวด: ${item.category}`,
            message: `หมวดหมู่นี้คุณใช้จ่ายพุ่งกระฉูดถึง ${catDiffPercent.toFixed(1)}% (฿${item["เดือนนี้"].toLocaleString()}) เมื่อเทียบกับเดือนที่แล้ว!`,
            icon: <TrendingUp className="w-5 h-5 text-amber-500" />
          });
        }
      }
    });

    // Rule 3: Category Savings
    chartData.forEach(item => {
        if (item["เดือนที่แล้ว"] > 0 && item["เดือนนี้"] > 0) {
          const catDiffPercent = ((item["เดือนนี้"] - item["เดือนที่แล้ว"]) / item["เดือนที่แล้ว"]) * 100;
          if (catDiffPercent < -30 && item["เดือนที่แล้ว"] > 1000) { 
            newAlerts.push({
              id: `cat_save_${item.category}`,
              type: 'success',
              title: `ทำได้ดีมากในหมวด: ${item.category}`,
              message: `คุณลดค่าใช้จ่ายหมวดนี้ลงได้ถึง ${Math.abs(catDiffPercent).toFixed(1)}% เก่งมากครับ!`,
              icon: <TrendingDown className="w-5 h-5 text-emerald-500" />
            });
          }
        }
      });

    // Default Good behavior message if no alerts
    if (newAlerts.length === 0 && currentTotal > 0) {
        newAlerts.push({
            id: 'all_good',
            type: 'success',
            title: 'พฤติกรรมการใช้จ่ายของคุณอยู่ในเกณฑ์ปกติ',
            message: `ยอดเยี่ยมมาก! การใช้จ่ายของคุณเดือนนี้ไม่มีอะไรผิดปกติหรือน่ากังวลเลย`,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          });
    }

    // Rule 4: Daily Budget (Only for current month and if budget is set)
    const today = new Date();
    const isCurrentMonth = today >= cycleStartDate && today <= cycleEndDate;
    const budget = userSettings?.monthlyBudget || 0;

    if (isCurrentMonth && budget > 0) {
      const daysInMonth = Math.round((cycleEndDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((cycleEndDate.getTime() - todayStart.getTime()) / 86400000);
      
      const remainingBudget = budget - currentTotal;

      if (remainingBudget < 0) {
        newAlerts.unshift({
          id: 'budget_exceeded',
          type: 'warning',
          title: 'เตือนภัย: ใช้เงินเกินงบเดือนนี้ไปแล้ว!',
          message: `คุณใช้เงินเกินงบที่ตั้งไว้ (฿${budget.toLocaleString()}) ไปแล้ว ฿${Math.abs(remainingBudget).toLocaleString()} พยายามงดค่าใช้จ่ายฟุ่มเฟือยด่วน`,
          icon: <AlertTriangle className="w-5 h-5 text-rose-500" />
        });
      } else if (daysLeft > 0) {
        const recommendedDaily = remainingBudget / daysLeft;
        const originalDaily = budget / daysInMonth;

        if (recommendedDaily < originalDaily * 0.8) {
          newAlerts.unshift({
            id: 'budget_tight',
            type: 'warning',
            title: 'ระวัง! คุณใช้เงินเร็วกว่าที่ตั้งเป้าไว้',
            message: `เพื่อให้เงินพอใช้ถึงสิ้นเดือน (อีก ${daysLeft} วัน) คุณควรใช้เงินไม่เกิน ฿${recommendedDaily.toLocaleString(undefined, {maximumFractionDigits: 0})}/วัน นับจากนี้`,
            icon: <Target className="w-5 h-5 text-amber-500" />
          });
        } else {
          newAlerts.unshift({
            id: 'budget_good',
            type: 'success',
            title: 'ยอดเยี่ยม! การบริหารงบประมาณอยู่ในเกณฑ์ดี',
            message: `คุณบริหารเงินได้ดีมาก ในอีก ${daysLeft} วันที่เหลือ คุณสามารถใช้เงินได้ ฿${recommendedDaily.toLocaleString(undefined, {maximumFractionDigits: 0})}/วัน`,
            icon: <Target className="w-5 h-5 text-emerald-500" />
          });
        }
      }
    }

    return { 
      chartData: chartData.slice(0, 10), // Top 10 categories
      alerts: newAlerts,
      currentMonthTotal: currentTotal,
      lastMonthTotal: lastTotal
    };
  }, [transactions, selectedMonth, selectedYear, userSettings]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const getAlertStyle = (type: AlertType) => {
      switch (type) {
          case 'warning': return 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20';
          case 'success': return 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';
          case 'info': return 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20';
      }
  }

  const getAlertTitleStyle = (type: AlertType) => {
    switch (type) {
        case 'warning': return 'text-rose-700 dark:text-rose-400';
        case 'success': return 'text-emerald-700 dark:text-emerald-400';
        case 'info': return 'text-blue-700 dark:text-blue-400';
    }
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
              <h1 className="text-base sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent flex items-center gap-1.5 sm:gap-2">
                ผู้ช่วยวิเคราะห์ <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-fuchsia-500" />
              </h1>
              <p className="text-muted-foreground text-[10px] sm:text-sm font-medium">AI Insights & Analytics</p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 items-center flex-wrap justify-end">
            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
              <SelectTrigger className="w-[75px] sm:w-[110px] h-8 sm:h-9 border shadow-sm bg-background hover:bg-muted/50 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm">
                <SelectValue placeholder="เดือน" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={i.toString()} className="rounded-lg">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger className="w-[65px] sm:w-[85px] h-8 sm:h-9 border shadow-sm bg-background hover:bg-muted/50 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm">
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

        {/* AI Alerts Section */}
        <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 text-sm sm:text-lg font-semibold">
                <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500" />
                <h2>วิเคราะห์จาก AI</h2>
            </div>

            {loadingData ? (
                <div className="space-y-2 sm:space-y-3">
                    <Skeleton className="h-20 sm:h-24 w-full rounded-xl sm:rounded-2xl" />
                    <Skeleton className="h-20 sm:h-24 w-full rounded-xl sm:rounded-2xl" />
                </div>
            ) : alerts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
                    {alerts.map(alert => (
                        <div key={alert.id} className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl border shadow-sm flex gap-2.5 sm:gap-4 items-start transition-all hover:shadow-md ${getAlertStyle(alert.type)}`}>
                            <div className="bg-background/80 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-sm shrink-0">
                                {alert.icon}
                            </div>
                            <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                                <h3 className={`font-semibold text-xs sm:text-base ${getAlertTitleStyle(alert.type)}`}>{alert.title}</h3>
                                <p className="text-[11px] sm:text-sm text-muted-foreground leading-relaxed">{alert.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Card className="border-dashed shadow-none bg-transparent rounded-xl sm:rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center p-6 sm:p-8 text-muted-foreground">
                        <Brain className="w-10 h-10 sm:w-12 sm:h-12 opacity-20 mb-2 sm:mb-3" />
                        <p className="font-medium text-sm">ยังไม่มีข้อมูลเพียงพอ</p>
                    </CardContent>
                </Card>
            )}
        </section>

        {/* Overview Stats */}
        <section className="grid grid-cols-2 gap-2 sm:gap-4">
             <Card className="bg-gradient-to-br from-background to-muted/20 shadow-sm rounded-xl sm:rounded-2xl overflow-hidden border-muted/50">
                <div className="h-0.5 sm:h-1 w-full bg-primary/20" />
                <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col gap-0.5 sm:gap-1">
                        <p className="text-[10px] sm:text-sm font-medium text-muted-foreground">เดือนนี้</p>
                        {loadingData ? <Skeleton className="h-7 sm:h-10 w-2/3 mt-1" /> : (
                            <h2 className="text-lg sm:text-3xl font-bold tracking-tight">฿{currentMonthTotal.toLocaleString(undefined, {maximumFractionDigits: 0})}</h2>
                        )}
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-background to-muted/20 shadow-sm rounded-xl sm:rounded-2xl overflow-hidden border-muted/50">
                <div className="h-0.5 sm:h-1 w-full bg-muted" />
                <CardContent className="p-3 sm:p-6">
                     <div className="flex flex-col gap-0.5 sm:gap-1">
                        <p className="text-[10px] sm:text-sm font-medium text-muted-foreground">เดือนที่แล้ว</p>
                        {loadingData ? <Skeleton className="h-7 sm:h-10 w-2/3 mt-1" /> : (
                            <h2 className="text-lg sm:text-3xl font-bold tracking-tight text-muted-foreground">฿{lastMonthTotal.toLocaleString(undefined, {maximumFractionDigits: 0})}</h2>
                        )}
                    </div>
                </CardContent>
            </Card>
        </section>

        {/* Charts Section */}
        <section>
          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-muted/50">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-base font-semibold">เปรียบเทียบรายจ่ายตามหมวดหมู่</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              {loadingData ? (
                  <Skeleton className="h-[350px] w-full" />
              ) : chartData.length > 0 ? (
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                      <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} angle={-30} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `฿${val >= 1000 ? (val/1000)+'k' : val}`} />
                      <Tooltip 
                        formatter={(value: any, name: any) => [`฿${Number(value).toLocaleString()}`, name]} 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="เดือนนี้" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="เดือนที่แล้ว" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm font-medium">
                  ไม่มีข้อมูลเปรียบเทียบ
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
