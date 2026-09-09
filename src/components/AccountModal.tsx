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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Account, EXTENDED_BANK_LISTS } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingAccount?: Account;
}

const ACCOUNT_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#64748b", // slate-500
];

export const AccountModal: React.FC<Props> = ({ isOpen, onClose, existingAccount }) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [bankSymbol, setBankSymbol] = useState("none");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existingAccount) {
      setName(existingAccount.name);
      setInitialBalance(existingAccount.initialBalance.toString());
      setColor(existingAccount.color);
      setBankSymbol(existingAccount.bankSymbol || "none");
    } else {
      setName("");
      setInitialBalance("0");
      setColor(ACCOUNT_COLORS[0]);
      setBankSymbol("none");
    }
  }, [existingAccount, isOpen]);

  const handleBankChange = (val: string) => {
    setBankSymbol(val);
    if (val !== "none" && EXTENDED_BANK_LISTS[val]) {
      const bank = EXTENDED_BANK_LISTS[val];
      if (!name || name === "") {
        setName(bank.name);
      }
      setColor(bank.color);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;
    
    setLoading(true);
    try {
      const data = {
        userId: user.uid,
        name,
        bankSymbol: bankSymbol === "none" ? null : bankSymbol,
        initialBalance: parseFloat(initialBalance) || 0,
        color,
      };

      if (existingAccount) {
        await updateDoc(doc(db, "accounts", existingAccount.id), data);
        toast.success("อัปเดตบัญชีสำเร็จ");
      } else {
        await addDoc(collection(db, "accounts"), {
          ...data,
          createdAt: Date.now(),
        });
        toast.success("สร้างบัญชีสำเร็จ");
      }
      onClose();
    } catch (error) {
      console.error("Error saving account: ", error);
      toast.error("ไม่สามารถบันทึกบัญชีได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{existingAccount ? "แก้ไขบัญชี" : "เพิ่มบัญชีใหม่"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="bank">ไอคอนธนาคาร (ไม่บังคับ)</Label>
            <Select value={bankSymbol} onValueChange={handleBankChange}>
              <SelectTrigger id="bank">
                <SelectValue placeholder="ไม่มี (กำหนดเอง)" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="none">ไม่มี (กำหนดเอง)</SelectItem>
                {Object.entries(EXTENDED_BANK_LISTS).map(([symbol, bank]) => (
                  <SelectItem key={symbol} value={symbol}>
                    <div className="flex items-center gap-2">
                      <img src={bank.icon} alt={bank.name} className="w-5 h-5 rounded" />
                      <span>{bank.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">ชื่อบัญชี</Label>
            <Input
              id="name"
              placeholder="เช่น เงินสด, กสิกร, บัตรเครดิต"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="initialBalance">ยอดยกมาเริ่มต้น</Label>
            <Input
              id="initialBalance"
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>ป้ายสี</Label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-primary scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading || !name}>
              {loading ? "กำลังบันทึก..." : "บันทึกบัญชี"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
