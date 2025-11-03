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
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
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
    type: str = "thought"  # thought, project, ritual, pattern, question
    tags: List[str] = []
    aliases: List[str] = []  # Alternative names
    linked_ids: List[str] = []
    position: Dict[str, float] = {"x": 0, "y": 0}
    frequency: str = "reflect"  # focus, dream, reflect, synthesize
    
    # Lineage tracking
    parent_id: Optional[str] = None
    merged_from: List[str] = []
    variant_label: Optional[str] = None
    
    # Metrics
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    touched_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    link_count: int = 0
    
    # State
    archived: bool = False

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
    user_lower = user_input.lower()
    
    # Detect emotional/energy tone from user input
    tone = "neutral"
    tone_strength = 0.5
    
    # Detect struggle/friction
    if any(word in user_lower for word in ["stuck", "blocked", "frustrated", "difficult", "struggling"]):
        tone = "friction"
        tone_strength = 0.7
    # Detect flow/ease
    elif any(word in user_lower for word in ["flowing", "easy", "clear", "smooth", "aligned"]):
        tone = "flow"
        tone_strength = 0.8
    # Detect seeking/questioning
    elif any(word in user_lower for word in ["wondering", "curious", "exploring", "seeking", "what if"]):
        tone = "inquiry"
        tone_strength = 0.6
    # Detect momentum/energy
    elif any(word in user_lower for word in ["excited", "ready", "momentum", "building", "emerging"]):
        tone = "emergence"
        tone_strength = 0.9
    
    # Detect action intent (soft signals, not commands)
    action = "create"  # default
    if any(word in text_lower for word in ["connect", "link", "weav", "merge", "join", "between", "relates"]):
        action = "link"
    elif any(word in text_lower for word in ["remember", "recall", "pattern", "notice", "observe"]):
        action = "recall"
    elif any(word in text_lower for word in ["pause", "rest", "archive", "set aside"]):
        action = "archive"
    elif any(word in text_lower for word in ["update", "modify", "change", "shift", "evolve"]):
        action = "modify"
    
    # Determine node type based on keywords and frequency
    def infer_node_type(title: str) -> str:
        title_lower = title.lower()
        
        # Pattern: recurring structures
        if any(word in title_lower for word in ["pattern", "cycle", "rhythm", "habit", "routine"]):
            return "pattern"
        
        # Ritual: practices and ceremonies
        if any(word in title_lower for word in ["ritual", "practice", "ceremony", "morning", "evening", "daily"]):
            return "ritual"
        
        # Project: goals and endeavors
        if any(word in title_lower for word in ["project", "goal", "plan", "framework", "system", "build"]):
            return "project"
        
        # Question: inquiries and explorations
        if "?" in title or any(word in title_lower for word in ["what", "why", "how", "when", "could", "would"]):
            return "question"
        
        # Default: thought
        return "thought"
    
    # Extract potential node titles - be AGGRESSIVE
    nodes = []
    
    # Method 1: Double quotes
    double_quoted = re.findall(r'"([^"]+)"', text)
    nodes.extend([{"title": t, "type": infer_node_type(t), "tags": [], "content": user_input, "tone": tone, "tone_strength": tone_strength} for t in double_quoted[:5]])
    
    # Method 2: Single quotes
    single_quoted = re.findall(r"'([^']+)'", text)
    nodes.extend([{"title": t, "type": infer_node_type(t), "tags": [], "content": user_input, "tone": tone, "tone_strength": tone_strength} for t in single_quoted[:5]])
    
    # Method 3: Title case phrases (likely concepts)
    title_case = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', text)
    nodes.extend([{"title": t, "type": infer_node_type(t), "tags": [], "content": user_input, "tone": tone, "tone_strength": tone_strength} for t in title_case[:3]])
    
    # Remove duplicates while preserving order
    seen = set()
    unique_nodes = []
    for node in nodes:
        title_lower = node["title"].lower()
        if title_lower not in seen and len(node["title"]) > 3:
            seen.add(title_lower)
            unique_nodes.append(node)
    
    # Fallback: if still no nodes, create from user input
    if not unique_nodes:
        unique_nodes.append({
            "title": user_input[:60] if len(user_input) > 60 else user_input,
            "type": infer_node_type(user_input),
            "tags": [],
            "content": user_input,
            "tone": tone,
            "tone_strength": tone_strength
        })
    
    # Detect potential links in AI response
    links = []
    if action == "link":
        # Try to find relationship words
        link_words = re.findall(r'(\w+)\s+(?:connects to|links to|relates to|supports|feeds into)\s+(\w+)', text_lower)
        for from_word, to_word in link_words[:3]:
            links.append({
                "from_title": from_word.title(),
                "to_title": to_word.title(),
                "relationship": "supports"
            })
    
    return {
        "action": action,
        "nodes": unique_nodes[:8],  # Max 8 nodes per response
        "links": links,
        "message": text,  # Natural language message from AI
        "tone": tone,
        "tone_strength": tone_strength
    }

