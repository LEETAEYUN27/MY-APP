import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { RefreshCw, ExternalLink, Newspaper, Star, ArrowRight, Inbox } from "lucide-react";

const RELEVANCE_STYLES = {
  high: "bg-[#D86246] text-white",
  medium: "bg-[#718F7B] text-white",
  low: "bg-[#EAE6DF] text-[#4A4A4A]",
};

const RELEVANCE_LABELS = {
  high: "높은 관련도",
  medium: "보통",
  low: "낮음",
};

const SOURCE_COLORS = {
  "Naver News": "bg-[#04CF5C] text-white",
  "Google News": "bg-[#4285F4] text-white",
  "DART": "bg-[#1A237E] text-white",
};

export default function DashboardPage() {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchFeed = useCallback(async () => {
    try {
      const { data } = await api.get("/feed");
      setFeedItems(data);
    } catch (err) {
      console.error("피드 가져오기 오류:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.post("/feed/refresh");
      if (data.items) {
        setFeedItems(data.items);
      } else {
        await fetchFeed();
      }
    } catch (err) {
      console.error("피드 새로고침 오류:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (itemId) => {
    try {
      await api.put(`/feed/${itemId}/read`);
      setFeedItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, is_read: true } : item)));
    } catch (err) {
      console.error("읽음 처리 오류:", err);
    }
  };

  const filtered = filter === "all" ? feedItems : feedItems.filter((i) => i.relevance === filter);

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
            대시보드
          </h1>
          <p className="text-base md:text-lg text-[#4A4A4A] mt-1">
            나만의 맞춤형 정보 피드
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className="min-h-[56px] px-6 text-lg font-semibold bg-[#D86246] hover:bg-[#C25238] text-white rounded-2xl transition-transform duration-200 active:scale-95"
          data-testid="refresh-feed-button"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "업데이트 중..." : "정보 업데이트"}
        </Button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3" data-testid="feed-filters">
        {[
          { key: "all", label: "전체" },
          { key: "high", label: "높은 관련도" },
          { key: "medium", label: "보통" },
          { key: "low", label: "낮음" },
        ].map(({ key, label }) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key)}
            className={`min-h-[48px] px-5 text-base rounded-2xl transition-transform duration-200 active:scale-95 ${
              filter === key
                ? "bg-[#D86246] text-white hover:bg-[#C25238]"
                : "bg-white border-[#EAE6DF] text-[#4A4A4A] hover:bg-[#EAE6DF]"
            }`}
            data-testid={`filter-${key}`}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* 피드 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white border-[#EAE6DF] rounded-2xl">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-white border-[#EAE6DF] rounded-2xl" data-testid="empty-feed">
          <CardContent className="p-12 text-center">
            <Inbox className="w-16 h-16 text-[#D4CFC7] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2" style={{ fontFamily: 'Work Sans' }}>
              아직 정보가 없습니다
            </h3>
            <p className="text-base text-[#4A4A4A] mb-6">
              먼저 관심사를 설정한 후, "정보 업데이트" 버튼을 눌러 맞춤형 정보를 가져오세요.
            </p>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              className="min-h-[56px] px-8 text-lg bg-[#D86246] hover:bg-[#C25238] text-white rounded-2xl"
              data-testid="empty-feed-refresh-button"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              정보 가져오기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((item, idx) => (
            <Card
              key={item.id}
              className={`bg-white border-[#EAE6DF] rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                item.is_read ? "opacity-70" : ""
              } animate-fade-in-up`}
              style={{ animationDelay: `${idx * 0.05}s` }}
              data-testid={`feed-item-${item.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={`text-sm px-3 py-1 rounded-full ${SOURCE_COLORS[item.source] || "bg-[#EAE6DF] text-[#4A4A4A]"}`}>
                      {item.source}
                    </Badge>
                    <Badge className={`text-sm px-3 py-1 rounded-full ${RELEVANCE_STYLES[item.relevance] || RELEVANCE_STYLES.medium}`}>
                      <Star className="w-3 h-3 mr-1" />
                      {RELEVANCE_LABELS[item.relevance] || "보통"}
                    </Badge>
                  </div>
                  {!item.is_read && (
                    <span className="w-3 h-3 bg-[#D86246] rounded-full flex-shrink-0 mt-1" />
                  )}
                </div>

                <h3 className="text-lg md:text-xl font-bold text-[#1A1A1A] mb-2 line-clamp-2" style={{ fontFamily: 'Work Sans' }}>
                  {item.title}
                </h3>

                {item.ai_summary && item.ai_summary !== item.title && (
                  <p className="text-base text-[#4A4A4A] mb-3 line-clamp-3 leading-relaxed">
                    {item.ai_summary}
                  </p>
                )}

                <div className="flex items-center justify-between mt-4">
                  <Badge variant="outline" className="text-sm border-[#EAE6DF] text-[#4A4A4A] px-3 py-1 rounded-full">
                    <Newspaper className="w-3 h-3 mr-1" />
                    {item.keyword}
                  </Badge>
                  <div className="flex gap-2">
                    {!item.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkRead(item.id)}
                        className="text-[#4A4A4A] hover:text-[#1A1A1A] text-sm"
                        data-testid={`mark-read-${item.id}`}
                      >
                        읽음
                      </Button>
                    )}
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#D86246] text-[#D86246] hover:bg-[#D86246] hover:text-white rounded-xl text-sm"
                          data-testid={`view-article-${item.id}`}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          보기
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
