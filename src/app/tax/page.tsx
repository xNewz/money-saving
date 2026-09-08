"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Calculator, AlertCircle, CheckCircle2 } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Transaction } from "@/types";
import { useEffect } from "react";

export default function TaxCalculator() {
  const router = useRouter();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataSource, setDataSource] = useState<"manual" | "auto">("manual");
  
  const [salary, setSalary] = useState<string>("");
  const [salaryType, setSalaryType] = useState<"monthly" | "yearly">("monthly");
  const [otherIncome, setOtherIncome] = useState<string>("");
  const [maritalStatus, setMaritalStatus] = useState<"single" | "married">("single");
  const [deductions, setDeductions] = useState<string>("60000");

  useEffect(() => {
    if (!user) return;
    const qTxs = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid)
    );
    const unsub = onSnapshot(qTxs, (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((doc) => {
        txs.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(txs);
    });
    return () => unsub();
  }, [user]);

  const currentYear = new Date().getFullYear();
  const currentYearTxs = transactions.filter(t => new Date(t.date).getFullYear() === currentYear);
  const autoIncome = currentYearTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);

  const numSalary = parseFloat(salary) || 0;
  const numOtherIncome = parseFloat(otherIncome) || 0;
  const numDeductions = parseFloat(deductions) || 0;

  const activeSalary = dataSource === "auto" ? 0 : numSalary;
  const activeOtherIncome = dataSource === "auto" ? autoIncome : numOtherIncome;

  const totalSalaryYearly = dataSource === "auto" ? 0 : (salaryType === "monthly" ? activeSalary * 12 : activeSalary);
  const totalIncome = totalSalaryYearly + activeOtherIncome;

  const mustFile = useMemo(() => {
    if (maritalStatus === "single") {
      if (numOtherIncome > 0) return totalIncome > 60000;
      return totalIncome > 120000;
    } else {
      if (numOtherIncome > 0) return totalIncome > 120000;
      return totalIncome > 220000;
    }
  }, [totalIncome, numOtherIncome, maritalStatus]);

  const expenseDeduction = Math.min(totalIncome * 0.5, 100000);
  const netIncome = Math.max(0, totalIncome - expenseDeduction - numDeductions);

  const taxCalculation = useMemo(() => {
    let tax = 0;
    const brackets = [
      { limit: 150000, rate: 0, label: "0 - 150,000" },
      { limit: 300000, rate: 0.05, label: "150,001 - 300,000" },
      { limit: 500000, rate: 0.10, label: "300,001 - 500,000" },
      { limit: 750000, rate: 0.15, label: "500,001 - 750,000" },
      { limit: 1000000, rate: 0.20, label: "750,001 - 1,000,000" },
      { limit: 2000000, rate: 0.25, label: "1,000,001 - 2,000,000" },
      { limit: 5000000, rate: 0.30, label: "2,000,001 - 5,000,000" },
      { limit: Infinity, rate: 0.35, label: "5,000,001 ขึ้นไป" },
    ];

    let previousLimit = 0;
    const breakdown = [];

    for (const b of brackets) {
      if (netIncome > previousLimit) {
        const taxableInThisBracket = Math.min(netIncome - previousLimit, b.limit - previousLimit);
        const taxInThisBracket = taxableInThisBracket * b.rate;
        tax += taxInThisBracket;
        
        breakdown.push({
          label: b.label,
          amount: taxableInThisBracket,
          rate: b.rate,
          tax: taxInThisBracket
        });
      }
      previousLimit = b.limit;
      if (netIncome <= b.limit) break;
    }

    // Default first bracket if 0 income
    if (breakdown.length === 0) {
      breakdown.push({
        label: "0 - 150,000",
        amount: 0,
        rate: 0,
        tax: 0
      });
    }

    return { tax, breakdown };
  }, [netIncome]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 md:pb-8 p-4 md:p-8 transition-colors font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-40 py-4 -mx-4 px-4 md:mx-0 md:px-0 md:relative md:bg-transparent md:backdrop-blur-none border-b md:border-none">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="rounded-full hover:bg-muted">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent flex items-center gap-2">
                <Calculator className="w-6 h-6 text-primary" />
                เครื่องมือคำนวณภาษี
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm font-medium">ประเมินภาษีเงินได้บุคคลธรรมดาเบื้องต้น</p>
            </div>
          </div>
          <ModeToggle />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inputs Section */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="rounded-2xl shadow-sm border-muted/50">
              <CardHeader className="pb-4 border-b border-muted/20">
                <CardTitle className="text-lg">ข้อมูลรายได้และลดหย่อน</CardTitle>
                <CardDescription>กรอกข้อมูลตลอดทั้งปีเพื่อการคำนวณที่แม่นยำ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                
                {/* Data Source Toggle */}
                <div className="flex bg-muted/50 p-1 rounded-xl">
                  <button 
                    onClick={() => setDataSource("manual")}
                    className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${dataSource === 'manual' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    กรอกข้อมูลเอง
                  </button>
                  <button 
                    onClick={() => setDataSource("auto")}
                    className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${dataSource === 'auto' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    ดึงจากระบบปีนี้ ({currentYear})
                  </button>
                </div>

                {/* Salary */}
                <div className={`space-y-3 transition-opacity ${dataSource === 'auto' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex justify-between">
                    <Label className="text-sm font-semibold">รายได้ประจำ (เงินเดือน)</Label>
                    <Select value={salaryType} onValueChange={(val: any) => setSalaryType(val)}>
                      <SelectTrigger className="h-6 w-[120px] text-xs border-none bg-muted/50 rounded-full px-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="monthly" className="text-xs rounded-lg">ต่อเดือน</SelectItem>
                        <SelectItem value="yearly" className="text-xs rounded-lg">ต่อปี</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">฿</span>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={dataSource === 'auto' ? 0 : salary} 
                      onChange={(e) => setSalary(e.target.value)}
                      className="pl-8 rounded-xl h-11"
                      disabled={dataSource === 'auto'}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">รวมทั้งปี: ฿{totalSalaryYearly.toLocaleString()}</p>
                </div>

                {/* Other Income */}
                <div className={`space-y-3 transition-opacity ${dataSource === 'auto' ? 'opacity-100 pointer-events-none' : ''}`}>
                  <Label className="text-sm font-semibold">รายได้ทางอื่น (ค้าขาย, ฟรีแลนซ์ ฯลฯ)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">฿</span>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={dataSource === 'auto' ? autoIncome : otherIncome} 
                      onChange={(e) => setOtherIncome(e.target.value)}
                      className={`pl-8 rounded-xl h-11 ${dataSource === 'auto' ? 'bg-primary/5 border-primary/20 text-primary font-semibold' : ''}`}
                      disabled={dataSource === 'auto'}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ต่อปี</span>
                  </div>
                  {dataSource === 'auto' && (
                    <p className="text-xs text-primary font-medium mt-1">
                      * ดึงรวมรายรับทั้งหมดจากรายการธุรกรรมในปี {currentYear}
                    </p>
                  )}
                </div>



                {/* Marital Status */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">สถานภาพการสมรส (เพื่อเช็คเกณฑ์ยื่นภาษี)</Label>
                  <Select value={maritalStatus} onValueChange={(val: any) => setMaritalStatus(val)}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="single" className="rounded-lg">โสด / ยื่นแยก</SelectItem>
                      <SelectItem value="married" className="rounded-lg">สมรส (ยื่นรวม)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Deductions */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">รวมค่าลดหย่อนภาษี</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">฿</span>
                    <Input 
                      type="number" 
                      value={deductions} 
                      onChange={(e) => setDeductions(e.target.value)}
                      className="pl-8 rounded-xl h-11 bg-primary/5 border-primary/20 focus-visible:ring-primary/30"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    * ระบบใส่ค่าเริ่มต้น 60,000 บาท (ค่าลดหย่อนส่วนตัว) ให้แล้ว สามารถบวกประกัน กองทุน ฯลฯ เพิ่มได้เลย
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Filing Alert */}
            <Card className={`rounded-2xl border ${mustFile ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} shadow-sm`}>
              <CardContent className="p-4 flex gap-4 items-start">
                {mustFile ? (
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className={`font-semibold ${mustFile ? 'text-amber-700 dark:text-amber-500' : 'text-emerald-700 dark:text-emerald-500'}`}>
                    {mustFile ? "คุณถึงเกณฑ์ต้อง 'ยื่นภาษี'" : "รายได้ของคุณยังไม่ถึงเกณฑ์ต้องยื่นภาษี"}
                  </h3>
                  <p className={`text-sm mt-1 ${mustFile ? 'text-amber-600/80 dark:text-amber-500/80' : 'text-emerald-600/80 dark:text-emerald-500/80'}`}>
                    {mustFile 
                      ? "ถึงแม้ว่าจะคำนวณแล้วไม่ต้องเสียภาษี (ยอดภาษีเป็น 0) แต่คุณมีหน้าที่ต้องยื่นแบบแสดงรายการตามกฎหมาย" 
                      : "รายได้ตลอดปีของคุณยังไม่ถึงเกณฑ์ขั้นต่ำที่สรรพากรกำหนด จึงไม่ต้องยื่นแบบแสดงรายการ"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="rounded-2xl shadow-sm border-muted/50 bg-card">
                <CardContent className="p-4 sm:p-5 flex flex-col justify-center items-center text-center space-y-1">
                  <span className="text-sm font-medium text-muted-foreground">เงินได้สุทธิ</span>
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight">฿{netIncome.toLocaleString()}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                    (รายได้ - หักค่าใช้จ่าย ฿{expenseDeduction.toLocaleString()} - ลดหย่อน ฿{numDeductions.toLocaleString()})
                  </span>
                </CardContent>
              </Card>
              
              <Card className="rounded-2xl shadow-sm border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                <CardContent className="p-4 sm:p-5 flex flex-col justify-center items-center text-center space-y-1">
                  <span className="text-sm font-medium text-primary">ภาษีที่ต้องชำระ</span>
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    ฿{taxCalculation.tax.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}
                  </span>
                  {taxCalculation.tax > 0 && totalIncome > 0 && (
                    <span className="text-xs text-primary font-medium mt-2 bg-primary/10 px-2 py-0.5 rounded-full">
                      คิดเป็น {((taxCalculation.tax / totalIncome) * 100).toFixed(1)}% ของรายได้
                    </span>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tax Brackets Breakdown */}
            <Card className="rounded-2xl shadow-sm border-muted/50 overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-muted/50 py-4">
                <CardTitle className="text-base font-semibold">รายละเอียดการคำนวณภาษี (แบบขั้นบันได)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground bg-muted/20 uppercase">
                      <tr>
                        <th className="px-4 py-3 font-medium">ช่วงเงินได้สุทธิ (บาท)</th>
                        <th className="px-4 py-3 font-medium text-right">อัตราภาษี</th>
                        <th className="px-4 py-3 font-medium text-right">เงินได้ในขั้นนี้</th>
                        <th className="px-4 py-3 font-medium text-right">ภาษีขั้นนี้</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted/30">
                      {taxCalculation.breakdown.map((b, i) => (
                        <tr key={i} className={`hover:bg-muted/10 transition-colors ${b.tax > 0 ? 'bg-primary/5' : ''}`}>
                          <td className="px-4 py-3 whitespace-nowrap">{b.label}</td>
                          <td className="px-4 py-3 text-right">{(b.rate * 100).toFixed(0)}%</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">฿{b.amount.toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${b.tax > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                            ฿{b.tax.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
