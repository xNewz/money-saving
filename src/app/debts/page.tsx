"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import type { Debt, Transaction, Account } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, PlusCircle, MoreVertical, Edit2, Trash2, TrendingDown } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { DebtModal } from "@/components/DebtModal";
import { DebtPaymentModal } from "@/components/DebtPaymentModal";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DebtsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const [debts, setDebts] = useState<Debt[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [debtToEdit, setDebtToEdit] = useState<Debt | undefined>(undefined);
  const [paymentDebt, setPaymentDebt] = useState<Debt | undefined>(undefined);

  useEffect(() => {
    if (!user) return;

    const qDebts = query(collection(db, "debts"), where("userId", "==", user.uid));
    const unsubDebts = onSnapshot(qDebts, (snapshot) => {
      const d: Debt[] = [];
      snapshot.forEach((doc) => d.push({ id: doc.id, ...doc.data() } as Debt));
      setDebts(d);
    });

    const qTxs = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((doc) => txs.push({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(txs);
      setLoadingData(false);
    });

    return () => {
      unsubDebts();
      unsubTxs();
    };
  }, [user]);

  const handleDeleteDebt = async (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบหนี้ก้อนนี้? ประวัติการจ่ายหนี้ที่ผูกไว้จะไม่ถูกลบ แต่จะหลุดจากการผูกกับหนี้ก้อนนี้")) {
      try {
        await deleteDoc(doc(db, "debts", id));
        toast.success("ลบหนี้สินเรียบร้อยแล้ว");
      } catch (error) {
        toast.error("ไม่สามารถลบหนี้สินได้");
        console.error(error);
      }
    }
  };

  const handleEditDebt = (debt: Debt) => {
    setDebtToEdit(debt);
    setIsModalOpen(true);
  };

  const calculatedDebts = debts.map(debt => {
    const paidTxs = transactions.filter(t => t.debtId === debt.id && t.type === "expense");
    const totalPaid = paidTxs.reduce((sum, t) => sum + t.amount, 0);
    // current outstanding = base remaining amount minus payments made so far
    const currentOutstanding = Math.max(0, debt.remainingAmount - totalPaid);
    const progressPercent = debt.totalAmount > 0 
      ? Math.min(100, Math.max(0, ((debt.totalAmount - currentOutstanding) / debt.totalAmount) * 100))
      : 0;
    
    return {
      ...debt,
      totalPaid,
      currentOutstanding,
      progressPercent
    };
  });

  const totalOutstanding = calculatedDebts.reduce((sum, d) => sum + d.currentOutstanding, 0);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 md:pb-8 p-4 md:p-8 transition-colors font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-40 py-4 -mx-4 px-4 md:mx-0 md:px-0 md:relative md:bg-transparent md:backdrop-blur-none border-b md:border-none">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="rounded-full shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                จัดการหนี้สิน
              </h1>
              <p className="text-muted-foreground text-sm font-medium">ติดตามยอดหนี้และสินเชื่อ</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Button onClick={() => { setDebtToEdit(undefined); setIsModalOpen(true); }} className="flex gap-2 rounded-full shadow-md hover:shadow-lg transition-all">
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มหนี้สิน</span>
            </Button>
            <ModeToggle />
          </div>
        </header>

        {/* Summary */}
        <Card className="bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent border-destructive/20 shadow-sm rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-destructive">ยอดหนี้คงเหลือรวม</CardTitle>
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingData ? <Skeleton className="h-10 w-1/2" /> : (
              <div className="text-4xl md:text-5xl font-bold tracking-tight text-destructive">
                ฿{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debt List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loadingData ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-3xl" />
            ))
          ) : calculatedDebts.length > 0 ? (
            calculatedDebts.map(debt => (
              <Card key={debt.id} className="rounded-3xl shadow-sm border-muted/50 overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-2 h-full transition-all" style={{ backgroundColor: debt.color }} />
                <CardHeader className="pl-6 pb-2 pt-5 pr-5 flex flex-row items-start justify-between">
                  <div className="space-y-1 pr-6">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {debt.name}
                    </CardTitle>
                    {debt.dueDate && (
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        ครบกำหนดชำระวันที่ {debt.dueDate} ของทุกเดือน
                      </p>
                    )}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={() => handleEditDebt(debt)} className="rounded-lg cursor-pointer">
                        <Edit2 className="h-4 w-4 mr-2" /> แก้ไขข้อมูล
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteDebt(debt.id)} className="text-destructive focus:text-destructive rounded-lg cursor-pointer">
                        <Trash2 className="h-4 w-4 mr-2" /> ลบ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="pl-6 pb-6 pt-2">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">ยอดคงเหลือ</p>
                      <p className="text-2xl font-bold tracking-tight">฿{debt.currentOutstanding.toLocaleString()}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">จากทั้งหมด ฿{debt.totalAmount.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${debt.progressPercent >= 100 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                          {debt.progressPercent >= 100 ? 'ปลดหนี้แล้ว! 🎉' : `จ่ายแล้ว ${debt.progressPercent.toFixed(1)}%`}
                        </span>
                      </div>
                      {debt.progressPercent < 100 && (
                        <Button size="sm" onClick={() => setPaymentDebt(debt)} className="h-8 rounded-full shadow-sm">
                          จ่ายหนี้
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <Progress 
                    value={debt.progressPercent} 
                    className="h-2.5 mb-3"
                    indicatorClassName={debt.progressPercent >= 100 ? "bg-emerald-500" : "bg-primary"}
                  />
                  
                  <div className="flex justify-between text-xs font-medium text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-muted/50">
                    <div>ผ่อนชำระไปแล้ว: <span className="text-foreground">฿{debt.totalPaid.toLocaleString()}</span></div>
                    {debt.interestRate ? (
                      <div>ดอกเบี้ย: <span className="text-amber-600 dark:text-amber-400">{debt.interestRate}% ต่อปี</span></div>
                    ) : (
                      <div>ไม่มีดอกเบี้ย</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-1 md:col-span-2 text-center py-16 text-muted-foreground flex flex-col items-center bg-card/50 rounded-3xl border border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 opacity-40" />
              </div>
              <p className="mb-2 font-medium text-foreground text-lg">ยังไม่มีรายการหนี้สิน</p>
              <p className="text-sm max-w-sm mb-4">เพิ่มข้อมูลสินเชื่อหรือบัตรเครดิตของคุณ เพื่อเริ่มติดตามยอดคงเหลือและวางแผนปลดหนี้</p>
              <Button onClick={() => { setDebtToEdit(undefined); setIsModalOpen(true); }} className="rounded-full shadow-md hover:shadow-lg">
                <PlusCircle className="w-4 h-4 mr-2" />
                เพิ่มหนี้สินก้อนแรก
              </Button>
            </div>
          )}
        </div>
      </div>

      <DebtModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        existingDebt={debtToEdit}
      />
      <DebtPaymentModal
        isOpen={!!paymentDebt}
        onClose={() => setPaymentDebt(undefined)}
        debt={paymentDebt}
      />
    </div>
  );
}
