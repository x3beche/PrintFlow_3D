import os
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Callable, Optional, List, Dict, Any
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import PyMongoError
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ChannelCreate(BaseModel):
    channel: str

class ChannelResponse(BaseModel):
    channel: str
    channel_id: str  # Store as string (UUID)
    createdAt: datetime

class ChannelStatsResponse(BaseModel):
    exists: bool
    channel: str
    channel_id: str  # Store as string (UUID)
    messageCount: int
    createdAt: datetime
    lastActivity: datetime

class MessageSend(BaseModel):
    channel: str
    sender: str
    content: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class MessageResponse(BaseModel):
    channel: str
    ts: datetime
    sender: str
    content: str
    metadata: Optional[Dict[str, Any]]
    edited: bool

class MessageEdit(BaseModel):
    channel: str
    message_id: str  # Keep as string for message ID
    new_content: str

class MongoSocket:
    def __init__(
        self,
        uri: str = "",
        db_name: str = "kiwio_socket",
        channels_collection: str = "channels",
        messages_collection: str = "messages",
    ):
        self.uri = uri or os.getenv("MONGODB_URI", "mongodb+srv://devops:ryfJOywv6SuWd1R9@kiwio.g3xtiqd.mongodb.net/")
        self.db_name = db_name
        self.client = MongoClient(self.uri)
        self.db = self.client[self.db_name]
        self.channels = self.db[channels_collection]
        self.messages = self.db[messages_collection]
        self._create_indexes()
        self._listener_thread: Optional[threading.Thread] = None
        self._stop_listener = threading.Event()
        self._callbacks: Dict[str, List[Callable]] = {}

    def _create_indexes(self):
        self.messages.create_index([("channel", ASCENDING), ("ts", DESCENDING)])
        self.channels.create_index([("channel", ASCENDING)], unique=True)
        self.messages.create_index([("_id", ASCENDING)])

    def create_channel(self, channel: str) -> Dict[str, Any]:
        channel_id = str(uuid.uuid4())  # Generate UUID as string
        doc = self.channels.insert_one({
            "channel": channel,
            "channel_id": channel_id,
            "createdAt": datetime.now(timezone.utc),
            "messageCount": 0,
            "lastActivity": datetime.now(timezone.utc)
        })
        return {
            "channel": channel,
            "channel_id": channel_id,
            "createdAt": datetime.now(timezone.utc)
        }

    def ensure_channel(self, channel: str) -> Dict[str, Any]:
        channel_doc = self.channels.find_one({"channel": channel})
        if channel_doc is None:
            return self.create_channel(channel)
        return channel_doc

    def get_channel(self, channel: str) -> Optional[Dict[str, Any]]:
        return self.channels.find_one({"channel": channel})

    def delete_channel(self, channel: str) -> bool:
        self.messages.delete_many({"channel": channel})
        result = self.channels.delete_one({"channel": channel})
        return result.deleted_count > 0

    def get_channel_stats(self, channel: str) -> Dict[str, Any]:
        channel_doc = self.get_channel(channel)
        if not channel_doc:
            return {"exists": False}
        message_count = self.messages.count_documents({"channel": channel})
        return {
            "exists": True,
            "channel": channel,
            "channel_id": channel_doc.get("channel_id"),  # String UUID
            "messageCount": message_count,
            "createdAt": channel_doc.get("createdAt"),
            "lastActivity": channel_doc.get("lastActivity"),
        }

    def send(
        self,
        channel: str,
        sender: str,
        content: str,
        metadata: Optional[Dict] = None,
    ) -> str:
        self.ensure_channel(channel)
        message = {
            "channel": channel,
            "ts": datetime.now(timezone.utc),
            "sender": sender,
            "content": content,
            "metadata": metadata or {},
            "edited": False,
        }
        result = self.messages.insert_one(message)
        self.channels.update_one(
            {"channel": channel},
            {
                "$inc": {"messageCount": 1},
                "$currentDate": {"lastActivity": True},
            },
        )
        return str(result.inserted_id)

    def edit(self, channel: str, message_id: str, new_content: str) -> bool:
        result = self.messages.update_one(
            {"_id": message_id, "channel": channel},
            {
                "$set": {
                    "content": new_content,
                    "edited": True,
                    "editedAt": datetime.now(timezone.utc),
                }
            },
        )
        if result.modified_count > 0:
            self.channels.update_one(
                {"channel": channel},
                {"$currentDate": {"lastActivity": True}},
            )
        return result.modified_count > 0

    def delete_message(self, channel: str, message_id: str) -> bool:
        result = self.messages.delete_one({"_id": message_id, "channel": channel})
        if result.deleted_count > 0:
            self.channels.update_one(
                {"channel": channel},
                {
                    "$inc": {"messageCount": -1},
                    "$currentDate": {"lastActivity": True},
                },
            )
        return result.deleted_count > 0

    def get_messages(
        self,
        channel: str,
        limit: Optional[int] = 50,
        skip: int = 0,
        sort_order: int = DESCENDING,
    ) -> List[Dict[str, Any]]:
        query = {"channel": channel}
        cursor = self.messages.find(query).sort("ts", sort_order).skip(skip)
        if limit:
            cursor = cursor.limit(limit)
        return list(cursor)

    def get_message_by_id(self, message_id: str) -> Optional[Dict[str, Any]]:
        return self.messages.find_one({"_id": message_id})

    def on(self, event: str, callback: Callable):
        if event not in self._callbacks:
            self._callbacks[event] = []
        self._callbacks[event].append(callback)

    def _emit(self, event: str, data: Any):
        for callback in self._callbacks.get(event, []):
            try:
                callback(data)
            except Exception as e:
                logger.error(f"Callback error [{event}]: {e}")

    def listen(self, channel: str, blocking: bool = True):
        if blocking:
            self._listen_worker(channel)
        else:
            self._stop_listener.clear()
            self._listener_thread = threading.Thread(
                target=self._listen_worker, args=(channel,), daemon=True
            )
            self._listener_thread.start()

    def _listen_worker(self, channel: str):
        self.ensure_channel(channel)
        logger.info(f"Listening on channel='{channel}'")
        pipeline = [
            {
                "$match": {
                    "fullDocument.channel": channel,
                    "operationType": {"$in": ["insert", "update", "delete"]},
                }
            }
        ]
        try:
            with self.messages.watch(
                pipeline=pipeline, full_document="updateLookup"
            ) as stream:
                for change in stream:
                    if self._stop_listener.is_set():
                        break
                    op_type = change.get("operationType")
                    full_doc = change.get("fullDocument")
                    if op_type == "insert":
                        self._emit("message", {
                            "channel": channel,
                            "message": full_doc,
                            "operationType": "insert",
                        })
                    elif op_type == "update":
                        self._emit("edit", {
                            "channel": channel,
                            "message": full_doc,
                            "operationType": "update",
                        })
                    elif op_type == "delete":
                        doc_id = change.get("documentKey", {}).get("_id")
                        self._emit("delete", {
                            "channel": channel,
                            "messageId": str(doc_id),
                            "operationType": "delete",
                        })
        except PyMongoError as e:
            self._emit("error", {"error": str(e), "channel": channel})
            logger.error(f"Change Stream error: {e}")

    def stop_listening(self):
        self._stop_listener.set()
        if self._listener_thread:
            self._listener_thread.join(timeout=2)
        logger.info("Listener stopped")

    def close(self):
        self.stop_listening()
        self.client.close()
        logger.info("Connection closed")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()