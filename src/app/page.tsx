"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import type { Transaction, Account, UserSettings } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, PlusCircle, LogOut, TrendingUp, TrendingDown, Wallet, MoreVertical, Edit2, Trash2, Download, CreditCard, Filter, ArrowRightLeft, Target, Calculator, Menu } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";
import { AccountModal } from "@/components/AccountModal";
import { BudgetModal } from "@/components/BudgetModal";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ModeToggle } from "@/components/ModeToggle";
import { format } from "date-fns";
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658', '#ef5350'];

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
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | undefined>(undefined);
  const [accountToEdit, setAccountToEdit] = useState<Account | undefined>(undefined);
  
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [loadingAccs, setLoadingAccs] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

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
      unsubAccs();
      unsubSettings();
    };
  }, [user]);

  const filteredTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  const allTimeIncome = transactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const allTimeExpense = transactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const totalInitialBalances = accounts.reduce((acc, a) => acc + a.initialBalance, 0);
  const overallBalance = totalInitialBalances + allTimeIncome - allTimeExpense;

  const expensesByCategory = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const pieChartData = Object.keys(expensesByCategory).map(key => ({
    name: key,
    value: expensesByCategory[key]
  })).sort((a, b) => b.value - a.value);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    return { day: i + 1, income: 0, expense: 0 };
  });

  filteredTransactions.forEach(tx => {
    if (tx.type === "transfer") return; // Ignore transfers in charts
    const d = new Date(tx.date).getDate();
    if (tx.type === "income") {
      dailyData[d - 1].income += tx.amount;
    } else {
      dailyData[d - 1].expense += tx.amount;
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

    return acc.initialBalance + inc - exp - transfersOut + transfersIn;
  };

  // Budget calculations
  const budget = userSettings?.monthlyBudget || 0;
  const percentUsed = budget > 0 ? (totalExpense / budget) * 100 : 0;
  const isOverBudget = percentUsed >= 100;

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 md:pb-8 p-4 md:p-8 transition-colors font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-40 py-4 -mx-4 px-4 md:mx-0 md:px-0 md:relative md:bg-transparent md:backdrop-blur-none border-b md:border-none">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">ภาพรวม</h1>
            <p className="text-muted-foreground text-sm font-medium">ยินดีต้อนรับ, <span className="text-foreground">{user?.displayName || "ผู้ใช้"}</span></p>
          </div>
          <div className="flex gap-2 items-center">
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
                <Button variant="outline" size="icon" className="rounded-full shadow-sm hover:shadow transition-all ml-1">
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="font-semibold text-muted-foreground">เมนูเพิ่มเติม</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/tax")} className="rounded-lg cursor-pointer py-2.5">
                  <Calculator className="w-4 h-4 mr-2" />
                  <span>คำนวณภาษี</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsBudgetModalOpen(true)} className="rounded-lg cursor-pointer py-2.5">
                  <Target className="w-4 h-4 mr-2" />
                  <span>ตั้งงบประมาณ</span>
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

        {/* Floating Action Button (FAB) for Mobile */}
        <button
          onClick={() => { setTransactionToEdit(undefined); setIsModalOpen(true); }}
          className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* My Accounts */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">บัญชีของฉัน</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsBudgetModalOpen(true)} className="sm:hidden text-muted-foreground h-8 px-2">
                <Target className="w-4 h-4 mr-1" /> ตั้งงบ
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsAccountModalOpen(true)} className="sm:hidden text-primary h-8 px-2">
                <Plus className="w-4 h-4 mr-1" /> เพิ่มบัญชี
              </Button>
            </div>
          </div>
          
          {loadingAccs ? (
            <div className="flex gap-4 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-64 shrink-0 rounded-2xl" />)}
            </div>
          ) : accounts.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1 -mx-1">
              {accounts.map(acc => {
                const bal = getAccountBalance(acc.id);
                return (
                  <Card key={acc.id} className="w-64 shrink-0 snap-start shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group border-muted/50 rounded-2xl cursor-pointer" onClick={() => handleEditAccount(acc)}>
                    <div className="absolute top-0 left-0 w-1.5 h-full transition-all group-hover:w-2" style={{ backgroundColor: acc.color }} />
                    <CardHeader className="py-4 px-5 flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-semibold truncate flex items-center gap-2 text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                        {acc.name}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
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
                    <CardContent className="px-5 pb-5">
                      <div className={`text-2xl font-bold tracking-tight ${bal >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                        ฿{bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed shadow-none bg-transparent rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <CreditCard className="w-6 h-6 opacity-50" />
                </div>
                <p className="font-medium">ยังไม่มีบัญชี</p>
                <Button variant="link" onClick={() => setIsAccountModalOpen(true)} className="mt-1">สร้างบัญชีแรกของคุณ</Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Filter Controls & Summary Cards */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between bg-card p-2 rounded-2xl border shadow-sm">
            <div className="flex gap-2 items-center flex-1">
              <div className="bg-primary/10 p-2 rounded-full text-primary">
                <Filter className="w-4 h-4" />
              </div>
              <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                <SelectTrigger className="w-[130px] border-none shadow-none bg-transparent hover:bg-muted/50 rounded-full font-medium">
                  <SelectValue placeholder="เดือน" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={i.toString()} className="rounded-lg">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                <SelectTrigger className="w-[90px] border-none shadow-none bg-transparent hover:bg-muted/50 rounded-full font-medium">
                  <SelectValue placeholder="ปี" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {YEARS.map(y => (
                    <SelectItem key={y} value={y.toString()} className="rounded-lg">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={handleExport} variant="ghost" size="sm" className="sm:hidden w-full flex justify-center gap-2 rounded-full text-muted-foreground hover:text-foreground">
              <Download className="w-4 h-4" /> ส่งออกข้อมูล
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">ยอดเงินคงเหลือรวม</CardTitle>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                {loadingTxs || loadingAccs ? (
                  <Skeleton className="h-8 w-1/2" />
                ) : (
                  <div className={`text-3xl font-bold tracking-tight ${overallBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                    ฿{overallBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-500">รายรับ (เดือนนี้)</CardTitle>
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent>
                {loadingTxs ? (
                  <Skeleton className="h-8 w-1/2" />
                ) : (
                  <div className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500">
                    +฿{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent border-destructive/20 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-destructive">รายจ่าย (เดือนนี้)</CardTitle>
                <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                {loadingTxs ? (
                  <Skeleton className="h-8 w-1/2" />
                ) : (
                  <div className="text-3xl font-bold tracking-tight text-destructive">
                    -฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Budget Progress Bar */}
          {budget > 0 && (
            <Card className="rounded-2xl shadow-sm border-muted/50 overflow-hidden bg-card/50">
              <CardContent className="p-4 sm:p-6">
                <div className="flex justify-between items-end mb-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      งบประมาณรายเดือน
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                        เฉลี่ยไม่เกิน ฿{(budget / daysInMonth).toLocaleString(undefined, { maximumFractionDigits: 0 })}/วัน
                      </span>
                    </p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl font-bold tracking-tight">฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 0 })}</h3>
                      <span className="text-sm text-muted-foreground">/ ฿{budget.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className={`text-sm font-bold ${isOverBudget ? 'text-destructive' : percentUsed > 80 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {percentUsed.toFixed(1)}%
                  </div>
                </div>
                <Progress 
                  value={Math.min(percentUsed, 100)} 
                  className="h-3"
                  indicatorClassName={isOverBudget ? "bg-destructive" : percentUsed > 80 ? "bg-amber-500" : "bg-emerald-500"}
                />
                {isOverBudget && (
                  <p className="text-xs text-destructive mt-2 font-medium">⚠️ คุณใช้จ่ายเกินงบประมาณที่ตั้งไว้แล้ว!</p>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        {/* Charts Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <Card className="rounded-2xl shadow-sm border-muted/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold">รายจ่ายแบ่งตามหมวดหมู่</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              {loadingTxs ? (
                <Skeleton className="h-[250px] w-[250px] rounded-full" />
              ) : pieChartData.length > 0 ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieChartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => `฿${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
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

          {/* Bar Chart */}
          <Card className="rounded-2xl shadow-sm border-muted/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold">รายงานรายวัน</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              {loadingTxs ? (
                <Skeleton className="h-[250px] w-full" />
              ) : filteredTransactions.length > 0 ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `฿${val}`} />
                      <Tooltip 
                        formatter={(value: any, name: any) => [`฿${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2})}`, name === 'income' ? 'รายรับ' : 'รายจ่าย']} 
                        labelFormatter={(label) => `วันที่ ${label} ${MONTHS[selectedMonth]}`}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 500 }}
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
        </section>

        {/* Transactions List */}
        <section>
          <Card className="rounded-2xl shadow-sm border-muted/50 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-muted/50 py-4 flex flex-row justify-between items-center space-y-0">
              <CardTitle className="text-base font-semibold">รายการธุรกรรมล่าสุด</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTxs ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : filteredTransactions.length > 0 ? (
                <div className="divide-y divide-muted/50">
                  {filteredTransactions.map((tx) => {
                    const acc = accounts.find(a => a.id === tx.accountId);
                    const toAcc = accounts.find(a => a.id === tx.toAccountId);
                    const isIncome = tx.type === 'income';
                    const isTransfer = tx.type === 'transfer';
                    
                    return (
                      <div key={tx.id} className="group flex justify-between items-center p-4 sm:px-6 hover:bg-muted/30 transition-colors duration-200 relative">
                        {acc && <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: isTransfer ? '#3b82f6' : acc.color }} />}
                        
                        <div className="flex items-center gap-4 flex-1 pl-2">
                          {/* Category Icon / Initial */}
                          <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                            isTransfer 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                              : isIncome 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                          }`}>
                            {isTransfer ? <ArrowRightLeft className="w-4 h-4" /> : tx.category.substring(0, 1)}
                          </div>
                          
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground tracking-tight truncate">
                              {isTransfer ? 'โอนเงิน' : tx.category}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {isTransfer ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium truncate max-w-[120px] sm:max-w-[200px]">
                                  {acc?.name} ➡️ {toAcc?.name}
                                </span>
                              ) : acc ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-background border text-muted-foreground font-medium truncate max-w-[100px]">
                                  {acc.name}
                                </span>
                              ) : null}
                              <span className="text-xs text-muted-foreground font-medium truncate">
                                {format(new Date(tx.date), "d MMM yyyy")} {tx.note && `• ${tx.note}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                          <div className={`font-bold tracking-tight text-right ${
                            isTransfer 
                              ? 'text-blue-600 dark:text-blue-500' 
                              : isIncome 
                                ? 'text-emerald-600 dark:text-emerald-500' 
                                : 'text-foreground'
                          }`}>
                            {isTransfer ? '' : isIncome ? '+' : '-'}฿{tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={() => handleEditTx(tx)} className="rounded-lg cursor-pointer">
                                <Edit2 className="h-4 w-4 mr-2" /> แก้ไข
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteTx(tx.id)} className="text-destructive focus:text-destructive rounded-lg cursor-pointer">
                                <Trash2 className="h-4 w-4 mr-2" /> ลบ
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <TrendingDown className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="mb-2 font-medium text-foreground">ไม่พบรายการธุรกรรมในเดือนนี้</p>
                  <p className="text-sm">เพิ่มรายการแรกของคุณเพื่อเริ่มต้นติดตามการใช้จ่าย</p>
                  {accounts.length === 0 && (
                    <p className="text-sm text-destructive mt-2">กรุณาสร้างบัญชีก่อนเพิ่มรายการธุรกรรม</p>
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
      
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={handleCloseAccountModal}
        existingAccount={accountToEdit}
      />

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        currentBudget={userSettings?.monthlyBudget || 0}
      />
    </div>
  );
};
