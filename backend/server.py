from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# LLM Config
EMERGENT_LLM_KEY = os.getenv('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== Models ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    password_hash: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserRegister(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    user: Dict[str, Any]

class Page(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str = "Untitled"
    icon: Optional[str] = "📄"
    parent_id: Optional[str] = None
    state: str = "germinating"  # germinating, active, cooling, crystallized, turbulent
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_viewed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PageCreate(BaseModel):
    title: str = "Untitled"
    icon: Optional[str] = "📄"
    parent_id: Optional[str] = None
    state: Optional[str] = "germinating"

class PageUpdate(BaseModel):
    title: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[str] = None
    state: Optional[str] = None

class Block(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    page_id: str
    type: str
    content: Any
    order: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BlockCreate(BaseModel):
    page_id: str
    type: str
    content: Any
    order: int

class BlockUpdate(BaseModel):
    type: Optional[str] = None
    content: Optional[Any] = None
    order: Optional[int] = None

class AIRequest(BaseModel):
    prompt: str
    action: str  # complete, improve, summarize, query

class AIResponse(BaseModel):
    result: str

class SemanticSearchRequest(BaseModel):
    query: str

class RelatedPage(BaseModel):
    page: Page
    relevance: float
    reason: str

# ==================== Auth Helpers ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== Routes ====================

@api_router.get("/")
async def root():
    return {"message": "Notex API - Intuitive Workspace"}

# Auth Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=data.email,
        name=data.name,
        password_hash=hash_password(data.password)
    )
    
    await db.users.insert_one(user.model_dump())
    token = create_token(user.id)
    
    return TokenResponse(
        token=token,
        user={"id": user.id, "email": user.email, "name": user.name}
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'])
    
    return TokenResponse(
        token=token,
        user={"id": user['id'], "email": user['email'], "name": user['name']}
    )

@api_router.get("/auth/me")
async def get_me(user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Page Routes
@api_router.post("/pages", response_model=Page)
async def create_page(data: PageCreate, user_id: str = Depends(get_current_user)):
    page = Page(user_id=user_id, **data.model_dump())
    await db.pages.insert_one(page.model_dump())
    return page

@api_router.get("/pages", response_model=List[Page])
async def get_pages(user_id: str = Depends(get_current_user)):
    pages = await db.pages.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return pages

@api_router.get("/pages/{page_id}", response_model=Page)
async def get_page(page_id: str, user_id: str = Depends(get_current_user)):
    page = await db.pages.find_one({"id": page_id, "user_id": user_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Update last_viewed_at
    await db.pages.update_one(
        {"id": page_id},
        {"$set": {"last_viewed_at": datetime.now(timezone.utc).isoformat()}}
    )
    page['last_viewed_at'] = datetime.now(timezone.utc).isoformat()
    
    return page

@api_router.patch("/pages/{page_id}", response_model=Page)
async def update_page(page_id: str, data: PageUpdate, user_id: str = Depends(get_current_user)):
    page = await db.pages.find_one({"id": page_id, "user_id": user_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.pages.update_one({"id": page_id}, {"$set": update_data})
    
    updated_page = await db.pages.find_one({"id": page_id}, {"_id": 0})
    return updated_page

@api_router.delete("/pages/{page_id}")
async def delete_page(page_id: str, user_id: str = Depends(get_current_user)):
    page = await db.pages.find_one({"id": page_id, "user_id": user_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Soft delete - mark as dissolved
    await db.pages.update_one(
        {"id": page_id},
        {"$set": {
            "dissolved_at": datetime.now(timezone.utc).isoformat(),
            "state": "dissolved"
        }}
    )
    
    return {"message": "Page dissolved"}

@api_router.post("/pages/{page_id}/restore")
async def restore_page(page_id: str, user_id: str = Depends(get_current_user)):
    page = await db.pages.find_one({"id": page_id, "user_id": user_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    await db.pages.update_one(
        {"id": page_id},
        {"$unset": {"dissolved_at": ""}, "$set": {"state": "active"}}
    )
    
    return {"message": "Page restored"}

@api_router.get("/pages/dissolved/list", response_model=List[Page])
async def get_dissolved_pages(user_id: str = Depends(get_current_user)):
    pages = await db.pages.find(
        {"user_id": user_id, "dissolved_at": {"$exists": True}},
        {"_id": 0}
    ).to_list(1000)
    return pages

# Block Routes
@api_router.post("/blocks", response_model=Block)
async def create_block(data: BlockCreate, user_id: str = Depends(get_current_user)):
    page = await db.pages.find_one({"id": data.page_id, "user_id": user_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    block = Block(**data.model_dump())
    await db.blocks.insert_one(block.model_dump())
    
    # Update page's updated_at and suggest state change
    await db.pages.update_one(
        {"id": data.page_id},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return block

@api_router.get("/blocks/{page_id}", response_model=List[Block])
async def get_blocks(page_id: str, user_id: str = Depends(get_current_user)):
    page = await db.pages.find_one({"id": page_id, "user_id": user_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    blocks = await db.blocks.find({"page_id": page_id}, {"_id": 0}).sort("order", 1).to_list(1000)
    return blocks

@api_router.patch("/blocks/{block_id}", response_model=Block)
async def update_block(block_id: str, data: BlockUpdate, user_id: str = Depends(get_current_user)):
    block = await db.blocks.find_one({"id": block_id}, {"_id": 0})
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    
    page = await db.pages.find_one({"id": block['page_id'], "user_id": user_id})
    if not page:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.blocks.update_one({"id": block_id}, {"$set": update_data})
    await db.pages.update_one(
        {"id": block['page_id']},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_block = await db.blocks.find_one({"id": block_id}, {"_id": 0})
    return updated_block

@api_router.delete("/blocks/{block_id}")
async def delete_block(block_id: str, user_id: str = Depends(get_current_user)):
    block = await db.blocks.find_one({"id": block_id}, {"_id": 0})
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    
    page = await db.pages.find_one({"id": block['page_id'], "user_id": user_id})
    if not page:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    await db.blocks.delete_one({"id": block_id})
    return {"message": "Block deleted"}

# AI Routes
@api_router.post("/ai/assist", response_model=AIResponse)
async def ai_assist(data: AIRequest, user_id: str = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"user_{user_id}",
            system_message="You are a helpful writing assistant. Provide clear, concise responses."
        ).with_model("openai", "gpt-4o")
        
        if data.action == "complete":
            prompt = f"Continue this text naturally: {data.prompt}"
        elif data.action == "improve":
            prompt = f"Improve and refine this text: {data.prompt}"
        elif data.action == "summarize":
            prompt = f"Summarize this text: {data.prompt}"
        else:
            prompt = data.prompt
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return AIResponse(result=response)
    except Exception as e:
        logging.error(f"AI assist error: {str(e)}")
        raise HTTPException(status_code=500, detail="AI service error")

# AI Steward Routes
@api_router.post("/steward/capture")
async def steward_capture(data: dict, user_id: str = Depends(get_current_user)):
    """Keeper role: capture and title notes"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        body = data.get("body", "")
        
        # Ask AI to suggest title and tags
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"steward_{user_id}",
            system_message="You are a gentle AI steward helping organize thoughts. Suggest concise titles (3-5 words) and 1-3 relevant tags."
        ).with_model("openai", "gpt-4o")
        
        prompt = f"Content: {body[:200]}...\n\nSuggest a concise title and 1-3 tags. Format: Title: [title]\\nTags: [tag1, tag2]"
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response
        lines = response.split('\n')
        title = "Untitled"
        tags = []
        
        for line in lines:
            if line.startswith("Title:"):
                title = line.replace("Title:", "").strip()
            elif line.startswith("Tags:"):
                tags_str = line.replace("Tags:", "").strip()
                tags = [t.strip() for t in tags_str.split(',')]
        
        return {"title": title, "tags": tags, "body": body}
    except Exception as e:
        logging.error(f"Steward capture error: {str(e)}")
        return {"title": "Untitled", "tags": [], "body": body}

@api_router.post("/steward/session-summary")
async def steward_session_summary(user_id: str = Depends(get_current_user)):
    """Rhythmer role: generate session recap"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        # Get recent pages edited in this session (last 2 hours)
        two_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        recent_pages = await db.pages.find(
            {
                "user_id": user_id,
                "updated_at": {"$gte": two_hours_ago},
                "dissolved_at": {"$exists": False}
            },
            {"_id": 0}
        ).to_list(10)
        
        if not recent_pages:
            return {"summary": "Quiet session. No changes recorded.", "next_step": "Begin when ready."}
        
        # Generate summary
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"rhythmer_{user_id}",
            system_message="You are a gentle AI rhythmer. Summarize work sessions in 1-2 sentences and suggest one clear next step."
        ).with_model("openai", "gpt-4o")
        
        pages_context = "\n".join([f"- {p['title']} ({p.get('state', 'unknown')} state)" for p in recent_pages])
        prompt = f"Session work:\n{pages_context}\n\nProvide: 1) Brief summary (1-2 sentences) 2) One actionable next step\n\nFormat:\nSummary: [summary]\nNext: [next step]"
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response
        lines = response.split('\n')
        summary = ""
        next_step = ""
        
        for line in lines:
            if line.startswith("Summary:"):
                summary = line.replace("Summary:", "").strip()
            elif line.startswith("Next:"):
                next_step = line.replace("Next:", "").strip()
        
        return {
            "summary": summary or "Work in progress.",
            "next_step": next_step or "Continue where you left off.",
            "pages_touched": len(recent_pages)
        }
    except Exception as e:
        logging.error(f"Session summary error: {str(e)}")
        return {"summary": "Session in progress.", "next_step": "Keep going."}

@api_router.post("/steward/detect-intent")
async def steward_detect_intent(data: dict, user_id: str = Depends(get_current_user)):
    """Detect natural language intent from text"""
    if not EMERGENT_LLM_KEY:
        return {"intent": "file", "confidence": 0}
    
    try:
        text = data.get("text", "")
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"intent_{user_id}",
            system_message="Detect user intent from text. Return only: file, link, schedule, or defer"
        ).with_model("openai", "gpt-4o")
        
        prompt = f"Text: '{text}'\n\nWhat is the intent? Choose one: file (store/save), link (connect), schedule (remind/later), defer (park/hold). Return only the intent word."
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        intent = response.strip().lower()
        if intent not in ["file", "link", "schedule", "defer"]:
            intent = "file"
        
        return {"intent": intent, "text": text}
    except Exception as e:
        logging.error(f"Intent detection error: {str(e)}")
        return {"intent": "file", "text": text}

# Semantic Search
@api_router.post("/ai/search")
async def semantic_search(data: SemanticSearchRequest, user_id: str = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        # Get all user's pages
        pages = await db.pages.find(
            {"user_id": user_id, "dissolved_at": {"$exists": False}},
            {"_id": 0}
        ).to_list(1000)
        
        if not pages:
            return {"results": []}
        
        # Get blocks for each page
        pages_with_content = []
        for page in pages:
            blocks = await db.blocks.find({"page_id": page['id']}, {"_id": 0}).to_list(1000)
            content = " ".join([str(b.get('content', '')) for b in blocks if b.get('content')])
            pages_with_content.append({
                "page": page,
                "content": content[:500]  # Limit content length
            })
        
        # Use AI to find relevant pages
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"search_{user_id}",
            system_message="You are a semantic search assistant. Analyze pages and find the most relevant ones based on the query. Return a JSON array with page IDs and relevance scores."
        ).with_model("openai", "gpt-4o")
        
        pages_context = "\n".join([
            f"Page: {p['page']['title']} (ID: {p['page']['id']}, State: {p['page'].get('state', 'unknown')})\nContent: {p['content'][:200]}..."
            for p in pages_with_content[:10]  # Limit to 10 pages for context
        ])
        
        prompt = f"Query: {data.query}\n\nPages:\n{pages_context}\n\nReturn the top 3 most relevant page IDs with brief reasons why they match the query."
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {"results": response, "total_pages": len(pages)}
    except Exception as e:
        logging.error(f"Semantic search error: {str(e)}")
        raise HTTPException(status_code=500, detail="Search service error")

# Related Pages (Resonance)
@api_router.get("/pages/{page_id}/related")
async def get_related_pages(page_id: str, user_id: str = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        return {"related": []}
    
    try:
        # Get current page
        current_page = await db.pages.find_one({"id": page_id, "user_id": user_id}, {"_id": 0})
        if not current_page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        current_blocks = await db.blocks.find({"page_id": page_id}, {"_id": 0}).to_list(1000)
        current_content = " ".join([str(b.get('content', '')) for b in current_blocks if b.get('content')])
        
        # Get other pages
        other_pages = await db.pages.find(
            {"user_id": user_id, "id": {"$ne": page_id}, "dissolved_at": {"$exists": False}},
            {"_id": 0}
        ).limit(20).to_list(20)
        
        if not other_pages:
            return {"related": []}
        
        # Use AI to find related pages
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"related_{user_id}",
            system_message="Find semantically related pages based on content similarity."
        ).with_model("openai", "gpt-4o")
        
        pages_list = "\n".join([f"- {p['title']} (ID: {p['id']})" for p in other_pages])
        prompt = f"Current page: {current_page['title']}\nContent: {current_content[:300]}\n\nOther pages:\n{pages_list}\n\nWhich 3 pages are most related? Return just the page titles."
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {"related": response, "analyzed": len(other_pages)}
    except Exception as e:
        logging.error(f"Related pages error: {str(e)}")
        return {"related": [], "error": str(e)}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()