from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, HTTPException, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import bcrypt
import jwt
import uuid
import secrets
import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_ALGORITHM = "HS256"

def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# App setup
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class InterestCreate(BaseModel):
    category: str  # youth_benefits, celebrity, company_news, product, custom
    keywords: List[str]
    description: Optional[str] = ""
    # 혜택/복지 카테고리 전용 필드
    gender: Optional[str] = None  # male, female, etc.
    age: Optional[int] = None
    residence: Optional[str] = None  # 거주지

class InterestUpdate(BaseModel):
    category: Optional[str] = None
    keywords: Optional[List[str]] = None
    description: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    residence: Optional[str] = None

class SourceCreate(BaseModel):
    name: str
    source_type: str  # naver_news, dart, startup, custom
    url: Optional[str] = ""
    enabled: bool = True

class NotificationRead(BaseModel):
    notification_ids: List[str]

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(data.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "email": email, "name": data.name, "role": "user"}

@api_router.post("/auth/login")
async def login(data: UserLogin, request: Request, response: Response):
    email = data.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    
    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.now(timezone.utc).isoformat() < locked_until:
            raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "email": email, "name": user.get("name", ""), "role": user.get("role", "user")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ==================== INTERESTS ROUTES ====================

@api_router.post("/interests")
async def create_interest(data: InterestCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "category": data.category,
        "keywords": data.keywords,
        "description": data.description or "",
        "gender": data.gender,
        "age": data.age,
        "residence": data.residence,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.interests.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/interests")
async def get_interests(user: dict = Depends(get_current_user)):
    interests = await db.interests.find({"user_id": user["_id"]}, {"_id": 0}).to_list(100)
    return interests

@api_router.put("/interests/{interest_id}")
async def update_interest(interest_id: str, data: InterestUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    result = await db.interests.update_one(
        {"id": interest_id, "user_id": user["_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Interest not found")
    updated = await db.interests.find_one({"id": interest_id}, {"_id": 0})
    return updated

@api_router.delete("/interests/{interest_id}")
async def delete_interest(interest_id: str, user: dict = Depends(get_current_user)):
    result = await db.interests.delete_one({"id": interest_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Interest not found")
    return {"message": "Deleted"}

# ==================== SOURCES ROUTES ====================

DEFAULT_SOURCES = [
    {"id": "naver_news", "name": "네이버 뉴스", "source_type": "naver_news", "url": "https://search.naver.com/search.naver", "enabled": True, "is_default": True},
    {"id": "google_news", "name": "구글 뉴스", "source_type": "google_news", "url": "https://news.google.com", "enabled": True, "is_default": True},
    {"id": "dart", "name": "DART (전자공시)", "source_type": "dart", "url": "https://dart.fss.or.kr", "enabled": False, "is_default": True},
    {"id": "youthcenter", "name": "온통청년", "source_type": "welfare", "url": "https://www.youthcenter.go.kr", "enabled": True, "is_default": True},
    {"id": "jobaba", "name": "잡아바 (경기도 일자리)", "source_type": "welfare", "url": "https://job.gg.go.kr", "enabled": True, "is_default": True},
    {"id": "gg_youth", "name": "경기청년포털", "source_type": "welfare", "url": "https://youth.gg.go.kr", "enabled": True, "is_default": True},
    {"id": "bokjiro", "name": "복지로", "source_type": "welfare", "url": "https://www.bokjiro.go.kr", "enabled": True, "is_default": True},
]

@api_router.get("/sources")
async def get_sources(user: dict = Depends(get_current_user)):
    user_sources = await db.sources.find({"user_id": user["_id"]}, {"_id": 0}).to_list(50)
    # 기본 소스가 누락되었으면 추가
    existing_ids = {s["id"] for s in user_sources}
    for src in DEFAULT_SOURCES:
        if src["id"] not in existing_ids:
            doc = {**src, "user_id": user["_id"]}
            await db.sources.insert_one(doc)
    if len(existing_ids) < len(DEFAULT_SOURCES):
        user_sources = await db.sources.find({"user_id": user["_id"]}, {"_id": 0}).to_list(50)
    return user_sources

@api_router.put("/sources/{source_id}")
async def toggle_source(source_id: str, user: dict = Depends(get_current_user)):
    source = await db.sources.find_one({"id": source_id, "user_id": user["_id"]})
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    new_enabled = not source.get("enabled", True)
    await db.sources.update_one(
        {"id": source_id, "user_id": user["_id"]},
        {"$set": {"enabled": new_enabled}}
    )
    return {"id": source_id, "enabled": new_enabled}

# ==================== FEED & SCRAPING ====================

async def scrape_naver_news(keywords: List[str]) -> List[dict]:
    results = []
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client_http:
        for keyword in keywords[:3]:
            try:
                url = f"https://m.search.naver.com/search.naver?where=m_news&query={keyword}&sm=mtb_jum"
                headers = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"}
                resp = await client_http.get(url, headers=headers)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    all_links = soup.find_all("a", href=True)
                    seen_titles = set()
                    for link in all_links:
                        href = link.get("href", "")
                        text = link.get_text(strip=True)
                        if ("n.news.naver.com/article" in href or "news.naver.com/article" in href) and len(text) > 15 and text not in seen_titles:
                            # Clean up text - remove source/time suffixes
                            clean_title = text
                            for suffix in ["네이버뉴스", "시간 전", "분 전", "일 전"]:
                                idx = clean_title.find(suffix)
                                if idx > 0:
                                    # Find the last Korean character before the suffix
                                    pass
                            seen_titles.add(text)
                            results.append({
                                "title": clean_title[:120],
                                "url": href,
                                "source": "Naver News",
                                "keyword": keyword,
                                "snippet": clean_title[:120]
                            })
                            if len(results) >= 5 * (keywords.index(keyword) + 1):
                                break
            except Exception as e:
                logger.error(f"Naver scraping error for {keyword}: {e}")
    return results

async def scrape_google_news(keywords: List[str]) -> List[dict]:
    results = []
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client_http:
        for keyword in keywords[:3]:
            try:
                url = f"https://news.google.com/rss/search?q={keyword}&hl=ko&gl=KR&ceid=KR:ko"
                resp = await client_http.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "lxml-xml")
                    items = soup.find_all("item")[:5]
                    for item in items:
                        title_tag = item.find("title")
                        link_tag = item.find("link")
                        title = title_tag.get_text(strip=True) if title_tag else ""
                        link = link_tag.get_text(strip=True) if link_tag else ""
                        if title:
                            results.append({
                                "title": title[:120],
                                "url": link,
                                "source": "Google News",
                                "keyword": keyword,
                                "snippet": title[:120]
                            })
            except Exception as e:
                logger.error(f"Google News scraping error for {keyword}: {e}")
    return results

async def scrape_welfare_sites(keywords: List[str], welfare_interests: List[dict]) -> List[dict]:
    """복지/혜택 사이트 스크래핑 (온통청년, 잡아바, 경기청년포털, 복지로)"""
    results = []
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    
    # 복지 관심사에서 성별/나이/거주지 추출
    profile_info = []
    for wi in welfare_interests:
        parts = []
        if wi.get("age"):
            parts.append(f"{wi['age']}세")
        if wi.get("gender"):
            gender_label = "남성" if wi["gender"] == "male" else "여성" if wi["gender"] == "female" else wi["gender"]
            parts.append(gender_label)
        if wi.get("residence"):
            parts.append(wi["residence"])
        if parts:
            profile_info.append(" ".join(parts))
    
    # 검색 키워드에 프로필 정보 결합
    search_terms = list(set(keywords))[:5]
    for info in profile_info:
        for kw in keywords[:3]:
            combined = f"{kw} {info}"
            if combined not in search_terms:
                search_terms.append(combined)
    search_terms = search_terms[:8]
    
    welfare_sites = [
        {"name": "온통청년", "base_url": "https://www.youthcenter.go.kr", "search_url": "https://www.youthcenter.go.kr/main.do"},
        {"name": "잡아바", "base_url": "https://job.gg.go.kr", "search_url": "https://job.gg.go.kr"},
        {"name": "경기청년포털", "base_url": "https://youth.gg.go.kr", "search_url": "https://youth.gg.go.kr"},
        {"name": "복지로", "base_url": "https://www.bokjiro.go.kr", "search_url": "https://www.bokjiro.go.kr"},
    ]
    
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client_http:
        # 1. 각 복지 사이트 메인 페이지에서 혜택 정보 스크래핑
        for site in welfare_sites:
            try:
                resp = await client_http.get(site["search_url"], headers=headers)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    # 일반적인 링크에서 혜택/정책 관련 텍스트 추출
                    all_links = soup.find_all("a", href=True)
                    benefit_keywords = ["지원", "혜택", "청년", "정책", "신청", "공고", "모집", "사업", "복지", "일자리", "취업", "창업"]
                    count = 0
                    seen = set()
                    for link in all_links:
                        text = link.get_text(strip=True)
                        href = link.get("href", "")
                        if len(text) > 10 and text not in seen and any(bk in text for bk in benefit_keywords):
                            full_url = href if href.startswith("http") else f"{site['base_url']}{href}"
                            seen.add(text)
                            results.append({
                                "title": text[:120],
                                "url": full_url,
                                "source": site["name"],
                                "keyword": "복지혜택",
                                "snippet": text[:120]
                            })
                            count += 1
                            if count >= 5:
                                break
            except Exception as e:
                logger.error(f"Welfare site scraping error for {site['name']}: {e}")
        
        # 2. 네이버에서 복지 키워드로 뉴스 검색
        for term in search_terms[:3]:
            try:
                welfare_query = f"{term} 청년 혜택 복지 지원"
                url = f"https://m.search.naver.com/search.naver?where=m_news&query={welfare_query}&sm=mtb_jum"
                resp = await client_http.get(url, headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"})
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    all_links = soup.find_all("a", href=True)
                    seen_titles = set()
                    count = 0
                    for link in all_links:
                        href_val = link.get("href", "")
                        text = link.get_text(strip=True)
                        if ("n.news.naver.com/article" in href_val) and len(text) > 15 and text not in seen_titles:
                            seen_titles.add(text)
                            results.append({
                                "title": text[:120],
                                "url": href_val,
                                "source": "복지 뉴스",
                                "keyword": term,
                                "snippet": text[:120]
                            })
                            count += 1
                            if count >= 3:
                                break
            except Exception as e:
                logger.error(f"Welfare news search error for {term}: {e}")
    
    return results
    return results

async def classify_with_ai(articles: List[dict], user_interests: List[dict]) -> List[dict]:
    if not articles:
        return []
    
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        for article in articles:
            article["ai_summary"] = article.get("snippet", article.get("title", ""))
            article["relevance"] = "medium"
        return articles
    
    interest_desc = "; ".join([
        f"{i['category']}: {', '.join(i['keywords'])}" +
        (f" (나이: {i.get('age')}세, 성별: {i.get('gender')}, 거주지: {i.get('residence')})" 
         if i.get('age') or i.get('gender') or i.get('residence') else "")
        for i in user_interests
    ])
    
    articles_text = "\n".join([
        f"[{idx+1}] {a['title']} (source: {a['source']}, keyword: {a['keyword']})"
        for idx, a in enumerate(articles[:20])
    ])
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"classify-{uuid.uuid4()}",
            system_message="You are an information classification assistant. Classify and summarize news articles based on user interests. Respond in Korean. For each article, provide a brief summary (1-2 sentences) and relevance (high/medium/low). Format: one line per article as JSON array."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""사용자 관심사: {interest_desc}

기사 목록:
{articles_text}

각 기사에 대해 사용자의 관심사(나이, 성별, 거주지 포함)에 맞는 관련도를 판단하고 한국어로 1-2문장 요약을 작성해주세요.
특히 복지/혜택 관련 기사는 사용자의 프로필(나이, 거주지 등)에 해당하는 혜택인지 판단하여 관련도를 높여주세요.
JSON 배열로 응답해주세요. 형식:
[{{"index": 1, "summary": "요약", "relevance": "high/medium/low"}}]"""
        
        user_msg = UserMessage(text=prompt)
        response = await chat.send_message(user_msg)
        
        import json
        # Try to parse the response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        classifications = json.loads(response_text)
        
        for cls in classifications:
            idx = cls.get("index", 0) - 1
            if 0 <= idx < len(articles):
                articles[idx]["ai_summary"] = cls.get("summary", articles[idx].get("title", ""))
                articles[idx]["relevance"] = cls.get("relevance", "medium")
        
        # Fill in any unclassified articles
        for article in articles:
            if "ai_summary" not in article:
                article["ai_summary"] = article.get("snippet", article.get("title", ""))
                article["relevance"] = "medium"
                
    except Exception as e:
        logger.error(f"AI classification error: {e}")
        for article in articles:
            if "ai_summary" not in article:
                article["ai_summary"] = article.get("snippet", article.get("title", ""))
                article["relevance"] = "medium"
    
    return articles

@api_router.get("/feed")
async def get_feed(user: dict = Depends(get_current_user)):
    # Get cached feed items
    feed_items = await db.feed_items.find(
        {"user_id": user["_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return feed_items

@api_router.post("/feed/refresh")
async def refresh_feed(user: dict = Depends(get_current_user)):
    interests = await db.interests.find({"user_id": user["_id"]}, {"_id": 0}).to_list(100)
    if not interests:
        return {"message": "관심사가 설정되지 않았습니다", "count": 0}
    
    sources = await db.sources.find({"user_id": user["_id"], "enabled": True}, {"_id": 0}).to_list(50)
    enabled_types = [s["source_type"] for s in sources]
    
    all_keywords = []
    welfare_keywords = []
    welfare_interests = []
    for interest in interests:
        kws = interest.get("keywords", [])
        all_keywords.extend(kws)
        if interest.get("category") == "youth_benefits":
            welfare_keywords.extend(kws)
            welfare_interests.append(interest)
    all_keywords = list(set(all_keywords))[:10]
    welfare_keywords = list(set(welfare_keywords))[:5]
    
    # 일반 키워드 (복지 제외)
    general_keywords = [k for k in all_keywords if k not in welfare_keywords] if welfare_keywords else all_keywords
    
    all_articles = []
    if "naver_news" in enabled_types and general_keywords:
        articles = await scrape_naver_news(general_keywords)
        all_articles.extend(articles)
    if "google_news" in enabled_types and general_keywords:
        articles = await scrape_google_news(general_keywords)
        all_articles.extend(articles)
    if "welfare" in enabled_types and welfare_keywords:
        articles = await scrape_welfare_sites(welfare_keywords, welfare_interests)
        all_articles.extend(articles)
    
    if not all_articles:
        return {"message": "기사를 찾을 수 없습니다", "count": 0}
    
    classified = await classify_with_ai(all_articles, interests)
    
    # Sort by relevance
    relevance_order = {"high": 0, "medium": 1, "low": 2}
    classified.sort(key=lambda x: relevance_order.get(x.get("relevance", "medium"), 1))
    
    # Store feed items
    now = datetime.now(timezone.utc).isoformat()
    feed_docs = []
    for article in classified:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "title": article.get("title", ""),
            "url": article.get("url", ""),
            "source": article.get("source", ""),
            "keyword": article.get("keyword", ""),
            "ai_summary": article.get("ai_summary", ""),
            "relevance": article.get("relevance", "medium"),
            "created_at": now,
            "is_read": False
        }
        feed_docs.append(doc)
    
    # Clear old feed and insert new
    await db.feed_items.delete_many({"user_id": user["_id"]})
    if feed_docs:
        await db.feed_items.insert_many(feed_docs)
    
    # Create notifications for high-relevance items
    high_items = [f for f in feed_docs if f["relevance"] == "high"]
    if high_items:
        notif_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "title": f"중요 정보 {len(high_items)}건이 업데이트되었습니다",
            "message": f"관심사에 맞는 {len(high_items)}건의 새로운 정보가 있습니다. 지금 확인해보세요!",
            "type": "feed_update",
            "is_read": False,
            "created_at": now
        }
        await db.notifications.insert_one(notif_doc)
    
    stored = await db.feed_items.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"message": f"{len(stored)}개의 기사를 찾았습니다", "count": len(stored), "items": stored}

@api_router.put("/feed/{item_id}/read")
async def mark_feed_read(item_id: str, user: dict = Depends(get_current_user)):
    await db.feed_items.update_one(
        {"id": item_id, "user_id": user["_id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

# ==================== NOTIFICATIONS ====================

@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    notifs = await db.notifications.find(
        {"user_id": user["_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifs

@api_router.get("/notifications/unread-count")
async def get_unread_count(user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user["_id"], "is_read": False})
    return {"count": count}

@api_router.put("/notifications/read")
async def mark_notifications_read(data: NotificationRead, user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"id": {"$in": data.notification_ids}, "user_id": user["_id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["_id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All marked as read"}

# ==================== PROFILE ====================

class ProfileUpdate(BaseModel):
    name: Optional[str] = None

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": update_data}
    )
    updated = await db.users.find_one({"_id": ObjectId(user["_id"])})
    updated["_id"] = str(updated["_id"])
    updated.pop("password_hash", None)
    return updated

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.interests.create_index("user_id")
    await db.feed_items.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info("Admin password updated")
    
    # Write test credentials
    creds_path = Path("/app/memory/test_credentials.md")
    creds_path.parent.mkdir(parents=True, exist_ok=True)
    creds_path.write_text(f"""# Test Credentials
## Admin
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
""")

app.include_router(api_router)

cors_origins_raw = os.environ.get("CORS_ORIGINS", "*")
if cors_origins_raw == "*":
    cors_origins = ["*"]
else:
    cors_origins = [o.strip() for o in cors_origins_raw.split(",")]
frontend_url = os.environ.get("FRONTEND_URL", "")
if frontend_url and frontend_url not in cors_origins and cors_origins != ["*"]:
    cors_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
