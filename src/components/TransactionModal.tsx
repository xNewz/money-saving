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
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";

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
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [debtId, setDebtId] = useState("");
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goalId, setGoalId] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);

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

    return () => {
      unsub();
      unsubGoals();
    };
  }, [user]);

  useEffect(() => {
    if (existingTransaction) {
      setType(existingTransaction.type);
      setAmount(existingTransaction.amount.toString());
      setCategory(existingTransaction.category);
      setDate(existingTransaction.date);
      setNote(existingTransaction.note || "");
      setAccountId(existingTransaction.accountId || "");
      setToAccountId(existingTransaction.toAccountId || "");
      setDebtId(existingTransaction.debtId || "");
      setGoalId(existingTransaction.goalId || "");
    } else {
      setType("expense");
      setAmount("");
      setCategory("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setNote("");
      setToAccountId("");
      setDebtId("");
      setGoalId("");
      if (accounts.length > 0 && !accountId) {
        setAccountId(accounts[0].id);
      }
    }
  }, [existingTransaction, isOpen, accounts]);

  const categories = type === "expense" ? Object.values(EXPENSE_CATEGORY_GROUPS).flat() : INCOME_CATEGORIES;

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
        amount: parseFloat(amount),
        type,
        category: type === "transfer" ? "โอนเงิน" : category,
        date,
        note,
        debtId: EXPENSE_CATEGORY_GROUPS["เงินผ่อนหนี้"].includes(category) && debtId ? debtId : null,
        goalId: category === "เงินออม" && goalId ? goalId : null,
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{existingTransaction ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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
            <Label>วันที่</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>บันทึกช่วยจำ (ไม่บังคับ)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เพิ่มรายละเอียด..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading || !amount || (type !== 'transfer' && !category) || (type === 'transfer' && !toAccountId)}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
