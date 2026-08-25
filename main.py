# pyrefly: ignore [missing-import]
from functools import cached_property
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, BackgroundTasks
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
import os
# pyrefly: ignore [missing-import]
import asyncpg
import hashlib
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
from contextlib import asynccontextmanager
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from google import genai

# pyrefly: ignore [missing-import]
from langchain_text_splitters import RecursiveCharacterTextSplitter

# pyrefly: ignore [missing-import]
import redis.asyncio as redis

# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse

load_dotenv()

DB_URL = os.getenv("DB_URL")
REDIS_URL = os.getenv("REDIS_URL")

@asynccontextmanager
async def lifeSpan(app:FastAPI):
    app.state.redis = redis.from_url(REDIS_URL, decode_responses=True)
    app.state.pool = await asyncpg.create_pool(DB_URL)
    async with app.state.pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")

        # 1. Documents table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS documents(
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                embedding vector(768)
            )
        """)
        # FTS index for keyword search
        await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_documents_content_fts
        ON documents USING gin(to_tsvector('english', content));
        """)
        # HNSW index for vector similarity search
        await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_documents_embedding_fts
        ON documents USING hnsw (embedding vector_cosine_ops);
        """)

        # 2. Semantic Cache table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS semantic_cache(
                query_hash VARCHAR(64) PRIMARY KEY,
                query_text TEXT NOT NULL,
                embedding vector(768) NOT NULL
            )
        """)
        # HNSW index for vector similarity search
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding
            ON semantic_cache USING hnsw (embedding vector_cosine_ops);
        """)
    
    yield

    await app.state.pool.close()
    await app.state.redis.close()


app = FastAPI(title="Enterprise RAG", lifespan=lifeSpan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)

def reciprocal_rank_fusion(vector_results, keyword_results, k: int = 60):
    rrf_scores = {}
    doc_map = {}

    # Score Vector Rankings
    for rank, item in enumerate(vector_results, start=1):
        doc_id = item['id']
        doc_map[doc_id] = item['content']
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1 / (rank + k)

    # Score Keyword Rankings
    for rank, item in enumerate(keyword_results, start=1):
        doc_id = item['id']
        doc_map[doc_id] = item['content']
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1 / (rank + k)

    sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

    return[
        {"id":doc_id, "content":doc_map[doc_id], "rrf_score":score} for doc_id, score in sorted_docs
    ]


async def check_semantic_cache(app, query_embedding:list, threshold=0.95):
    query_vec_str = str(query_embedding)

    async with app.state.pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT query_hash, (1 - (embedding <=> $1::vector)) AS similarity
            FROM semantic_cache
            WHERE (1 - (embedding <=> $1::vector)) >= $2
            ORDER BY similarity DESC
            LIMIT 1
        """, query_vec_str, threshold)

        if row:
            query_hash = row["query_hash"]
            cached_response = await app.state.redis.get(f"cache:{query_hash}")
            if cached_response:
                return {"hit": True, "answer":cached_response, "similarity":row["similarity"]}
    
    return {"hit": False}

