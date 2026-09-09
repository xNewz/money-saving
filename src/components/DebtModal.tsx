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
import { type Debt } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingDebt?: Debt;
}

const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
  "#64748b", "#333333"
];

export const DebtModal: React.FC<Props> = ({ isOpen, onClose, existingDebt }) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [remainingAmount, setRemainingAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existingDebt) {
      setName(existingDebt.name);
      setTotalAmount(existingDebt.totalAmount.toString());
      setRemainingAmount(existingDebt.remainingAmount.toString());
      setInterestRate(existingDebt.interestRate?.toString() || "");
      setDueDate(existingDebt.dueDate?.toString() || "");
      setColor(existingDebt.color);
    } else {
      setName("");
      setTotalAmount("");
      setRemainingAmount("");
      setInterestRate("");
      setDueDate("");
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
  }, [existingDebt, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !totalAmount || !remainingAmount) return;

    setLoading(true);
    try {
      const data = {
        userId: user.uid,
        name,
        totalAmount: parseFloat(totalAmount),
        remainingAmount: parseFloat(remainingAmount),
        interestRate: interestRate ? parseFloat(interestRate) : null,
        dueDate: dueDate ? parseInt(dueDate, 10) : null,
        color,
      };

      if (existingDebt) {
        await updateDoc(doc(db, "debts", existingDebt.id), data);
        toast.success("อัปเดตข้อมูลหนี้สินสำเร็จ");
      } else {
        await addDoc(collection(db, "debts"), {
          ...data,
          createdAt: Date.now(),
        });
        toast.success("เพิ่มหนี้สินก้อนใหม่สำเร็จ");
      }
      onClose();
    } catch (error) {
      console.error("Error saving debt: ", error);
      toast.error("ไม่สามารถบันทึกข้อมูลหนี้ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{existingDebt ? "แก้ไขข้อมูลหนี้สิน" : "เพิ่มหนี้สินก้อนใหม่"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>ชื่อหนี้สิน / สินเชื่อ</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ผ่อนบ้าน, บัตรเครดิตใบที่ 1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ยอดหนี้ทั้งหมด (บาท)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="เช่น 1000000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>ยอดคงเหลือปัจจุบัน (บาท)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={remainingAmount}
                onChange={(e) => setRemainingAmount(e.target.value)}
                placeholder="เช่น 950000"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ดอกเบี้ยต่อปี (%) (ไม่บังคับ)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="เช่น 3.5"
              />
            </div>
            <div className="space-y-2">
              <Label>วันครบกำหนดชำระของเดือน (ไม่บังคับ)</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="เช่น 15"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>สีประจำหนี้ก้อนนี้</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-primary scale-110' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading || !name || !totalAmount || !remainingAmount}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
