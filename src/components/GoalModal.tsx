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
import { type Goal } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Target, Plane, Car, Home, Laptop, GraduationCap, Heart, HelpCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingGoal?: Goal;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];
const ICONS = [
  { name: "Target", icon: Target },
  { name: "Plane", icon: Plane },
  { name: "Car", icon: Car },
  { name: "Home", icon: Home },
  { name: "Laptop", icon: Laptop },
  { name: "Graduation", icon: GraduationCap },
  { name: "Heart", icon: Heart },
  { name: "Other", icon: HelpCircle },
];

export const GoalModal: React.FC<Props> = ({ isOpen, onClose, existingGoal }) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [iconName, setIconName] = useState("Target");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existingGoal) {
      setName(existingGoal.name);
      setTargetAmount(existingGoal.targetAmount.toString());
      setCurrentAmount(existingGoal.currentAmount.toString());
      setDeadline(existingGoal.deadline || "");
      setColor(existingGoal.color);
      setIconName(existingGoal.icon || "Target");
    } else {
      setName("");
      setTargetAmount("");
      setCurrentAmount("0");
      setDeadline("");
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      setIconName("Target");
    }
  }, [existingGoal, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const data = {
        userId: user.uid,
        name,
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount),
        deadline: deadline || null,
        color,
        icon: iconName,
      };

      if (existingGoal) {
        await updateDoc(doc(db, "goals", existingGoal.id), data);
        toast.success("อัปเดตเป้าหมายสำเร็จ");
      } else {
        await addDoc(collection(db, "goals"), {
          ...data,
          createdAt: Date.now(),
        });
        toast.success("เพิ่มเป้าหมายการออมสำเร็จ");
      }
      onClose();
    } catch (error) {
      console.error("Error saving goal: ", error);
      toast.error("ไม่สามารถบันทึกเป้าหมายได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingGoal ? "แก้ไขเป้าหมาย" : "เพิ่มเป้าหมายการออม"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>ชื่อเป้าหมาย</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ซื้อรถใหม่, เที่ยวญี่ปุ่น"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>จำนวนเงินเป้าหมาย</Label>
              <Input
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>มีเงินตั้งต้นแล้ว (ถ้ามี)</Label>
              <Input
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>กำหนดเสร็จสิ้น (ไม่บังคับ)</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>ไอคอน</Label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map((IconObj) => {
                const Icon = IconObj.icon;
                return (
                  <button
                    key={IconObj.name}
                    type="button"
                    onClick={() => setIconName(IconObj.name)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      iconName === IconObj.name ? "ring-2 ring-primary ring-offset-2 bg-primary/10" : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <Icon className="w-5 h-5 text-foreground" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>สี</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? "scale-110 ring-2 ring-primary ring-offset-2" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading || !name || !targetAmount}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
