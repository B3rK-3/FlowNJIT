import hashlib
import chromadb
from typing import List, Tuple, Dict, Any, Optional
from constants import graph_data, COLLECTION_NAME, CourseMetadata
from chromadb.utils import embedding_functions
import time

# use cuda
ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2",
    device="cuda",
)

# global chromadb client
chroma_client = chromadb.PersistentClient(path="./chromadb")

# global chromadb collection
collection = chroma_client.get_or_create_collection(
    name=COLLECTION_NAME, embedding_function=ef
)

time.sleep(15)

def generate_hash(title: str, description: str) -> Tuple[str, str]:
    """
    generates an md5 hash of the given text.
    returns (hash, combined_text).
    """
    # handle none
    t = title if title else ""
    d = description if description else ""

    combined_text = f"{t} {d}".strip()
    return (hashlib.md5(combined_text.encode("utf-8")).hexdigest(), combined_text)


def initialize_database() -> None:
    """
    initializes chromadb and populates it with course data.
    """
    print("Initializing ChromaClient...")

    try:
        heartbeat = chroma_client.heartbeat()
        print("ChromaDB Heartbeat:", heartbeat)
    except Exception as e:
        print("Could not initialize ChromaDB PersistentClient at ./chromadb")
        raise e

    print(f"Getting or creating collection '{COLLECTION_NAME}'...")

    ids_to_upsert: List[str] = []
    documents_to_upsert: List[str] = []
    metadatas_to_upsert: List[CourseMetadata] = []

    print("Checking for updates in graph data...")

    for course_id, info in graph_data.items():
        title = info.title
        description = info.desc

        computed_hash, combined_text = generate_hash(title, description)

        # retrieve specific item to check hash
        result = collection.get(ids=[course_id], include=["metadatas"])

        needs_upsert = False
        if not result["ids"]:
            needs_upsert = True
        else:
            existing_metas = result.get("metadatas")
            existing_meta = existing_metas[0] if existing_metas else None

            if not existing_meta or existing_meta.get("hash") != computed_hash:
                print(f"Course {course_id} changed, re-indexing...")
                needs_upsert = True

        if needs_upsert:
            ids_to_upsert.append(course_id)
            documents_to_upsert.append(combined_text)
            metadata: CourseMetadata = {
                "title": title,
                "description": description,
                "hash": computed_hash,
            }
            metadatas_to_upsert.append(metadata)

        # batch upsert
        if len(ids_to_upsert) >= 100:
            collection.upsert(
                ids=ids_to_upsert,
                documents=documents_to_upsert,
                metadatas=metadatas_to_upsert,  # type: ignore
            )
            print(f"Upserted {len(ids_to_upsert)} courses...")
            ids_to_upsert = []
            documents_to_upsert = []
            metadatas_to_upsert = []

    # final batch
    if len(ids_to_upsert) > 0:
        collection.upsert(
            ids=ids_to_upsert,
            documents=documents_to_upsert,
            metadatas=metadatas_to_upsert,  # type: ignore
        )
        print(f"Final update for {len(ids_to_upsert)} courses complete.")

    print("Database synchronization complete.")


def course_query(query_text: str, n: int = 5) -> List[Dict[str, Any]]:
    """
    queries the course database for semantic similarities.
    returns top n matching courses with metadata.
    """
    try:
        results = collection.query(query_texts=[query_text], n_results=n)

        if not results["ids"]:
            return []

        flat_results: List[Dict[str, Any]] = []
        ids_list = results["ids"][0]
        distances_list = (
            results["distances"][0] if results["distances"] else [None] * len(ids_list)
        )
        metadatas_list = (
            results["metadatas"][0] if results["metadatas"] else [None] * len(ids_list)
        )
        documents_list = (
            results["documents"][0] if results["documents"] else [None] * len(ids_list)
        )

        for i, cid in enumerate(ids_list):
            flat_results.append(
                {
                    "id": cid,
                    "document": documents_list[i],
                    "metadata": metadatas_list[i],
                    "distance": distances_list[i],
                }
            )

        return flat_results

    except Exception as e:
        print("Error querying ChromaDB:", e)
        return []
