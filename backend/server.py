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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PageCreate(BaseModel):
    title: str = "Untitled"
    icon: Optional[str] = "📄"
    parent_id: Optional[str] = None

class PageUpdate(BaseModel):
    title: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[str] = None

class Block(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    page_id: str
    type: str  # paragraph, heading1, heading2, heading3, bulletList, numberedList, todo, code, image, divider, table
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
    action: str  # complete, improve, summarize

class AIResponse(BaseModel):
    result: str

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
    return {"message": "Notion-like API"}

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
    
    # Delete page and its blocks
    await db.pages.delete_one({"id": page_id})
    await db.blocks.delete_many({"page_id": page_id})
    
    # Delete child pages recursively
    child_pages = await db.pages.find({"parent_id": page_id}, {"_id": 0}).to_list(1000)
    for child in child_pages:
        await delete_page(child['id'], user_id)
    
    return {"message": "Page deleted"}

# Block Routes
@api_router.post("/blocks", response_model=Block)
async def create_block(data: BlockCreate, user_id: str = Depends(get_current_user)):
    page = await db.pages.find_one({"id": data.page_id, "user_id": user_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    block = Block(**data.model_dump())
    await db.blocks.insert_one(block.model_dump())
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