async def save_to_cache(app, query_text:str, query_embedding:list, llm_response:str):
    query_hash = hashlib.sha256(query_text.encode()).hexdigest()
    query_vec_str = str(query_embedding)

    async with app.state.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO semantic_cache(query_hash, query_text, embedding) 
            VALUES($1, $2, $3::vector)
            ON CONFLICT (query_hash) DO NOTHING;
        """, query_hash, query_text, query_vec_str)

    await app.state.redis.setex(f"cache:{query_hash}", 86400, llm_response)
    
    




class IngestRequest(BaseModel):
    document_text:str

class QueryResult(BaseModel):
    query:str
    top_k: int = 3


@app.get("/health")
async def health_check():
    return{
        "status":"healthy",
        "message":"System running"
    }

@app.post("/ingest")
async def ingest_document(request:IngestRequest):
    chunks = text_splitter.split_text(request.document_text)
    responses = client.models.embed_content(
        model = "gemini-embedding-001",
        contents=chunks,
        config={"output_dimensionality": 768}
    )

    async with app.state.pool.acquire() as conn:
        for chunk, embedding in zip(chunks, responses.embeddings):
            vec_str = str(embedding.values)
            await conn.execute(
                "INSERT INTO documents (content, embedding) VALUES ($1, $2)",chunk, vec_str
            )

    return {"message":f"Successfully Ingested {len(chunks)} Chunks into Database"}


@app.post("/retrieve")
async def retrieve_hybrid_search(request: QueryResult, query_embedding:list = None):
    if query_embedding is None:
        query_embedding = client.models.embed_content(
            model="gemini-embedding-001",
            contents=request.query,
            config={"output_dimensionality": 768}
        )
        raw_embedding = query_embedding.embeddings[0].values
    else:
        raw_embedding = query_embedding

    
    query_vec_res = str(raw_embedding)
    async with app.state.pool.acquire() as conn:
        vector_rows = await conn.fetch("""
            SELECT id, content
            FROM documents
            ORDER BY embedding <=> $1::vector
            LIMIT 10;
        """, query_vec_res)

        vector_results = [dict(rows) for rows in vector_rows]

        keyword_rows = await conn.fetch("""
            SELECT id, content
            FROM documents
            WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
            ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) DESC
            LIMIT 10;
        """, request.query)

        keyword_results = [dict(rows) for rows in keyword_rows]

        fused_results = reciprocal_rank_fusion(vector_results, keyword_results)

        return {
            "query":request.query,
            "results":fused_results[:request.top_k]
        }
        
@app.post("/ask")
async def ask_rag(request:QueryResult, background_tasks:BackgroundTasks):
    # 1. Embed Query
    query_embedding = client.models.embed_content(
        model="gemini-embedding-001",
        contents=request.query,
        config={"output_dimensionality": 768}
    )
    raw_embedding = query_embedding.embeddings[0].values

    # 2. Semantic Cache Check
    cache_result = await check_semantic_cache(app, raw_embedding, threshold=0.95)
    if cache_result["hit"]:
        return {
            "query":request.query,
            "answer": cache_result["answer"],
            "source":"cache",
            "similarity": cache_result["similarity"]
        }

    # 3. Cache Miss - Hybrid Search
    retrieval_result = await retrieve_hybrid_search(request=QueryResult(query=request.query, top_k=request.top_k), query_embedding = raw_embedding)
    retrieved_docs = retrieval_result.get("results", [])

    if not retrieved_docs:
        return{
            "query":request.query,
            "answer":"No relevant documents found",
            "source":"empty"
        }

    # 4. Construct Prompt and Generate with Gemini
    context_blocks = [item["content"] for item in retrieved_docs]
    context_text = "\n\n".join(context_blocks)
    
    system_prompt = f"""
    You are a precise enterprise assistant. Answer the user's question strictly 
    using the context provided below. If the context does not contain the answer, 
    say "I do not have enough information to answer this." Do not use outside knowledge.
    Context:
        {context_text}
    User Question:
        {request.query}
    """

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[system_prompt]
    )
    generated_text = response.text
    # 5. Cache the response
    await save_to_cache(app, request.query, raw_embedding, generated_text)
    return {
        "query": request.query,
        "answer": generated_text,
        "source": "documents_retrieved",
    }

    # response_stream = client.models.generate_content_stream(
    #     model = "gemini-3-flash-preview",
    #     contents=[system_prompt]
    # )

    # async def event_generator():
    #     generated_text = ""
    #     for chunk in response_stream:
    #         if chunk.text:
    #             generated_text += chunk.text
    #             yield f"data:{chunk.text}\n\n"
        
    #     background_tasks.add_task(save_to_cache, app, request.query, query_embedding, generated_text)

    # return StreamingResponse(event_generator(), media_type="text/event-stream")



    