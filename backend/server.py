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
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7

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

class Node(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    content: str = ""
    type: str = "thought"  # thought, project, ritual, pattern
    tags: List[str] = []
    linked_ids: List[str] = []
    position: Dict[str, float] = {"x": 0, "y": 0}
    frequency: str = "reflect"  # focus, dream, reflect, synthesize
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ConversationInput(BaseModel):
    text: str
    current_frequency: str = "reflect"

class StructureResponse(BaseModel):
    action: str  # create, link, modify, archive
    nodes: List[Node] = []
    links: List[Dict[str, str]] = []
    message: str = ""

class PatternInsight(BaseModel):
    pattern: str
    confidence: float
    suggestion: str

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

# ==================== Auth Routes ====================

@api_router.get("/")
async def root():
    return {"message": "Conversational workspace API"}

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

# ==================== Conversational Builder ====================

@api_router.post("/converse")
async def converse(data: ConversationInput, user_id: str = Depends(get_current_user)):
    """Natural language → structure generation"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"builder_{user_id}",
            system_message="""You are a cognitive steward that interprets natural language into structural actions.
            
When the user speaks, determine:
1. Action type: create (new node), link (connect existing), modify (update), archive (pause)
2. Node details: title, type (thought/project/ritual/pattern), tags
3. Links: which nodes should connect
4. Response: brief, invitational confirmation

Return JSON:
{
  "action": "create|link|modify|archive",
  "nodes": [{"title": "...", "type": "...", "tags": [...]}],
  "links": [{"from": "title1", "to": "title2"}],
  "message": "brief confirmation"
}

Examples:
- "start mapping ritual systems" → create node titled "Ritual Mapping", type: project, tags: [ritual, systems]
- "link that with dopamine thread" → link nodes, message: "Connected"
- "pause this branch" → archive node
"""
        ).with_model("openai", "gpt-4o")
        
        prompt = f"Frequency: {data.current_frequency}\nUser: {data.text}\n\nInterpret and respond with JSON."
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse AI response
        try:
            structure = json.loads(response)
        except:
            # Fallback if AI doesn't return JSON
            structure = {
                "action": "create",
                "nodes": [{"title": data.text[:50], "type": "thought", "tags": []}],
                "links": [],
                "message": "Captured"
            }
        
        # Execute structure changes
        created_nodes = []
        for node_data in structure.get("nodes", []):
            node = Node(
                user_id=user_id,
                title=node_data.get("title", "Untitled"),
                type=node_data.get("type", "thought"),
                tags=node_data.get("tags", []),
                frequency=data.current_frequency,
                position={"x": len(created_nodes) * 200, "y": 100}
            )
            await db.nodes.insert_one(node.model_dump())
            created_nodes.append(node)
        
        # Log pattern for rhythm tracking
        await db.patterns.insert_one({
            "user_id": user_id,
            "frequency": data.current_frequency,
            "action": structure.get("action"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "action": structure.get("action"),
            "nodes": [n.model_dump() for n in created_nodes],
            "links": structure.get("links", []),
            "message": structure.get("message", "Done")
        }
    except Exception as e:
        logging.error(f"Converse error: {str(e)}")
        raise HTTPException(status_code=500, detail="Conversation failed")

# ==================== Node Management ====================

@api_router.get("/nodes")
async def get_nodes(user_id: str = Depends(get_current_user)):
    nodes = await db.nodes.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return nodes

@api_router.get("/nodes/{frequency}")
async def get_nodes_by_frequency(frequency: str, user_id: str = Depends(get_current_user)):
    nodes = await db.nodes.find(
        {"user_id": user_id, "frequency": frequency},
        {"_id": 0}
    ).to_list(1000)
    return nodes

@api_router.patch("/nodes/{node_id}")
async def update_node(node_id: str, updates: dict, user_id: str = Depends(get_current_user)):
    node = await db.nodes.find_one({"id": node_id, "user_id": user_id})
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    updates['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.nodes.update_one({"id": node_id}, {"$set": updates})
    
    updated = await db.nodes.find_one({"id": node_id}, {"_id": 0})
    return updated

# ==================== Pattern Recognition ====================

@api_router.get("/patterns/insights")
async def get_pattern_insights(user_id: str = Depends(get_current_user)):
    """Analyze user's creative rhythms"""
    if not EMERGENT_LLM_KEY:
        return {"insights": []}
    
    try:
        # Get recent pattern history
        patterns = await db.patterns.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(50).to_list(50)
        
        if len(patterns) < 5:
            return {"insights": []}
        
        # Ask AI to identify patterns
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"pattern_{user_id}",
            system_message="You identify creative rhythms and patterns. Be concise and insightful."
        ).with_model("openai", "gpt-4o")
        
        pattern_summary = "\n".join([
            f"{p['frequency']} → {p['action']}" for p in patterns[:20]
        ])
        
        prompt = f"Recent activity:\n{pattern_summary}\n\nWhat patterns emerge? What does this suggest about their creative rhythm? Be specific and brief."
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {"insights": [response]}
    except Exception as e:
        logging.error(f"Pattern insight error: {str(e)}")
        return {"insights": []}

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