import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { UserPlus, Mail, Lock, User } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    setIsLoading(true);
    try {
      await register(email, password, name);
      navigate("/");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || "회원가입에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center p-6" data-testid="register-page">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
            정보비서
          </h1>
          <p className="text-lg text-[#4A4A4A] mt-2">
            새 계정을 만들어 시작하세요
          </p>
        </div>

        <Card className="bg-white border-[#EAE6DF] shadow-sm rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl md:text-3xl font-bold text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
              회원가입
            </CardTitle>
            <CardDescription className="text-base text-[#4A4A4A]">
              정보를 입력하여 계정을 만드세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base" data-testid="register-error">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-base font-medium text-[#1A1A1A]">이름</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A4A4A] w-5 h-5" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-12 min-h-[56px] text-lg border-[#EAE6DF] rounded-xl focus:ring-2 focus:ring-[#D86246]"
                    placeholder="이름을 입력하세요"
                    required
                    data-testid="register-name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium text-[#1A1A1A]">이메일</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A4A4A] w-5 h-5" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 min-h-[56px] text-lg border-[#EAE6DF] rounded-xl focus:ring-2 focus:ring-[#D86246]"
                    placeholder="example@email.com"
                    required
                    data-testid="register-email-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-medium text-[#1A1A1A]">비밀번호</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A4A4A] w-5 h-5" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 min-h-[56px] text-lg border-[#EAE6DF] rounded-xl focus:ring-2 focus:ring-[#D86246]"
                    placeholder="6자 이상 입력"
                    required
                    data-testid="register-password-input"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[56px] text-lg font-semibold bg-[#D86246] hover:bg-[#C25238] text-white rounded-2xl transition-transform duration-200 active:scale-95"
                data-testid="register-submit-button"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                {isLoading ? "가입 중..." : "회원가입"}
              </Button>

              <p className="text-center text-base text-[#4A4A4A]">
                이미 계정이 있으신가요?{" "}
                <Link to="/login" className="text-[#D86246] font-semibold hover:underline" data-testid="login-link">
                  로그인
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
