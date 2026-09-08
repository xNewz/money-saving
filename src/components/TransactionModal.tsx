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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type TransactionType, type Transaction, type Account } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existingTransaction) {
      setType(existingTransaction.type);
      setAmount(existingTransaction.amount.toString());
      setCategory(existingTransaction.category);
      setDate(existingTransaction.date);
      setNote(existingTransaction.note || "");
      setAccountId(existingTransaction.accountId || "");
    } else {
      setType("expense");
      setAmount("");
      setCategory("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setNote("");
      // Default to first account if none selected
      if (accounts.length > 0 && !accountId) {
        setAccountId(accounts[0].id);
      }
    }
  }, [existingTransaction, isOpen, accounts]);

  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !category || !date) return;
    
    // Check if account is required and available
    if (accounts.length > 0 && !accountId) {
      toast.error("กรุณาเลือกบัญชี");
      return;
    }

    setLoading(true);
    try {
      const data = {
        userId: user.uid,
        accountId: accountId || null,
        amount: parseFloat(amount),
        type,
        category,
        date,
        note,
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
          <div className="flex gap-4">
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              className={`w-full ${type === "expense" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
              onClick={() => { setType("expense"); setCategory(""); }}
            >
              รายจ่าย
            </Button>
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              className={`w-full ${type === "income" ? "bg-emerald-500 text-white hover:bg-emerald-600" : ""}`}
              onClick={() => { setType("income"); setCategory(""); }}
            >
              รายรับ
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
            <div className="space-y-2">
              <Label>บัญชี</Label>
              <Select value={accountId} onValueChange={setAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบัญชี" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                        {acc.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="text-sm text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-900">
              คุณยังไม่ได้สร้างบัญชี รายการนี้จะไม่ถูกผูกกับบัญชีใดๆ
            </div>
          )}

          <div className="space-y-2">
            <Label>หมวดหมู่</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="เลือกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <Button type="submit" disabled={loading || !amount || !category}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
