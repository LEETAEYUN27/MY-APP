import { useState, useEffect, useCallback } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  LayoutDashboard,
  Heart,
  Globe,
  Bell,
  User,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "대시보드", icon: LayoutDashboard },
  { path: "/interests", label: "관심사", icon: Heart },
  { path: "/sources", label: "소스설정", icon: Globe },
  { path: "/notifications", label: "알림", icon: Bell },
  { path: "/profile", label: "프로필", icon: User },
];

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications/unread-count");
      setUnreadCount(data.count);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#F9F8F6]" data-testid="app-layout">
      {/* 상단 네비게이션 바 */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#EAE6DF] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-[72px]">
            {/* 로고 */}
            <NavLink to="/" className="flex items-center gap-3" data-testid="app-logo">
              <div className="w-10 h-10 bg-[#D86246] rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-[#1A1A1A] hidden sm:block" style={{ fontFamily: 'Work Sans' }}>
                정보비서
              </span>
            </NavLink>

            {/* 데스크톱 네비게이션 */}
            <nav className="hidden md:flex items-center gap-1" data-testid="desktop-nav">
              {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
                const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
                return (
                  <NavLink key={path} to={path} data-testid={`nav-${path === "/" ? "dashboard" : path.slice(1)}`}>
                    <Button
                      variant="ghost"
                      className={`min-h-[48px] px-4 text-base rounded-xl transition-all duration-200 flex items-center gap-2 ${
                        isActive
                          ? "bg-[#D86246]/10 text-[#D86246] font-semibold"
                          : "text-[#4A4A4A] hover:bg-[#EAE6DF] hover:text-[#1A1A1A]"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                      {label === "알림" && unreadCount > 0 && (
                        <Badge className="bg-[#D86246] text-white text-xs px-2 py-0.5 rounded-full ml-1">
                          {unreadCount}
                        </Badge>
                      )}
                    </Button>
                  </NavLink>
                );
              })}
            </nav>

            {/* 사용자 + 모바일 메뉴 */}
            <div className="flex items-center gap-3">
              <span className="text-base font-medium text-[#4A4A4A] hidden sm:block" data-testid="user-name">
                {user?.name || user?.email}
              </span>
              <Button
                variant="ghost"
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-button"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* 모바일 네비게이션 */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-white border-t border-[#EAE6DF] px-4 py-3 space-y-1" data-testid="mobile-nav">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
              return (
                <NavLink key={path} to={path} data-testid={`mobile-nav-${path === "/" ? "dashboard" : path.slice(1)}`}>
                  <Button
                    variant="ghost"
                    className={`w-full min-h-[56px] px-4 text-lg rounded-xl justify-start gap-3 ${
                      isActive
                        ? "bg-[#D86246]/10 text-[#D86246] font-semibold"
                        : "text-[#4A4A4A] hover:bg-[#EAE6DF]"
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    {label}
                    {label === "알림" && unreadCount > 0 && (
                      <Badge className="bg-[#D86246] text-white text-xs px-2 py-0.5 rounded-full ml-auto">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </NavLink>
              );
            })}
          </nav>
        )}
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
