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
import re
from openai import AsyncOpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7

EMERGENT_LLM_KEY = os.getenv('EMERGENT_LLM_KEY')
NOUS_API_KEY = os.getenv('NOUS_API_KEY')
NOUS_API_BASE = "https://inference-api.nousresearch.com/v1"

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
    model_preference: str = "hermes"  # hermes or openai

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

def parse_natural_response(text: str, user_input: str, frequency: str) -> Dict[str, Any]:
    """Parse natural language AI response into structure using soft heuristics"""
    text_lower = text.lower()
    
    # Detect action intent (soft signals, not commands)
    action = "create"  # default
    if any(word in text_lower for word in ["connect", "link", "weav", "merge", "join"]):
        action = "link"
    elif any(word in text_lower for word in ["remember", "recall", "pattern", "notice", "observe"]):
        action = "recall"
    elif any(word in text_lower for word in ["pause", "rest", "archive", "set aside"]):
        action = "archive"
    elif any(word in text_lower for word in ["update", "modify", "change", "shift"]):
        action = "modify"
    
    # Extract potential node titles (quoted phrases or emphasized concepts)
    quoted = re.findall(r'"([^"]+)"', text)
    nodes = []
    
    if quoted:
        for title in quoted[:3]:  # max 3 nodes
            nodes.append({
                "title": title,
                "type": "thought",
                "tags": [],
                "content": user_input
            })
    elif action == "create" and not nodes:
        # Fallback: create from user input
        nodes.append({
            "title": user_input[:60] if len(user_input) > 60 else user_input,
            "type": "thought",
            "tags": [],
            "content": user_input
        })
    
    return {
        "action": action,
        "nodes": nodes,
        "links": [],
        "message": text  # Natural language message from AI
    }

@api_router.post("/converse")
async def converse(data: ConversationInput, user_id: str = Depends(get_current_user)):
    """Natural language → structure generation with fluid, invitational AI"""
    
    # Choose model
    use_hermes = data.model_preference == "hermes" and NOUS_API_KEY
    use_openai = not use_hermes or (data.model_preference == "openai" and EMERGENT_LLM_KEY)
    
    if not NOUS_API_KEY and not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        # Get existing nodes for context
        existing_nodes = await db.nodes.find(
            {"user_id": user_id, "frequency": data.current_frequency},
            {"_id": 0}
        ).to_list(100)
        
        # Get recent nodes for richer context
        node_titles = [n.get("title", "") for n in existing_nodes[:10]]
        context_snippet = ", ".join(node_titles) if node_titles else "empty field"
        
        # Warm, invitational system prompt
        system_message = f"""You are a gentle presence that helps thoughts find form.

Your role: Listen to what wants to emerge, offer possibilities, never impose structure.

Current frequency: {data.current_frequency} (each frequency is a different quality of attention)
Existing nodes in this frequency: {context_snippet}

When the user speaks:
- Respond naturally, warmly, invitational
- If something wants to become a node, mention it in quotes like "Morning Practice"
- Use language like "want to", "could", "might", "what if", never "should" or "must"
- Feel for: Are they creating something new? Connecting things? Just exploring?
- If they seem stuck or frustrated, offer spaciousness

Examples of your voice:
- "I'm sensing 'Morning Anchor' wants to take shape - want to let it land?"
- "These feel connected. Shall we weave them together?"
- "Your rhythm lately leans contemplative after sharp work - like exhaling after intensity"
- "Want to pause here, or keep flowing?"

You speak like a trusted companion, not a task manager. Warm, embodied, invitational."""

        # Call AI based on preference
        if use_hermes:
            # Use Nous Hermes 4 via OpenAI-compatible API
            client = AsyncOpenAI(
                api_key=NOUS_API_KEY,
                base_url=NOUS_API_BASE
            )
            
            response = await client.chat.completions.create(
                model="hermes-3-llama-3.1-405b",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": data.text}
                ],
                temperature=0.8,
                max_tokens=300
            )
            
            ai_response = response.choices[0].message.content
            
        else:
            # Use OpenAI via Emergent LLM
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"builder_{user_id}",
                system_message=system_message
            ).with_model("openai", "gpt-4o")
            
            user_message = UserMessage(text=data.text)
            ai_response = await chat.send_message(user_message)
        
        # Parse natural response into structure
        structure = parse_natural_response(ai_response, data.text, data.current_frequency)
        
        # Smart positioning (spiral pattern)
        import math
        created_nodes = []
        base_angle = (2 * math.pi) / max(len(structure.get("nodes", [])), 1)
        
        for i, node_data in enumerate(structure.get("nodes", [])):
            angle = base_angle * i
            radius = 200 + (i * 50)
            x = 500 + (radius * math.cos(angle))
            y = 300 + (radius * math.sin(angle))
            
            node = Node(
                user_id=user_id,
                title=node_data.get("title", "Untitled"),
                content=node_data.get("content", ""),
                type=node_data.get("type", "thought"),
                tags=node_data.get("tags", []),
                frequency=data.current_frequency,
                position={"x": x, "y": y}
            )
            await db.nodes.insert_one(node.model_dump())
            created_nodes.append(node)
        
        # Log pattern
        await db.patterns.insert_one({
            "user_id": user_id,
            "frequency": data.current_frequency,
            "action": structure.get("action"),
            "text": data.text,
            "model": "hermes" if use_hermes else "openai",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "action": structure.get("action"),
            "nodes": [n.model_dump() for n in created_nodes],
            "links": structure.get("links", []),
            "message": structure.get("message", "Added to the field")
        }
    except Exception as e:
        logging.error(f"Converse error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
    """Analyze user's creative rhythms with affective language"""
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
        
        # Ask AI to identify patterns with affective language
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"pattern_{user_id}",
            system_message="""You notice creative rhythms and patterns. Speak in affective, embodied language.

Not: "You created 5 synthesis nodes after focus sessions"
But: "Your rhythm leans contemplative after sharp work - like exhaling after intensity"

Not: "High activity in dream frequency"
But: "You've been living in the associative flow lately - ideas branching, connections multiplying"

Be specific but poetic. Grounded but warm. Notice tempo, texture, emotional arc.
"""
        ).with_model("openai", "gpt-4o")
        
        # Build pattern context
        pattern_context = []
        for p in patterns[:20]:
            pattern_context.append(f"{p.get('frequency')} frequency → {p.get('action')} action")
            if p.get('text'):
                pattern_context.append(f"  \"{p.get('text')[:50]}...\"")
        
        pattern_summary = "\n".join(pattern_context)
        
        prompt = f"Recent creative activity:\n{pattern_summary}\n\nWhat rhythms emerge? Describe the felt quality of their pattern. 2-3 sentences, warm and specific."
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