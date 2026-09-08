import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import type { Transaction, Account } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, LogOut, TrendingUp, TrendingDown, Wallet, MoreVertical, Edit2, Trash2, Download, CreditCard } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";
import { AccountModal } from "@/components/AccountModal";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ModeToggle } from "@/components/ModeToggle";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658', '#ef5350'];

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
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

    return () => {
      unsubTxs();
      unsubAccs();
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

  // Overall Balance includes all time transactions + all initial account balances
  const allTimeIncome = transactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const allTimeExpense = transactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const totalInitialBalances = accounts.reduce((acc, a) => acc + a.initialBalance, 0);
  const overallBalance = totalInitialBalances + allTimeIncome - allTimeExpense;

  // Prepare chart data (Expense by category in selected month)
  const expensesByCategory = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const chartData = Object.keys(expensesByCategory).map(key => ({
    name: key,
    value: expensesByCategory[key]
  })).sort((a, b) => b.value - a.value);

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
    // Check if account has transactions
    const hasTxs = transactions.some(t => t.accountId === id);
    if (hasTxs) {
      toast.error("ไม่สามารถลบบัญชีที่มีรายการธุรกรรมอยู่ได้ กรุณาลบหรือย้ายรายการก่อน");
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
      ["วันที่", "บัญชี", "ประเภท", "หมวดหมู่", "จำนวนเงิน", "บันทึกช่วยจำ"],
      ...filteredTransactions.map(t => {
        const acc = accounts.find(a => a.id === t.accountId);
        return [
          t.date,
          `"${acc ? acc.name : 'ทั่วไป'}"`,
          t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
          t.category,
          t.amount,
          `"${t.note || ""}"`
        ];
      })
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

  // Account balances map
  const getAccountBalance = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    const accTxs = transactions.filter(t => t.accountId === accountId);
    const inc = accTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = accTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return acc.initialBalance + inc - exp;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ภาพรวม</h1>
            <p className="text-muted-foreground text-sm">ยินดีต้อนรับกลับ, {user?.displayName || "ผู้ใช้"}</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <ModeToggle />
            <Button onClick={handleExport} variant="outline" size="icon" title="ส่งออก CSV" className="hidden sm:flex">
              <Download className="w-4 h-4" />
            </Button>
            <Button onClick={() => { setAccountToEdit(undefined); setIsAccountModalOpen(true); }} variant="secondary" className="gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มบัญชี</span>
            </Button>
            <Button onClick={() => { setTransactionToEdit(undefined); setIsModalOpen(true); }} className="gap-2">
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มรายการ</span>
            </Button>
            <Button variant="outline" size="icon" onClick={logout} title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* My Accounts */}
        <div>
          <h2 className="text-lg font-semibold mb-3">บัญชีของฉัน</h2>
          {loadingAccs ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-24 w-64 shrink-0 rounded-xl" />)}
            </div>
          ) : accounts.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
              {accounts.map(acc => {
                const bal = getAccountBalance(acc.id);
                return (
                  <Card key={acc.id} className="w-64 shrink-0 snap-start shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: acc.color }} />
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium truncate flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                        {acc.name}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditAccount(acc)}>
                            <Edit2 className="h-4 w-4 mr-2" /> แก้ไข
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteAccount(acc.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> ลบ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className={`text-xl font-bold ${bal >= 0 ? '' : 'text-destructive'}`}>
                        ฿{bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed shadow-none bg-transparent">
              <CardContent className="flex flex-col items-center justify-center p-6 text-muted-foreground">
                <CreditCard className="w-8 h-8 mb-2 opacity-50" />
                <p>ยังไม่มีบัญชี</p>
                <Button variant="link" onClick={() => setIsAccountModalOpen(true)}>สร้างบัญชีเพื่อเริ่มต้นใช้งาน</Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex gap-4 items-center pt-2">
          <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="เดือน" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="ปี" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1"></div>
          <Button onClick={handleExport} variant="outline" size="sm" className="sm:hidden flex gap-2">
            <Download className="w-4 h-4" /> ส่งออก
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ยอดเงินคงเหลือรวม</CardTitle>
              <Wallet className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingTxs || loadingAccs ? (
                <Skeleton className="h-8 w-1/2" />
              ) : (
                <div className={`text-2xl font-bold ${overallBalance >= 0 ? '' : 'text-destructive'}`}>
                  ฿{overallBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">รายรับ (เดือนที่เลือก)</CardTitle>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loadingTxs ? (
                <Skeleton className="h-8 w-1/2" />
              ) : (
                <div className="text-2xl font-bold text-emerald-500">
                  +฿{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">รายจ่าย (เดือนที่เลือก)</CardTitle>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {loadingTxs ? (
                <Skeleton className="h-8 w-1/2" />
              ) : (
                <div className="text-2xl font-bold text-destructive">
                  -฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts & List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>รายจ่ายแบ่งตามหมวดหมู่</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {loadingTxs ? (
                <Skeleton className="h-[250px] w-[250px] rounded-full" />
              ) : chartData.length > 0 ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => `฿${Number(value).toFixed(2)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                  ไม่มีรายจ่ายในเดือนนี้
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รายการธุรกรรม</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTxs ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredTransactions.length > 0 ? (
                <div className="space-y-4">
                  {filteredTransactions.map((tx) => {
                    const acc = accounts.find(a => a.id === tx.accountId);
                    return (
                      <div key={tx.id} className="flex justify-between items-center p-3 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        {acc && <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: acc.color }} />}
                        <div className="flex flex-col flex-1 pl-2">
                          <span className="font-medium flex items-center gap-2">
                            {tx.category}
                            {acc && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground">
                                {acc.name}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(tx.date), "MMM d, yyyy")} {tx.note && `• ${tx.note}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={`font-semibold ${tx.type === 'income' ? 'text-emerald-500' : ''}`}>
                            {tx.type === 'income' ? '+' : '-'}฿{tx.amount.toFixed(2)}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTx(tx)}>
                                <Edit2 className="h-4 w-4 mr-2" /> แก้ไข
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteTx(tx.id)} className="text-destructive focus:text-destructive">
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
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <p className="mb-4">ไม่พบรายการธุรกรรมในเดือนนี้</p>
                  {accounts.length === 0 && (
                    <p className="text-sm text-destructive">กรุณาสร้างบัญชีก่อนเพิ่มรายการธุรกรรม</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
    </div>
  );
};
