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
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "firebase/auth";
import { toast } from "sonner";
import { UserCircle } from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setDisplayName(user.displayName || "");
      setPhotoURL(user.photoURL || "");
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      await updateProfile(user, {
        displayName: displayName.trim() || null,
        photoURL: photoURL.trim() || null
      });
      toast.success("อัปเดตโปรไฟล์สำเร็จ (รีเฟรชหน้าเว็บเพื่อดูผลลัพธ์ใหม่ล่าสุด)");
      onClose();
    } catch (error) {
      console.error("Error updating profile: ", error);
      toast.error("ไม่สามารถอัปเดตโปรไฟล์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>แก้ไขโปรไฟล์</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="flex flex-col items-center gap-4">
            {photoURL ? (
              <img src={photoURL} alt="Profile" referrerPolicy="no-referrer" className="w-24 h-24 rounded-full object-cover border-4 border-muted/50" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                <UserCircle className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>ชื่อแสดงผล (Display Name)</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="กรอกชื่อของคุณ..."
            />
          </div>

          <div className="space-y-2">
            <Label>ลิงก์รูปภาพโปรไฟล์ (หากมี)</Label>
            <Input
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              *หากเข้าสู่ระบบด้วย Google ระบบจะดึงรูปโปรไฟล์มาให้อัตโนมัติ
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
