"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import type { Goal, Transaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, PlusCircle, MoreVertical, Edit2, Trash2, TrendingUp, HelpCircle, Plane, Car, Home, Laptop, GraduationCap, Heart } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalModal } from "@/components/GoalModal";
import { GoalSaveModal } from "@/components/GoalSaveModal";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ICONS: Record<string, React.ElementType> = {
  Target, Plane, Car, Home, Laptop, GraduationCap, Heart, Other: HelpCircle
};

export default function GoalsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<Goal | undefined>(undefined);
  const [savingGoal, setSavingGoal] = useState<Goal | undefined>(undefined);

  useEffect(() => {
    if (!user) return;

    const qGoals = query(collection(db, "goals"), where("userId", "==", user.uid));
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      const g: Goal[] = [];
      snapshot.forEach((doc) => g.push({ id: doc.id, ...doc.data() } as Goal));
      setGoals(g);
    });

    const qTxs = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((doc) => txs.push({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(txs);
      setLoadingData(false);
    });

    return () => {
      unsubGoals();
      unsubTxs();
    };
  }, [user]);

  const handleDeleteGoal = async (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบเป้าหมายการออมนี้? ประวัติการออมที่ผูกไว้จะไม่ถูกลบ แต่จะหลุดจากการผูกกับเป้าหมายนี้")) {
      try {
        await deleteDoc(doc(db, "goals", id));
        toast.success("ลบเป้าหมายเรียบร้อยแล้ว");
      } catch (error) {
        toast.error("ไม่สามารถลบเป้าหมายได้");
        console.error(error);
      }
    }
  };

  const handleEditGoal = (goal: Goal) => {
    setGoalToEdit(goal);
    setIsModalOpen(true);
  };

  const calculatedGoals = goals.map(goal => {
    const savedTxs = transactions.filter(t => t.goalId === goal.id && t.type === "expense" && t.category === "เงินออม");
    const totalSavedInTxs = savedTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalSaved = goal.currentAmount + totalSavedInTxs;
    const progressPercent = goal.targetAmount > 0 
      ? Math.min(100, Math.max(0, (totalSaved / goal.targetAmount) * 100))
      : 0;
    
    return {
      ...goal,
      totalSaved,
      progressPercent
    };
  });

  const overallTarget = calculatedGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallSaved = calculatedGoals.reduce((sum, g) => sum + g.totalSaved, 0);
  const overallProgress = overallTarget > 0 ? (overallSaved / overallTarget) * 100 : 0;

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
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
                เป้าหมายการออม
              </h1>
              <p className="text-muted-foreground text-sm font-medium">ติดตามความคืบหน้าเพื่อความฝัน</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Button onClick={() => { setGoalToEdit(undefined); setIsModalOpen(true); }} className="flex gap-2 rounded-full shadow-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มเป้าหมาย</span>
            </Button>
            <ModeToggle />
          </div>
        </header>

        {/* Summary */}
        <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 shadow-sm rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Target className="w-32 h-32 text-emerald-600" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-base font-semibold text-emerald-700 dark:text-emerald-400">ออมสำเร็จแล้วทั้งหมด</CardTitle>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {loadingData ? <Skeleton className="h-10 w-1/2 mb-4" /> : (
              <div className="mb-4">
                <div className="text-4xl md:text-5xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                  ฿{overallSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm font-medium text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                  จากเป้าหมายรวม ฿{overallTarget.toLocaleString()}
                </div>
              </div>
            )}
            <Progress 
              value={overallProgress} 
              className="h-3 bg-emerald-500/10"
              indicatorClassName="bg-emerald-500"
            />
          </CardContent>
        </Card>

        {/* Goal List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loadingData ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-3xl" />
            ))
          ) : calculatedGoals.length > 0 ? (
            calculatedGoals.map(goal => {
              const GoalIcon = ICONS[goal.icon || "Target"] || Target;
              const isCompleted = goal.progressPercent >= 100;
              
              return (
                <Card key={goal.id} className="rounded-3xl shadow-sm border-muted/50 overflow-hidden relative group">
                  <div className="absolute top-0 left-0 w-2 h-full transition-all" style={{ backgroundColor: goal.color }} />
                  
                  {isCompleted && (
                    <div className="absolute inset-0 bg-emerald-500/5 backdrop-blur-[1px] pointer-events-none z-0" />
                  )}

                  <CardHeader className="pl-6 pb-2 pt-5 pr-5 flex flex-row items-start justify-between relative z-10">
                    <div className="flex items-center gap-3 pr-6">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: goal.color }}>
                        <GoalIcon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                          {goal.name}
                        </CardTitle>
                        {goal.deadline && (
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            ภายใน {new Date(goal.deadline).toLocaleDateString("th-TH", { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => handleEditGoal(goal)} className="rounded-lg cursor-pointer">
                          <Edit2 className="h-4 w-4 mr-2" /> แก้ไขข้อมูล
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteGoal(goal.id)} className="text-destructive focus:text-destructive rounded-lg cursor-pointer">
                          <Trash2 className="h-4 w-4 mr-2" /> ลบ
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  
                  <CardContent className="pl-6 pb-6 pt-2 relative z-10">
                    <div className="flex justify-between items-end mb-4 mt-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">เก็บได้แล้ว</p>
                        <p className="text-2xl font-bold tracking-tight">฿{goal.totalSaved.toLocaleString()}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">จากเป้าหมาย ฿{goal.targetAmount.toLocaleString()}</p>
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${isCompleted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                            {isCompleted ? 'สำเร็จแล้ว! 🎉' : `${goal.progressPercent.toFixed(1)}%`}
                          </span>
                        </div>
                        {!isCompleted && (
                          <Button size="sm" onClick={() => setSavingGoal(goal)} className="h-8 rounded-full shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white border-none">
                            ออมเงิน
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <Progress 
                      value={goal.progressPercent} 
                      className="h-2.5 mb-2"
                      indicatorStyle={{ backgroundColor: goal.color }}
                    />
                    
                    {goal.currentAmount > 0 && (
                      <p className="text-xs text-muted-foreground text-right">รวมเงินตั้งต้น ฿{goal.currentAmount.toLocaleString()}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-1 md:col-span-2 text-center py-16 text-muted-foreground flex flex-col items-center bg-card/50 rounded-3xl border border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-emerald-600/40" />
              </div>
              <p className="mb-2 font-medium text-foreground text-lg">ยังไม่มีเป้าหมายการออม</p>
              <p className="text-sm max-w-sm mb-4">ตั้งเป้าหมายเล็กๆ น้อยๆ เพื่อให้การเก็บเงินของคุณมีจุดหมายและสนุกยิ่งขึ้น</p>
              <Button onClick={() => { setGoalToEdit(undefined); setIsModalOpen(true); }} className="rounded-full shadow-md bg-emerald-600 hover:bg-emerald-700 text-white">
                <PlusCircle className="w-4 h-4 mr-2" />
                ตั้งเป้าหมายแรก
              </Button>
            </div>
          )}
        </div>
      </div>

      <GoalModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        existingGoal={goalToEdit}
      />
      
      <GoalSaveModal
        isOpen={!!savingGoal}
        onClose={() => setSavingGoal(undefined)}
        goal={savingGoal}
      />
    </div>
  );
}
