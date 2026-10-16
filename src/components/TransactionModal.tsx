import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_CATEGORY_GROUPS, INCOME_CATEGORIES, type TransactionType, type Transaction, type Account, type Debt, type Goal, EXTENDED_BANK_LISTS } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { ArrowRightLeft, Upload, BellRing } from "lucide-react";
import Tesseract from "tesseract.js";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingTransaction?: Transaction;
  accounts: Account[];
}

export const TransactionModal: React.FC<Props> = ({ isOpen, onClose, existingTransaction, accounts }) => {
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [note, setNote] = useState("");
  const [repayDueDate, setRepayDueDate] = useState("");
  const [debtId, setDebtId] = useState("");
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goalId, setGoalId] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [outstandingLends, setOutstandingLends] = useState<{note: string, balance: number}[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProcessingSlip, setIsProcessingSlip] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "debts"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const d: Debt[] = [];
      snapshot.forEach(doc => d.push({ id: doc.id, ...doc.data() } as Debt));
      setDebts(d);
    });
    
    const qGoals = query(collection(db, "goals"), where("userId", "==", user.uid));
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      const g: Goal[] = [];
      snapshot.forEach(doc => g.push({ id: doc.id, ...doc.data() } as Goal));
      setGoals(g);
    });

    const qTxs = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const lentOutBalances: Record<string, { totalLent: number, totalReceived: number, totalForgiven: number }> = {};
      snapshot.forEach(docSnap => {
        const t = docSnap.data() as Transaction;
        if (t.type === 'expense' && t.category === 'ให้ยืม') {
            const key = t.note?.trim() || 'ไม่ระบุ';
            if (!lentOutBalances[key]) lentOutBalances[key] = { totalLent: 0, totalReceived: 0, totalForgiven: 0 };
            lentOutBalances[key].totalLent += t.amount;
            if (t.isForgiven) {
              lentOutBalances[key].totalForgiven += t.amount;
            }
        } else if (t.type === 'income' && t.category === 'ได้รับคืน') {
            const key = t.note?.trim() || 'ไม่ระบุ';
            if (!lentOutBalances[key]) lentOutBalances[key] = { totalLent: 0, totalReceived: 0, totalForgiven: 0 };
            lentOutBalances[key].totalReceived += t.amount;
        }
      });
      const outstanding = Object.entries(lentOutBalances)
        .map(([note, data]) => ({ note, balance: Math.max(0, data.totalLent - data.totalReceived - data.totalForgiven) }))
        .filter(item => item.balance > 0)
        .sort((a, b) => b.balance - a.balance);
      setOutstandingLends(outstanding);
    });

    return () => {
      unsub();
      unsubGoals();
      unsubTxs();
    };
  }, [user]);

  useEffect(() => {
    if (existingTransaction) {
      setType(existingTransaction.type);
      const roundedAmount = Math.round((Number(existingTransaction.amount || 0) + Number.EPSILON) * 100) / 100;
      setAmount(roundedAmount.toString());
      setCategory(existingTransaction.category);
      setDate(format(new Date(existingTransaction.date), "yyyy-MM-dd'T'HH:mm"));
      setNote(existingTransaction.note || "");
      setAccountId(existingTransaction.accountId || "");
      setToAccountId(existingTransaction.toAccountId || "");
      setDebtId(existingTransaction.debtId || "");
      setGoalId(existingTransaction.goalId || "");
      setRepayDueDate(existingTransaction.repayDueDate || "");
    } else {
      setType("expense");
      setAmount("");
      setCategory("");
      setDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setNote("");
      setToAccountId("");
      setDebtId("");
      setGoalId("");
      setRepayDueDate("");
      if (accounts.length > 0 && !accountId) {
        setAccountId(accounts[0].id);
      }
    }
  }, [existingTransaction, isOpen, accounts]);

  const categories = type === "expense" ? Object.values(EXPENSE_CATEGORY_GROUPS).flat() : INCOME_CATEGORIES;

  const handleSlipScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingSlip(true);
    toast.info("กำลังอ่านสลิป... อาจใช้เวลาสักครู่");
    try {
      const { data: { text } } = await Tesseract.recognize(
        file,
        'tha+eng',
        { logger: m => console.log(m) }
      );
      
      console.log("OCR Result:", text);

      const amountRegex = /(?:จำนวนเงิน|Amount|ยอดเงิน|โอนเงิน|Transfer|จํานวนเงิน)[:\s]*([0-9,]+(?:\.[0-9]{2})?)/i;
      const amountMatch = text.match(amountRegex);
      
      let foundAmount = false;
      if (amountMatch && amountMatch[1]) {
        const parsedAmount = amountMatch[1].replace(/,/g, '');
        if (!isNaN(parseFloat(parsedAmount))) {
          setAmount(parsedAmount);
          foundAmount = true;
          toast.success(`ดึงยอดเงินสำเร็จ: ${parsedAmount} บาท`);
        }
      }
      
      if (!foundAmount) {
         const genericAmountMatch = text.match(/([0-9,]+\.[0-9]{2})\s*(?:THB|บาท)/i);
         if (genericAmountMatch && genericAmountMatch[1]) {
            const parsedAmount = genericAmountMatch[1].replace(/,/g, '');
            if (!isNaN(parseFloat(parsedAmount))) {
              setAmount(parsedAmount);
              foundAmount = true;
              toast.success(`ดึงยอดเงินสำเร็จ: ${parsedAmount} บาท`);
            }
         }
      }

      const timeRegex = /([0-2][0-9]:[0-5][0-9])/;
      const timeMatch = text.match(timeRegex);
      const dateRegex = /([0-3]?[0-9])[\/\-]([0-1]?[0-9])[\/\-](25[0-9]{2}|20[0-9]{2}|[0-9]{2})/;
      const dateMatch = text.match(dateRegex);

      if (timeMatch && timeMatch[1]) {
         const current = new Date(date);
         
         if (dateMatch) {
            let day = parseInt(dateMatch[1], 10);
            let month = parseInt(dateMatch[2], 10) - 1;
            let year = parseInt(dateMatch[3], 10);
            if (year < 100) year += 2000;
            if (year > 2400) year -= 543;
            current.setFullYear(year, month, day);
         }
         
         const [hours, minutes] = timeMatch[1].split(':');
         current.setHours(parseInt(hours, 10), parseInt(minutes, 10));
         setDate(format(current, "yyyy-MM-dd'T'HH:mm"));
         toast.success("ดึงวันเวลาสำเร็จ");
      }
      
      if (!foundAmount && !timeMatch) {
         toast.warning("ไม่สามารถดึงข้อมูลยอดเงินหรือวันเวลาจากสลิปนี้ได้");
      }

    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการสแกนสลิป");
    } finally {
      setIsProcessingSlip(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !date) return;
    
    if (type !== "transfer" && !category) return;

    if (accounts.length > 0 && !accountId) {
      toast.error(type === "transfer" ? "กรุณาเลือกบัญชีต้นทาง" : "กรุณาเลือกบัญชี");
      return;
    }

    if (type === "transfer") {
      if (!toAccountId) {
        toast.error("กรุณาเลือกบัญชีปลายทาง");
        return;
      }
      if (accountId === toAccountId) {
        toast.error("บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน");
        return;
      }
    }

    setLoading(true);
    try {
      const data = {
        userId: user.uid,
        accountId: accountId || null,
        toAccountId: type === "transfer" ? (toAccountId || null) : null,
        amount: Math.round(((parseFloat(amount) || 0) + Number.EPSILON) * 100) / 100,
        type,
        category: type === "transfer" ? "โอนเงิน" : category,
        date,
        note,
        debtId: EXPENSE_CATEGORY_GROUPS["เงินผ่อนหนี้"].includes(category) && debtId ? debtId : null,
        goalId: category === "เงินออม" && goalId ? goalId : null,
        repayDueDate: type === "expense" && category === "ให้ยืม" && repayDueDate ? repayDueDate : null,
      };

      if (existingTransaction) {
        await updateDoc(doc(db, "transactions", existingTransaction.id), data);
        toast.success("อัปเดตรายการสำเร็จ");
      } else {
        await addDoc(collection(db, "transactions"), {
          ...data,
          createdAt: Date.now(),
        });
        toast.success("เพิ่มรายการสำเร็จ");
      }
      onClose();
    } catch (error) {
      console.error("Error saving document: ", error);
      toast.error("ไม่สามารถบันทึกรายการได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[440px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-background shadow-xl">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b shrink-0 bg-muted/20">
          <DialogTitle className="text-base sm:text-lg font-bold">
            {existingTransaction ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Slip Scan Section */}
          <div className="flex flex-col gap-2 p-3 bg-secondary/30 rounded-lg border border-border/50">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium">สแกนข้อมูลจากสลิป (Auto-Fill)</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingSlip}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {isProcessingSlip ? "กำลังประมวลผล..." : "อัปโหลดสลิป"}
              </Button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSlipScan}
              accept="image/*"
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">ระบบจะพยายามดึง ยอดเงิน และ วันเวลา ให้อัตโนมัติ</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              className={`flex-1 ${type === "expense" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
              onClick={() => { setType("expense"); setCategory(""); }}
            >
              รายจ่าย
            </Button>
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              className={`flex-1 ${type === "income" ? "bg-emerald-500 text-white hover:bg-emerald-600" : ""}`}
              onClick={() => { setType("income"); setCategory(""); }}
            >
              รายรับ
            </Button>
            <Button
              type="button"
              variant={type === "transfer" ? "default" : "outline"}
              className={`flex-1 ${type === "transfer" ? "bg-blue-500 text-white hover:bg-blue-600" : ""}`}
              onClick={() => { setType("transfer"); setCategory("โอนเงิน"); }}
            >
              <ArrowRightLeft className="w-4 h-4 mr-1" /> โอนเงิน
            </Button>
          </div>

          <div className="space-y-2">
            <Label>จำนวนเงิน (บาท)</Label>
            <Input
              type="number"
              placeholder="0.00"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {accounts.length > 0 ? (
            <div className={`grid gap-4 ${type === 'transfer' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="space-y-2">
                <Label>{type === 'transfer' ? 'จากบัญชี' : 'บัญชี'}</Label>
                <Select value={accountId} onValueChange={setAccountId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกบัญชี" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <div className="flex items-center gap-2">
                          {acc.bankSymbol && EXTENDED_BANK_LISTS[acc.bankSymbol] ? (
                            <img src={EXTENDED_BANK_LISTS[acc.bankSymbol].icon} alt={EXTENDED_BANK_LISTS[acc.bankSymbol].name} className="w-4 h-4 rounded-sm" />
                          ) : (
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                          )}
                          <span className="truncate max-w-[100px]">{acc.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === 'transfer' && (
                <div className="space-y-2">
                  <Label>เข้าบัญชี</Label>
                  <Select value={toAccountId} onValueChange={setToAccountId} required={type === 'transfer'}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกบัญชี" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id} disabled={acc.id === accountId}>
                          <div className="flex items-center gap-2">
                            {acc.bankSymbol && EXTENDED_BANK_LISTS[acc.bankSymbol] ? (
                              <img src={EXTENDED_BANK_LISTS[acc.bankSymbol].icon} alt={EXTENDED_BANK_LISTS[acc.bankSymbol].name} className="w-4 h-4 rounded-sm" />
                            ) : (
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                            )}
                            <span className="truncate max-w-[100px]">{acc.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-900">
              คุณยังไม่ได้สร้างบัญชี รายการนี้จะไม่ถูกผูกกับบัญชีใดๆ
            </div>
          )}

          {type !== "transfer" && (
            <div className="space-y-2">
              <Label>หมวดหมู่</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {type === "expense" ? (
                    Object.entries(EXPENSE_CATEGORY_GROUPS).map(([group, cats]) => (
                      <SelectGroup key={group}>
                        <SelectLabel className="bg-muted/30 px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</SelectLabel>
                        {cats.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  ) : (
                    INCOME_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {category === "ให้ยืม" && (
                <div className="flex items-center gap-2 p-2.5 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 rounded-lg text-xs leading-relaxed">
                  <span className="shrink-0">💡</span>
                  <span>รายการนี้จะไม่ถูกคิดเป็นรายจ่ายในงบประมาณ แต่จะตัดเงินในบัญชีและไปแสดงใน <b>"เงินรอรับคืน"</b></span>
                </div>
              )}
              {category === "ได้รับคืน" && (
                <div className="flex items-center gap-2 p-2.5 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 rounded-lg text-xs leading-relaxed">
                  <span className="shrink-0">💡</span>
                  <span>รายการนี้จะไม่ถูกคิดเป็นรายได้ในงบประมาณ แต่จะเพิ่มเงินในบัญชีและตัดยอดใน <b>"เงินรอรับคืน"</b></span>
                </div>
              )}
            </div>
          )}

          {type === "expense" && EXPENSE_CATEGORY_GROUPS["เงินผ่อนหนี้"].includes(category) && debts.length > 0 && (
            <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <Label className="text-primary font-medium">ผูกกับหนี้สินก้อนไหน?</Label>
              <Select value={debtId} onValueChange={setDebtId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="เลือกหนี้สิน (ไม่บังคับ)" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {debts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        <span>{d.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "expense" && category === "เงินออม" && goals.length > 0 && (
            <div className="space-y-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
              <Label className="text-emerald-600 dark:text-emerald-500 font-medium">ผูกกับเป้าหมายออมเงิน?</Label>
              <Select value={goalId} onValueChange={setGoalId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="เลือกเป้าหมาย (ไม่บังคับ)" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                        <span>{g.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>วันที่และเวลา</Label>
            <Input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {type === "expense" && category === "ให้ยืม" && (
            <div className="space-y-2 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-violet-600 dark:text-violet-400 font-medium flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5" /> วันนัดคืน (ไม่บังคับ)
                </Label>
                {repayDueDate && (
                  <button type="button" onClick={() => setRepayDueDate("")} className="text-[11px] text-muted-foreground hover:text-foreground">
                    ล้าง
                  </button>
                )}
              </div>
              <Input
                type="date"
                className="bg-background"
                value={repayDueDate}
                min={date ? date.slice(0, 10) : undefined}
                onChange={(e) => setRepayDueDate(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "1 สัปดาห์", days: 7 },
                  { label: "2 สัปดาห์", days: 14 },
                  { label: "1 เดือน", days: 30 },
                ].map(({ label, days }) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setRepayDueDate(format(addDays(date ? new Date(date) : new Date(), days), "yyyy-MM-dd"))}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-violet-500/30 text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 transition-colors"
                  >
                    +{label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                ระบบจะแจ้งเตือนที่กระดิ่งและหน้าหลักเมื่อใกล้/ถึงกำหนด ถ้าไม่ตั้งจะเตือนตามจำนวนวันที่ตั้งไว้
              </p>
            </div>
          )}

          {type === "income" && category === "ได้รับคืน" && outstandingLends.length > 0 ? (
            <div className="space-y-2 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
              <Label className="text-violet-600 dark:text-violet-500 font-medium">ได้รับคืนจากใคร?</Label>
              <Select 
                value={outstandingLends.some(l => l.note === note) ? note : "new"} 
                onValueChange={(val) => {
                  if (val === "new") {
                    setNote("");
                  } else {
                    setNote(val);
                  }
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="เลือกรายการที่ให้ยืม" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {outstandingLends.map(lend => (
                    <SelectItem key={lend.note} value={lend.note}>
                      {lend.note} (ค้าง ฿{lend.balance.toLocaleString()})
                    </SelectItem>
                  ))}
                  <SelectItem value="new">อื่น ๆ (พิมพ์เอง)</SelectItem>
                </SelectContent>
              </Select>
              
              {(!outstandingLends.some(l => l.note === note)) && (
                <Input
                  className="mt-2"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="พิมพ์ชื่อหรือรายละเอียด..."
                />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>บันทึกช่วยจำ (ไม่บังคับ)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เพิ่มรายละเอียด..."
              />
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !amount || (type !== 'transfer' && !category) || (type === 'transfer' && !toAccountId)}
              className="rounded-xl px-5"
            >
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
