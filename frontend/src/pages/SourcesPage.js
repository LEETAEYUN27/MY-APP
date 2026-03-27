import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Globe, Newspaper, FileText, Database } from "lucide-react";

const SOURCE_ICONS = {
  naver_news: Newspaper,
  google_news: Globe,
  dart: FileText,
  custom: Database,
};

const SOURCE_DESCRIPTIONS = {
  naver_news: "네이버 뉴스에서 최신 뉴스를 가져옵니다",
  google_news: "구글 뉴스 한국판에서 최신 뉴스를 가져옵니다",
  dart: "DART 전자공시시스템에서 기업 공시정보를 가져옵니다",
};

export default function SourcesPage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSources = useCallback(async () => {
    try {
      const { data } = await api.get("/sources");
      setSources(data);
    } catch (err) {
      console.error("소스 가져오기 오류:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const toggleSource = async (sourceId) => {
    try {
      const { data } = await api.put(`/sources/${sourceId}`);
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, enabled: data.enabled } : s))
      );
    } catch (err) {
      console.error("소스 토글 오류:", err);
    }
  };

  return (
    <div className="space-y-6" data-testid="sources-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
          정보 소스 설정
        </h1>
        <p className="text-base md:text-lg text-[#4A4A4A] mt-1">
          피드에 사용할 정보 소스를 활성화하거나 비활성화하세요
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white border-[#EAE6DF] rounded-2xl">
              <CardContent className="p-6">
                <div className="h-6 w-1/3 bg-[#EAE6DF] rounded animate-pulse mb-2" />
                <div className="h-4 w-2/3 bg-[#EAE6DF] rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source, idx) => {
            const Icon = SOURCE_ICONS[source.source_type] || Globe;
            return (
              <Card
                key={source.id}
                className="bg-white border-[#EAE6DF] rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-1 animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
                data-testid={`source-card-${source.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${source.enabled ? "bg-[#718F7B] text-white" : "bg-[#EAE6DF] text-[#4A4A4A]"} transition-colors duration-200`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
                          {source.name}
                        </h3>
                        <p className="text-base text-[#4A4A4A]">
                          {SOURCE_DESCRIPTIONS[source.source_type] || source.url || "사용자 정의 소스"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label htmlFor={`source-${source.id}`} className="text-base text-[#4A4A4A]">
                        {source.enabled ? "활성" : "비활성"}
                      </Label>
                      <Switch
                        id={`source-${source.id}`}
                        checked={source.enabled}
                        onCheckedChange={() => toggleSource(source.id)}
                        className="data-[state=checked]:bg-[#718F7B]"
                        data-testid={`source-toggle-${source.id}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
