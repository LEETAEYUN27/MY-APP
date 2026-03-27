import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { User, Mail, Save, LogOut, Shield } from "lucide-react";

export default function ProfilePage() {
  const { user, logout, checkAuth } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.put("/profile", { name });
      await checkAuth();
      setMessage("프로필이 성공적으로 업데이트되었습니다!");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || "업데이트에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="space-y-6 max-w-2xl" data-testid="profile-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
          프로필
        </h1>
        <p className="text-base md:text-lg text-[#4A4A4A] mt-1">
          계정 정보를 관리하세요
        </p>
      </div>

      {/* 프로필 정보 */}
      <Card className="bg-white border-[#EAE6DF] rounded-2xl shadow-sm animate-fade-in-up">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-[#1A1A1A] flex items-center gap-3" style={{ fontFamily: 'Work Sans' }}>
            <User className="w-6 h-6 text-[#D86246]" />
            계정 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-base" data-testid="profile-success">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base" data-testid="profile-error">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-base font-medium text-[#1A1A1A]">이름</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A4A4A] w-5 h-5" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-12 min-h-[56px] text-lg border-[#EAE6DF] rounded-xl"
                  data-testid="profile-name-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium text-[#1A1A1A]">이메일</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A4A4A] w-5 h-5" />
                <Input
                  value={user?.email || ""}
                  disabled
                  className="pl-12 min-h-[56px] text-lg border-[#EAE6DF] rounded-xl bg-[#F9F8F6] text-[#4A4A4A]"
                  data-testid="profile-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium text-[#1A1A1A]">역할</Label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A4A4A] w-5 h-5" />
                <Input
                  value={user?.role === "admin" ? "관리자" : "사용자"}
                  disabled
                  className="pl-12 min-h-[56px] text-lg border-[#EAE6DF] rounded-xl bg-[#F9F8F6] text-[#4A4A4A]"
                  data-testid="profile-role-input"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="min-h-[56px] px-8 text-lg font-semibold bg-[#D86246] hover:bg-[#C25238] text-white rounded-2xl transition-transform duration-200 active:scale-95"
              data-testid="profile-save-button"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? "저장 중..." : "변경사항 저장"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 로그아웃 */}
      <Card className="bg-white border-[#EAE6DF] rounded-2xl shadow-sm animate-fade-in-up stagger-1">
        <CardContent className="p-6">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full min-h-[56px] text-lg font-semibold border-red-200 text-red-600 hover:bg-red-50 rounded-2xl"
            data-testid="logout-button"
          >
            <LogOut className="w-5 h-5 mr-2" />
            로그아웃
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