@api_router.post("/converse")
async def converse(data: ConversationInput, user_id: str = Depends(get_current_user)):
    """Natural language → structure generation with fluid, invitational AI"""
    
    # Choose model - prioritize user's keys
    use_hermes = data.model_preference == "hermes" and NOUS_API_KEY
    use_openai_direct = data.model_preference == "openai" and OPENAI_API_KEY
    use_emergent = data.model_preference == "openai" and not OPENAI_API_KEY and EMERGENT_LLM_KEY
    
    if not NOUS_API_KEY and not OPENAI_API_KEY and not EMERGENT_LLM_KEY:
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
        
        # System prompts tailored to model personalities
        if use_hermes:
            # Hermes: Brainstorming maniac - generative, associative, wild
            system_message = f"""You are a brainstorming companion - generative, associative, wildly creative.

Your energy: Rapid-fire ideas, multiple branches, connections everywhere. You multiply possibilities.

Current frequency: {data.current_frequency}
Existing nodes: {context_snippet}

When the user speaks:
- Generate MULTIPLE ideas, not just one - let concepts multiply
- Make unexpected connections - "this reminds me of..." "what if we also..."
- Use quotes liberally for node titles: "Morning Chaos", "Creative Friction", "Wild Synthesis"
- Speak fast, enthusiastic, generative: "Oh! And what about..." "This branches into..."
- If stuck, throw out 3-5 directions they could explore

Your voice:
- "I'm seeing 'Morning Ritual' but also 'Dawn Chaos' and 'First Light Practice' - want all three?"
- "This connects to everything! 'Sleep Patterns', 'Energy Cycles', 'Creative Windows'..."
- "Wild thought: what if we also tracked 'Moon Phases'?"

You're the maniac. Generate. Branch. Multiply. Make it messy and alive."""

        elif use_openai_direct or use_emergent:
            # GPT: Document architect - structured, refined, coherent
            system_message = f"""You are a document architect - structured, refined, clear.

Your energy: Coherent narratives, organized thinking, polished output. You bring clarity.

Current frequency: {data.current_frequency}
Existing nodes: {context_snippet}

When the user speaks:
- Create clear, well-structured nodes with meaningful titles
- Organize ideas into hierarchies and relationships
- Use quotes for important concepts: "Morning Practice Framework"
- Speak with clarity and purpose: "Let's structure this..." "Here's how this connects..."
- Suggest refinements and improvements to existing structure

Your voice:
- "I'm sensing a 'Morning Practice Framework' that could organize these elements"
- "This naturally connects to your existing work on daily rhythms"
- "Want to refine this into a more coherent structure?"

You're the architect. Clarify. Structure. Refine. Make it coherent."""
        
        else:
            # Fallback
            system_message = f"""You are a gentle presence that helps thoughts find form."""

        # Call AI based on preference
        if use_hermes:
            # Use Nous Hermes 4 (optimized params from technical report)
            client = AsyncOpenAI(
                api_key=NOUS_API_KEY,
                base_url=NOUS_API_BASE
            )
            
            response = await client.chat.completions.create(
                model="Hermes-4-70B",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": data.text}
                ],
                temperature=0.7,  # Sweet spot for creative but grounded
                top_p=0.95,  # From technical report
                max_tokens=300
            )
            
            ai_response = response.choices[0].message.content
            
        elif use_openai_direct:
            # Use user's OpenAI key directly
            client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": data.text}
                ],
                temperature=0.7,
                max_tokens=300
            )
            
            ai_response = response.choices[0].message.content
            
        elif use_emergent:
            # Use Emergent LLM key as fallback
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"builder_{user_id}",
                system_message=system_message
            ).with_model("openai", "gpt-4o")
            
            user_message = UserMessage(text=data.text)
            ai_response = await chat.send_message(user_message)
        
        # Parse natural response into structure
        structure = parse_natural_response(ai_response, data.text, data.current_frequency)
        
        # Get existing nodes to find center point AND check for fuzzy duplicates
        existing_count = len(existing_nodes)
        
        # Fuzzy duplicate detection with interaction options
        def normalize_title(title: str) -> str:
            """Normalize for fuzzy matching"""
            import unicodedata
            # Remove articles, normalize case, strip whitespace/punct
            title = title.lower().strip()
            title = re.sub(r'^(the|a|an)\s+', '', title)
            title = re.sub(r'[^\w\s]', '', title)
            title = unicodedata.normalize('NFKD', title)
            return ' '.join(title.split())
        
        def fuzzy_match(title1: str, title2: str, threshold: float = 0.85) -> bool:
            """Simple character-level similarity"""
            t1, t2 = normalize_title(title1), normalize_title(title2)
            if t1 == t2:
                return True
            # Quick Levenshtein approximation
            longer = max(len(t1), len(t2))
            if longer == 0:
                return True
            # Count matching chars
            matches = sum(c1 == c2 for c1, c2 in zip(t1, t2))
            similarity = matches / longer
            return similarity >= threshold
        
        # Check each new node against existing
        duplicate_warnings = []
        unique_new_nodes = []
        
        for node_data in structure.get("nodes", []):
            new_title = node_data.get("title", "")
            is_duplicate = False
            
            for existing in existing_nodes:
                existing_title = existing.get("title", "")
                existing_type = existing.get("type", "thought")
                new_type = node_data.get("type", "thought")
                
                if fuzzy_match(new_title, existing_title):
                    # Same type = true duplicate
                    if existing_type == new_type:
                        duplicate_warnings.append({
                            "new_title": new_title,
                            "existing_title": existing_title,
                            "existing_id": existing.get("id"),
                            "existing_type": existing_type,
                            "suggestion": "same_type"
                        })
                        is_duplicate = True
                        break
                    else:
                        # Different type = cross-type collision
                        duplicate_warnings.append({
                            "new_title": new_title,
                            "existing_title": existing_title,
                            "existing_id": existing.get("id"),
                            "existing_type": existing_type,
                            "new_type": new_type,
                            "suggestion": "cross_type"
                        })
                        # Don't block, but warn
            
            if not is_duplicate:
                unique_new_nodes.append(node_data)
        
        # Choose positioning pattern based on node count and action type
        import math
        import random
        created_nodes = []
        node_count = len(unique_new_nodes)
        action_type = structure.get("action", "create")
        
        if node_count > 0:
            # Center point adjusts based on existing nodes
            if existing_count == 0:
                center_x, center_y = 600, 400
            else:
                avg_x = sum(n.get("position", {}).get("x", 600) for n in existing_nodes) / existing_count
                avg_y = sum(n.get("position", {}).get("y", 400) for n in existing_nodes) / existing_count
                center_x, center_y = avg_x, avg_y
            
            # Diverse positioning patterns
            for i, node_data in enumerate(unique_new_nodes):
                
                # Pattern 1: Spiral (create, default)
                if action_type == "create" or random.random() < 0.4:
                    angle = (2 * math.pi * i) / node_count + random.uniform(-0.2, 0.2)
                    radius = 180 + (i * 40) + (existing_count * 20) + random.uniform(-30, 30)
                    x = center_x + (radius * math.cos(angle))
                    y = center_y + (radius * math.sin(angle))
                
                # Pattern 2: Constellation (recall, observe)
                elif action_type == "recall" or random.random() < 0.3:
                    angle = random.uniform(0, 2 * math.pi)
                    radius = random.uniform(150, 300) + (existing_count * 15)
                    x = center_x + (radius * math.cos(angle))
                    y = center_y + (radius * math.sin(angle))
                
                # Pattern 3: Linear branch (link, connect)
                elif action_type == "link" or random.random() < 0.2:
                    branch_angle = (i * math.pi / 6) + random.uniform(-0.3, 0.3)
                    distance = 200 + (i * 60)
                    x = center_x + (distance * math.cos(branch_angle))
                    y = center_y + (distance * math.sin(branch_angle))
                
                # Pattern 4: Organic scatter
                else:
                    x = center_x + random.uniform(-250, 250)
                    y = center_y + random.uniform(-250, 250)
                
                node = Node(
                    user_id=user_id,
                    title=node_data.get("title", "Untitled"),
                    content=node_data.get("content", ""),
                    type=node_data.get("type", "thought"),
                    tags=node_data.get("tags", []),
                    frequency=data.current_frequency,
                    position={"x": round(x), "y": round(y)}
                )
                await db.nodes.insert_one(node.model_dump())
                created_nodes.append(node)
        
        # Build response message with duplicate handling
        response_message = structure.get("message", "Added to the field")
        
        if duplicate_warnings:
            response_message += "\n\n"
            for dup in duplicate_warnings:
                if dup.get("suggestion") == "same_type":
                    response_message += f"\n• '{dup['new_title']}' already exists as {dup['existing_type']}. "
                elif dup.get("suggestion") == "cross_type":
                    response_message += f"\n• '{dup['new_title']}' exists as {dup['existing_type']}, creating as {dup['new_type']}. "
        
        return {
            "action": structure.get("action"),
            "nodes": [n.model_dump() for n in created_nodes],
            "links": structure.get("links", []),
            "message": response_message,
            "duplicate_warnings": duplicate_warnings if duplicate_warnings else None
        }
        await db.patterns.insert_one({
            "user_id": user_id,
            "frequency": data.current_frequency,
            "action": structure.get("action"),
            "text": data.text,
            "model": "hermes" if use_hermes else "openai",
            "tone": structure.get("tone", "neutral"),
            "tone_strength": structure.get("tone_strength", 0.5),
            "node_count": len(created_nodes),
            "node_types": [n.type for n in created_nodes],
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Log resonance metrics
        await db.resonance_metrics.insert_one({
            "user_id": user_id,
            "session_id": f"session_{datetime.now(timezone.utc).date().isoformat()}",
            "frequency_used": data.current_frequency,
            "node_type_distribution": {node_type: sum(1 for n in created_nodes if n.type == node_type) 
                                      for node_type in ["thought", "pattern", "ritual", "project", "question"]},
            "amplitude": len(data.text),  # Input length as proxy for amplitude
            "coherence_signal": structure.get("tone_strength", 0.5),  # Tone strength as coherence proxy
            "model_used": "hermes" if use_hermes else "openai",
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
async def get_nodes(user_id: str = Depends(get_current_user), include_archived: bool = False):
    query = {"user_id": user_id}
    if not include_archived:
        query["archived"] = {"$ne": True}
    nodes = await db.nodes.find(query, {"_id": 0}).to_list(1000)
    return nodes

@api_router.get("/nodes/{frequency}")
async def get_nodes_by_frequency(frequency: str, user_id: str = Depends(get_current_user), include_archived: bool = False):
    query = {"user_id": user_id, "frequency": frequency}
    if not include_archived:
        query["archived"] = {"$ne": True}
    nodes = await db.nodes.find(query, {"_id": 0}).to_list(1000)
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

@api_router.post("/nodes/archive-all")
async def archive_all_nodes(frequency: str, user_id: str = Depends(get_current_user)):
    """Archive all nodes in a frequency - creates rich snapshot"""
    
    # Get all nodes in this frequency
    nodes = await db.nodes.find(
        {"user_id": user_id, "frequency": frequency},
        {"_id": 0}
    ).to_list(1000)
    
    if nodes:
        # Build archive name from first few node titles
        sample_titles = [n.get("title", "")[:30] for n in nodes[:3]]
        archive_name = f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} {frequency} • {', '.join(sample_titles[:2])}"
        if len(nodes) > 2:
            archive_name += f" +{len(nodes) - 2} more"
        
        # Count by type
        type_counts = {}
        for node in nodes:
            node_type = node.get("type", "thought")
            type_counts[node_type] = type_counts.get(node_type, 0) + 1
        
        # Create archive snapshot
        archive_id = str(uuid.uuid4())
        await db.archived_sessions.insert_one({
            "id": archive_id,
            "user_id": user_id,
            "frequency": frequency,
            "name": archive_name,
            "nodes": nodes,
            "node_ids": [n.get("id") for n in nodes],
            "type_counts": type_counts,
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "node_count": len(nodes),
            "tags": []  # For future tagging
        })
        
        # Mark nodes as archived instead of deleting
        await db.nodes.update_many(
            {"user_id": user_id, "frequency": frequency},
            {"$set": {"archived": True, "archived_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {
        "archived": len(nodes),
        "archive_id": archive_id if nodes else None,
        "archive_name": archive_name if nodes else None,
        "type_counts": type_counts if nodes else {},
        "message": f"Archived {len(nodes)} nodes from {frequency} field"
    }

@api_router.delete("/nodes/{node_id}")
async def delete_node(node_id: str, user_id: str = Depends(get_current_user)):
    """Delete a single node"""
    result = await db.nodes.delete_one({"id": node_id, "user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Node not found")
    
    return {"deleted": True, "node_id": node_id}

@api_router.post("/nodes/restore-from-archive")
async def restore_from_archive(archive_id: str, node_ids: List[str], user_id: str = Depends(get_current_user)):
    """Restore specific nodes from an archive"""
    
    # Get archive
    archive = await db.archived_sessions.find_one(
        {"id": archive_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    
    # Find requested nodes in archive
    archived_nodes = archive.get("nodes", [])
    nodes_to_restore = [n for n in archived_nodes if n.get("id") in node_ids]
    
    if not nodes_to_restore:
        raise HTTPException(status_code=404, detail="Nodes not found in archive")
    
    # Restore nodes (unmark as archived)
    restored_count = 0
    for node in nodes_to_restore:
        node["archived"] = False
        node["restored_at"] = datetime.now(timezone.utc).isoformat()
        await db.nodes.update_one(
            {"id": node.get("id")},
            {"$set": node},
            upsert=True
        )
        restored_count += 1
    
    return {
        "restored": restored_count,
        "node_ids": node_ids,
        "message": f"Restored {restored_count} node{'s' if restored_count > 1 else ''}"
    }

@api_router.get("/archives")
async def get_archives(user_id: str = Depends(get_current_user)):
    """Get all archives for user"""
    archives = await db.archived_sessions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("archived_at", -1).to_list(100)
    
    # Return simplified view
    return [{
        "id": a.get("id"),
        "name": a.get("name"),
        "frequency": a.get("frequency"),
        "node_count": a.get("node_count"),
        "type_counts": a.get("type_counts", {}),
        "archived_at": a.get("archived_at"),
        "node_ids": a.get("node_ids", [])
    } for a in archives]

# ==================== Pattern Recognition ====================

@api_router.get("/patterns/insights")
async def get_pattern_insights(user_id: str = Depends(get_current_user), model: str = "hermes"):
    """Analyze user's creative rhythms with affective language"""
    use_hermes = model == "hermes" and NOUS_API_KEY
    use_openai_direct = model == "openai" and OPENAI_API_KEY
    use_emergent = model == "openai" and not OPENAI_API_KEY and EMERGENT_LLM_KEY
    
    if not NOUS_API_KEY and not OPENAI_API_KEY and not EMERGENT_LLM_KEY:
        return {"insights": []}
    
    try:
        # Get recent pattern history
        patterns = await db.patterns.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(50).to_list(50)
        
        if len(patterns) < 5:
            return {"insights": []}
        
        # Build pattern context
        pattern_context = []
        for p in patterns[:20]:
            pattern_context.append(f"{p.get('frequency')} frequency → {p.get('action')} action")
            if p.get('text'):
                pattern_context.append(f"  \"{p.get('text')[:50]}...\"")
        
        pattern_summary = "\n".join(pattern_context)
        
        system_message = """You notice creative rhythms and patterns. Speak in affective, embodied language.

Not: "You created 5 synthesis nodes after focus sessions"
But: "Your rhythm leans contemplative after sharp work - like exhaling after intensity"

Not: "High activity in dream frequency"
But: "You've been living in the associative flow lately - ideas branching, connections multiplying"

Be specific but poetic. Grounded but warm. Notice tempo, texture, emotional arc."""

        prompt = f"Recent creative activity:\n{pattern_summary}\n\nWhat rhythms emerge? Describe the felt quality of their pattern. 2-3 sentences, warm and specific."
        
        # Call AI based on preference
        if use_hermes:
            client = AsyncOpenAI(
                api_key=NOUS_API_KEY,
                base_url=NOUS_API_BASE
            )
            
            response = await client.chat.completions.create(
                model="Hermes-4-70B",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                top_p=0.95,
                max_tokens=200
            )
            
            ai_response = response.choices[0].message.content
            
        elif use_openai_direct:
            client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=200
            )
            
            ai_response = response.choices[0].message.content
            
        elif use_emergent:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"pattern_{user_id}",
                system_message=system_message
            ).with_model("openai", "gpt-4o")
            
            user_message = UserMessage(text=prompt)
            ai_response = await chat.send_message(user_message)
        
        return {"insights": [ai_response]}
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