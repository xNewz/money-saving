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
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentBudget: number;
  currentPayday?: number;
}

export const BudgetModal: React.FC<Props> = ({ isOpen, onClose, currentBudget, currentPayday }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [payday, setPayday] = useState("1");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(currentBudget > 0 ? currentBudget.toString() : "");
      setPayday(currentPayday ? currentPayday.toString() : "1");
    }
  }, [isOpen, currentBudget, currentPayday]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const budgetValue = parseFloat(amount) || 0;
      await setDoc(doc(db, "settings", user.uid), {
        monthlyBudget: budgetValue,
        paydayDate: parseInt(payday) || 1,
        updatedAt: Date.now()
      }, { merge: true });
      
      toast.success("บันทึกงบประมาณสำเร็จ");
      onClose();
    } catch (error) {
      console.error("Error saving budget: ", error);
      toast.error("ไม่สามารถบันทึกงบประมาณได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>ตั้งค่างบประมาณรวมรายเดือน</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>งบประมาณเป้าหมาย (บาท/เดือน)</Label>
            <Input
              type="number"
              placeholder="ตัวอย่าง: 15000"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              กำหนดงบประมาณที่คุณต้องการควบคุมไม่ให้รายจ่ายเกินเป้าในแต่ละเดือน
            </p>
          </div>

          <div className="space-y-2">
            <Label>วันที่เงินเดือนออก (1-31)</Label>
            <Input
              type="number"
              min="1"
              max="31"
              placeholder="ตัวอย่าง: 25"
              value={payday}
              onChange={(e) => setPayday(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              เพื่อนำไปใช้คำนวณรอบบิลและเป้าหมายรายวันได้ถูกต้อง
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading || !amount}>
              {loading ? "กำลังบันทึก..." : "บันทึกงบ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
