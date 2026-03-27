import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Bell, BellOff, CheckCheck, Clock } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data);
    } catch (err) {
      console.error("알림 가져오기 오류:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("모두 읽음 처리 오류:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "방금 전";
      if (diffMin < 60) return `${diffMin}분 전`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}시간 전`;
      const diffDay = Math.floor(diffHr / 24);
      return `${diffDay}일 전`;
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
            알림
          </h1>
          <p className="text-base md:text-lg text-[#4A4A4A] mt-1">
            {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : "모든 알림을 확인했습니다!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={markAllRead}
            variant="outline"
            className="min-h-[56px] px-6 text-lg border-[#EAE6DF] text-[#4A4A4A] hover:bg-[#EAE6DF] rounded-2xl"
            data-testid="mark-all-read-button"
          >
            <CheckCheck className="w-5 h-5 mr-2" />
            모두 읽음 처리
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white border-[#EAE6DF] rounded-2xl">
              <CardContent className="p-6">
                <div className="h-5 w-2/3 bg-[#EAE6DF] rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-[#EAE6DF] rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="bg-white border-[#EAE6DF] rounded-2xl" data-testid="empty-notifications">
          <CardContent className="p-12 text-center">
            <BellOff className="w-16 h-16 text-[#D4CFC7] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2" style={{ fontFamily: 'Work Sans' }}>
              아직 알림이 없습니다
            </h3>
            <p className="text-base text-[#4A4A4A]">
              피드를 업데이트하면 여기에 알림이 표시됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif, idx) => (
            <Card
              key={notif.id}
              className={`border-[#EAE6DF] rounded-2xl transition-all duration-200 hover:-translate-y-1 animate-fade-in-up ${
                notif.is_read ? "bg-white opacity-70" : "bg-white shadow-sm border-l-4 border-l-[#D86246]"
              }`}
              style={{ animationDelay: `${idx * 0.05}s` }}
              data-testid={`notification-${notif.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                    notif.is_read ? "bg-[#EAE6DF] text-[#4A4A4A]" : "bg-[#D86246] text-white"
                  }`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[#1A1A1A] mb-1" style={{ fontFamily: 'Work Sans' }}>
                      {notif.title}
                    </h3>
                    <p className="text-base text-[#4A4A4A] leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-[#4A4A4A]">
                      <Clock className="w-4 h-4" />
                      {formatTime(notif.created_at)}
                    </div>
                  </div>
                  {!notif.is_read && (
                    <span className="w-3 h-3 bg-[#D86246] rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
