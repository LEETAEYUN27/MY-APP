import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Plus, X, Trash2, Tag, Heart, Building2, ShoppingBag, Users, Sparkles } from "lucide-react";

const CATEGORIES = [
  { id: "youth_benefits", label: "청년 혜택/복지", icon: Users, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "celebrity", label: "연예인/유명인", icon: Heart, color: "bg-pink-100 text-pink-700 border-pink-200" },
  { id: "company_news", label: "기업소식", icon: Building2, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "product", label: "상품/제품", icon: ShoppingBag, color: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "custom", label: "기타", icon: Sparkles, color: "bg-purple-100 text-purple-700 border-purple-200" },
];

export default function InterestsPage() {
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [residence, setResidence] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchInterests = useCallback(async () => {
    try {
      const { data } = await api.get("/interests");
      setInterests(data);
    } catch (err) {
      console.error("관심사 가져오기 오류:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (kw) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!selectedCategory) {
      setError("카테고리를 선택해주세요.");
      return;
    }
    if (keywords.length === 0) {
      setError("키워드를 최소 1개 이상 추가해주세요.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/interests", {
        category: selectedCategory,
        keywords,
        description,
        gender: selectedCategory === "youth_benefits" ? gender || null : null,
        age: selectedCategory === "youth_benefits" && age ? parseInt(age) : null,
        residence: selectedCategory === "youth_benefits" ? residence || null : null,
      });
      setShowForm(false);
      setSelectedCategory("");
      setKeywords([]);
      setKeywordInput("");
      setDescription("");
      setGender("");
      setAge("");
      setResidence("");
      fetchInterests();
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/interests/${id}`);
      setInterests(interests.filter((i) => i.id !== id));
    } catch (err) {
      console.error("삭제 오류:", err);
    }
  };

  const getCategoryInfo = (catId) => CATEGORIES.find((c) => c.id === catId) || CATEGORIES[4];

  return (
    <div className="space-y-6" data-testid="interests-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
            내 관심사
          </h1>
          <p className="text-base md:text-lg text-[#4A4A4A] mt-1">
            키워드를 설정하여 맞춤형 정보를 받아보세요
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="min-h-[56px] px-6 text-lg font-semibold bg-[#D86246] hover:bg-[#C25238] text-white rounded-2xl transition-transform duration-200 active:scale-95"
          data-testid="add-interest-button"
        >
          <Plus className="w-5 h-5 mr-2" />
          관심사 추가
        </Button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <Card className="bg-white border-[#EAE6DF] rounded-2xl shadow-sm animate-fade-in-up" data-testid="interest-form">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
              새 관심사 등록
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base" data-testid="interest-form-error">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-base font-medium text-[#1A1A1A]">카테고리</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 min-h-[56px] ${
                          selectedCategory === cat.id
                            ? "border-[#D86246] bg-[#D86246]/5"
                            : "border-[#EAE6DF] bg-white hover:border-[#D4CFC7]"
                        }`}
                        data-testid={`category-${cat.id}`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-base font-medium">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium text-[#1A1A1A]">키워드</Label>
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="키워드 입력 후 Enter"
                    className="min-h-[56px] text-lg border-[#EAE6DF] rounded-xl flex-1"
                    data-testid="keyword-input"
                  />
                  <Button
                    type="button"
                    onClick={addKeyword}
                    className="min-h-[56px] px-5 bg-[#718F7B] hover:bg-[#5D7765] text-white rounded-xl"
                    data-testid="add-keyword-button"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {keywords.map((kw) => (
                      <Badge
                        key={kw}
                        className="text-base px-4 py-2 bg-[#EAE6DF] text-[#1A1A1A] rounded-full flex items-center gap-2"
                      >
                        <Tag className="w-3 h-3" />
                        {kw}
                        <button type="button" onClick={() => removeKeyword(kw)} className="ml-1 hover:text-[#D86246]">
                          <X className="w-4 h-4" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium text-[#1A1A1A]">설명 (선택사항)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="어떤 종류의 정보를 원하시는지 설명해주세요..."
                  className="min-h-[80px] text-lg border-[#EAE6DF] rounded-xl"
                  data-testid="description-input"
                />
              </div>

              {selectedCategory === "youth_benefits" && (
                <div className="space-y-4 p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl" data-testid="welfare-profile-section">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-5 h-5 text-blue-600" />
                    <Label className="text-base font-bold text-blue-800">맞춤형 혜택을 위한 개인정보</Label>
                  </div>
                  <p className="text-sm text-blue-600 mb-2">
                    정확한 맞춤형 혜택 정보를 제공하기 위해 아래 정보를 입력해주세요.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base font-medium text-[#1A1A1A]">성별</Label>
                      <div className="flex gap-2">
                        {[
                          { value: "male", label: "남성" },
                          { value: "female", label: "여성" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setGender(opt.value)}
                            className={`flex-1 min-h-[48px] px-4 rounded-xl border-2 text-base font-medium transition-all ${
                              gender === opt.value
                                ? "border-blue-500 bg-blue-100 text-blue-700"
                                : "border-[#EAE6DF] bg-white text-[#4A4A4A] hover:border-blue-300"
                            }`}
                            data-testid={`gender-${opt.value}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base font-medium text-[#1A1A1A]">나이</Label>
                      <Input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="예: 27"
                        className="min-h-[48px] text-lg border-[#EAE6DF] rounded-xl"
                        data-testid="age-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base font-medium text-[#1A1A1A]">거주지</Label>
                      <Input
                        value={residence}
                        onChange={(e) => setResidence(e.target.value)}
                        placeholder="예: 경기도 동탄"
                        className="min-h-[48px] text-lg border-[#EAE6DF] rounded-xl"
                        data-testid="residence-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={saving}
                  className="min-h-[56px] px-8 text-lg bg-[#D86246] hover:bg-[#C25238] text-white rounded-2xl flex-1"
                  data-testid="save-interest-button"
                >
                  {saving ? "저장 중..." : "관심사 저장"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="min-h-[56px] px-6 text-lg border-[#EAE6DF] text-[#4A4A4A] rounded-2xl"
                  data-testid="cancel-interest-button"
                >
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 관심사 목록 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="bg-white border-[#EAE6DF] rounded-2xl">
              <CardContent className="p-6">
                <div className="h-6 w-1/3 bg-[#EAE6DF] rounded animate-pulse mb-3" />
                <div className="h-4 w-2/3 bg-[#EAE6DF] rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : interests.length === 0 && !showForm ? (
        <Card className="bg-white border-[#EAE6DF] rounded-2xl" data-testid="empty-interests">
          <CardContent className="p-12 text-center">
            <Tag className="w-16 h-16 text-[#D4CFC7] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2" style={{ fontFamily: 'Work Sans' }}>
              아직 관심사가 없습니다
            </h3>
            <p className="text-base text-[#4A4A4A] mb-6">
              첫 번째 관심사를 추가하여 맞춤형 정보를 받아보세요.
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="min-h-[56px] px-8 text-lg bg-[#D86246] hover:bg-[#C25238] text-white rounded-2xl"
              data-testid="empty-add-interest-button"
            >
              <Plus className="w-5 h-5 mr-2" />
              첫 관심사 추가하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {interests.map((interest, idx) => {
            const catInfo = getCategoryInfo(interest.category);
            const Icon = catInfo.icon;
            return (
              <Card
                key={interest.id}
                className="bg-white border-[#EAE6DF] rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-1 animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
                data-testid={`interest-card-${interest.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${catInfo.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-lg font-bold text-[#1A1A1A]" style={{ fontFamily: 'Work Sans' }}>
                        {catInfo.label}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(interest.id)}
                      className="text-[#4A4A4A] hover:text-red-600 hover:bg-red-50 rounded-xl"
                      data-testid={`delete-interest-${interest.id}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {interest.keywords.map((kw) => (
                      <Badge key={kw} className="text-sm px-3 py-1 bg-[#EAE6DF] text-[#4A4A4A] rounded-full">
                        {kw}
                      </Badge>
                    ))}
                  </div>

                  {interest.description && (
                    <p className="text-base text-[#4A4A4A] leading-relaxed">{interest.description}</p>
                  )}

                  {(interest.gender || interest.age || interest.residence) && (
                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-[#EAE6DF]">
                      {interest.gender && (
                        <Badge className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-200">
                          {interest.gender === "male" ? "남성" : interest.gender === "female" ? "여성" : interest.gender}
                        </Badge>
                      )}
                      {interest.age && (
                        <Badge className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-200">
                          {interest.age}세
                        </Badge>
                      )}
                      {interest.residence && (
                        <Badge className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-200">
                          {interest.residence}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
