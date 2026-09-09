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
import { type Debt, type Account } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { type Debt, type Account, EXTENDED_BANK_LISTS } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  debt?: Debt;
}

export const DebtPaymentModal: React.FC<Props> = ({ isOpen, onClose, debt }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "accounts"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const a: Account[] = [];
      snapshot.forEach((doc) => a.push({ id: doc.id, ...doc.data() } as Account));
      setAccounts(a);
      if (a.length > 0 && !accountId) {
        setAccountId(a[0].id);
      }
    });
    return () => unsub();
  }, [user, accountId]);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setNote("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !debt || !amount || !date) return;

    if (accounts.length > 0 && !accountId) {
      toast.error("กรุณาเลือกบัญชี");
      return;
    }

    setLoading(true);
    try {
      const data = {
        userId: user.uid,
        accountId: accountId || null,
        toAccountId: null,
        amount: parseFloat(amount),
        type: "expense",
        category: "สินเชื่อ/ผ่อนชำระ", // default category for debt payment
        date,
        note: note || `ชำระหนี้: ${debt.name}`,
        debtId: debt.id,
      };

      await addDoc(collection(db, "transactions"), {
        ...data,
        createdAt: Date.now(),
      });
      toast.success(`บันทึกการชำระหนี้ ${debt.name} สำเร็จ`);
      onClose();
    } catch (error) {
      console.error("Error saving payment: ", error);
      toast.error("ไม่สามารถบันทึกการชำระหนี้ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>ชำระหนี้: {debt?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>จำนวนเงินที่จ่าย (บาท)</Label>
            <Input
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {accounts.length > 0 ? (
            <div className="space-y-2">
              <Label>จ่ายจากบัญชี</Label>
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
                        <span className="truncate max-w-[150px]">{acc.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="text-sm text-amber-600 p-2 bg-amber-50 rounded border border-amber-200">
              คุณยังไม่ได้สร้างบัญชี รายการนี้จะไม่ถูกผูกกับบัญชีใดๆ
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
              placeholder={`ชำระหนี้: ${debt?.name}`}
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading || !amount}>
              {loading ? "กำลังบันทึก..." : "บันทึกชำระหนี้"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
