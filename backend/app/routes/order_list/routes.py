from fastapi import HTTPException, Depends
from typing import List
import logging
from models.user import User
from routes.authentication.auth_modules import get_session
from app import app
from datetime import datetime
from crud.databases import orders, manufacturer_data, fs
from pydantic import BaseModel
from typing import Union, Dict, Optional
import io
from fastapi.responses import StreamingResponse
from bson import ObjectId

# ==================== ORDER LIST MODELS ====================
class OrderListResponse(BaseModel):
    order_id: str
    order_number: str
    preview_id: str
    status: str
    current_step: int
    manufacturer: str
    is_cancelled: bool


# ==================== ORDER DETAIL MODELS ====================
class OrderTimingEntryResponse(BaseModel):
    user_id: str
    timestamp: datetime
    status: str


class OrderTimingTableResponse(BaseModel):
    order_received: Optional[OrderTimingEntryResponse] = None
    assigned_to_manufacturer: Optional[OrderTimingEntryResponse] = None
    started_manufacturing: Optional[OrderTimingEntryResponse] = None
    produced: Optional[OrderTimingEntryResponse] = None
    ready_to_take: Optional[OrderTimingEntryResponse] = None


class EstimationsResponse(BaseModel):
    estimated_weight: float
    estimated_cost: float


class OrderSpecsResponse(BaseModel):
    material: str
    brand: str
    color: str
    layer_height: float
    infill: int


class ManufacturerInfoResponse(BaseModel):
    manufacturer_id: Optional[str] = None
    company: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None


class FinalizationDataResponse(BaseModel):
    actual_filament_usage: Optional[float] = None
    final_price: Optional[float] = None
    delivery_address: Optional[str] = None
    manufacturer_notes: Optional[str] = None
    product_image_uploaded_at: Optional[datetime] = None


class FileInfoResponse(BaseModel):
    file_id: Optional[str] = None
    preview_id: Optional[str] = None
    product_file_id: Optional[str] = None


class StepInfo(BaseModel):
    id: int
    key: str
    label: str
    status: str  # "completed", "current", "pending", "cancelled"
    timestamp: Optional[datetime] = None
    completed: bool


class OrderDetailResponse(BaseModel):
    # Basic Info
    order_id: str
    order_number: str
    order_type: str
    notes: Optional[str] = None
    
    # Status
    current_step: int
    total_steps: int
    status_label: str
    is_cancelled: bool
    is_completed: bool
    
    # Data
    estimations: EstimationsResponse
    specs: OrderSpecsResponse
    manufacturer: Optional[ManufacturerInfoResponse] = None
    finalization: Optional[FinalizationDataResponse] = None
    files: FileInfoResponse
    
    # Timing
    order_timing_table: OrderTimingTableResponse
    steps: List[StepInfo]
    
    # Timestamps
    created_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None


class CancelOrderResponse(BaseModel):
    success: bool
    message: str
    order_id: str


# ==================== HELPER FUNCTIONS ====================
def parse_timing_entry(entry_data: dict) -> Optional[OrderTimingEntryResponse]:
    """Parse a timing table entry"""
    if not entry_data:
        return None
    
    timestamp = entry_data.get("timestamp")
    if isinstance(timestamp, str):
        try:
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except:
            timestamp = datetime.now()
    
    return OrderTimingEntryResponse(
        user_id=entry_data.get("user_id", ""),
        timestamp=timestamp or datetime.now(),
        status=entry_data.get("status", "")
    )


def get_current_step(timing_table: dict) -> int:
    """Determine current step number"""
    if timing_table.get("ready_to_take"):
        return 5
    elif timing_table.get("produced"):
        return 4
    elif timing_table.get("started_manufacturing"):
        return 3
    elif timing_table.get("assigned_to_manufacturer"):
        return 2
    return 1


def get_status_label(timing_table: dict, is_cancelled: bool) -> str:
    """Get human-readable status label"""
    if is_cancelled:
        return "Cancelled"
    
    if timing_table.get("ready_to_take"):
        return "Ready to Pickup"
    elif timing_table.get("produced"):
        return "Production Completed"
    elif timing_table.get("started_manufacturing"):
        return "In Production"
    elif timing_table.get("assigned_to_manufacturer"):
        return "Assigned to Manufacturer"
    return "Order Received"


def build_steps(timing_table: dict, is_cancelled: bool) -> List[StepInfo]:
    """Build step information for UI progress bar"""
    
    step_definitions = [
        {"id": 1, "key": "order_received", "label": "Order Received"},
        {"id": 2, "key": "assigned_to_manufacturer", "label": "Assigned"},
        {"id": 3, "key": "started_manufacturing", "label": "Manufacturing"},
        {"id": 4, "key": "produced", "label": "Produced"},
        {"id": 5, "key": "ready_to_take", "label": "Ready to Pickup"},
    ]
    
    current_step = get_current_step(timing_table)
    steps = []
    
    for step_def in step_definitions:
        entry = timing_table.get(step_def["key"])
        
        # Parse timestamp
        timestamp = None
        if entry and entry.get("timestamp"):
            ts = entry.get("timestamp")
            if isinstance(ts, str):
                try:
                    timestamp = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except:
                    pass
            elif isinstance(ts, datetime):
                timestamp = ts
        
        # Determine status
        is_completed = entry is not None
        is_current = step_def["id"] == current_step and not is_completed
        
        if is_cancelled:
            status = "cancelled"
        elif is_completed:
            status = "completed"
        elif is_current:
            status = "current"
        else:
            status = "pending"
        
        steps.append(StepInfo(
            id=step_def["id"],
            key=step_def["key"],
            label=step_def["label"],
            status=status,
            timestamp=timestamp,
            completed=is_completed
        ))
    
    return steps


def parse_datetime(value) -> Optional[datetime]:
    """Parse datetime from various formats"""
    if not value:
        return None
    
    if isinstance(value, datetime):
        return value
    
    if isinstance(value, dict) and "$date" in value:
        try:
            return datetime.fromisoformat(value["$date"].replace("Z", "+00:00"))
        except:
            return None
    
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except:
            return None
    
    return None


# ==================== ENDPOINTS ====================
@app.get("/order/list", response_model=List[OrderListResponse])
async def list_orders(
    user: User = Depends(get_session)
):
    """List all orders for current user with minimal data"""
    
    try:
        # Fetch all orders for the current user
        user_orders = list(orders.find({"user_id": str(user.id)}))
        
        if not user_orders:
            return []
        
        # Format orders with only necessary fields
        formatted_orders = []
        for order in user_orders:
            try:
                # Get timing table
                timing_table = order.get("order_timing_table", {})
                
                # Determine current step
                current_step = get_current_step(timing_table)
                
                # Get status text
                status_map = {
                    1: "Order Received",
                    2: "Assigned to Manufacturer",
                    3: "Started Manufacturing",
                    4: "Produced",
                    5: "Ready to Take"
                }
                
                # Check if cancelled
                is_cancelled = order.get("is_cancelled", False)
                
                # Get order_received timestamp for sorting
                order_received_entry = timing_table.get("order_received", {})
                order_received_timestamp = order_received_entry.get("timestamp") if order_received_entry else None

                company_to_manufacturer = {
                    "company1": "Medipol TTO",
                    "company2": "İTÜ TTO",
                    "company3": "GTÜ TTO",
                }
                manufacturer = manufacturer_data.find_one({"user_id": order.get("manufacturer_id")})
                if manufacturer:
                    manufacturer_company_name = company_to_manufacturer[manufacturer.get("company")]
                else: 
                    manufacturer_company_name = " "

                # Create simplified response
                order_response = OrderListResponse(
                    order_id=order["order_id"],
                    order_number="#" + order["order_id"][:8].upper(),
                    preview_id=order.get("preview_id", ""),
                    status=status_map.get(current_step, "Order Received"),
                    current_step=current_step,
                    manufacturer=manufacturer_company_name,
                    is_cancelled=is_cancelled
                )
                
                # Store timestamp temporarily for sorting
                order_response._sort_timestamp = order_received_timestamp
                
                formatted_orders.append(order_response)
                
            except Exception as e:
                logging.error(f"Error parsing order {order.get('order_id', 'unknown')}: {e}")
                continue
        
        # Sort by order_received timestamp (newest first)
        formatted_orders.sort(
            key=lambda x: getattr(x, '_sort_timestamp', datetime.min) or datetime.min,
            reverse=True
        )
        
        # Remove temporary sorting attribute
        for order in formatted_orders:
            if hasattr(order, '_sort_timestamp'):
                delattr(order, '_sort_timestamp')
        
        return formatted_orders
        
    except Exception as e:
        logging.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch orders: {str(e)}")


@app.get("/order/detail/{order_id}", response_model=OrderDetailResponse)
async def get_order_detail(
    order_id: str,
    user: User = Depends(get_session)
):
    """
    Get comprehensive order tracking information.
    
    Returns all order details including:
    - Basic order info
    - Production specifications
    - Manufacturer information
    - Timing/progress data
    - Finalization data (if completed)
    """
    
    try:
        # ==================== FIND ORDER ====================
        order = orders.find_one({"order_id": order_id, "user_id": str(user.id)})
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # ==================== PARSE BASIC INFO ====================
        timing_table = order.get("order_timing_table", {})
        is_cancelled = order.get("is_cancelled", False)
        current_step = get_current_step(timing_table)
        is_completed = timing_table.get("ready_to_take") is not None
        
        # ==================== PARSE ESTIMATIONS ====================
        estimations_data = order.get("estimations", {})
        estimations = EstimationsResponse(
            estimated_weight=estimations_data.get("estimated_weight", 0.0),
            estimated_cost=estimations_data.get("estimated_cost", 0.0)
        )
        
        # ==================== PARSE ORDER SPECS ====================
        order_detail = order.get("order_detail", {})
        specs = OrderSpecsResponse(
            material=order_detail.get("material", "Unknown"),
            brand=order_detail.get("brand", "Unknown"),
            color=order_detail.get("color", "Unknown"),
            layer_height=order_detail.get("layer_height", 0.2),
            infill=order_detail.get("infill", 20)
        )
        
        # ==================== GET MANUFACTURER INFO ====================
        manufacturer_id = order.get("manufacturer_id")
        manufacturer = ManufacturerInfoResponse(manufacturer_id=manufacturer_id)

        company_to_manufacturer = {
            "company1": "Medipol TTO",
            "company2": "İTÜ TTO",
            "company3": "GTÜ TTO",
        }
        manufacturer = manufacturer_data.find_one({"user_id": order.get("manufacturer_id")})
        if manufacturer:
            manufacturer_company_name = company_to_manufacturer[manufacturer.get("company")]
        else: 
            manufacturer_company_name = " "


        if manufacturer_id:
            mfr_data = manufacturer_data.find_one({"user_id": manufacturer_id})
            if mfr_data:
                manufacturer = ManufacturerInfoResponse(
                    manufacturer_id=manufacturer_id,
                    company=manufacturer_company_name,
                    name=mfr_data.get("name"),
                    phone=mfr_data.get("phone")
                )
        
        # ==================== PARSE FINALIZATION DATA ====================
        finalization = None
        if is_completed or order.get("final_price"):
            finalization = FinalizationDataResponse(
                actual_filament_usage=order.get("actual_filament_usage"),
                final_price=order.get("final_price"),
                delivery_address=order.get("delivery_address"),
                manufacturer_notes=order.get("manufacturer_notes"),
                product_image_uploaded_at=parse_datetime(order.get("product_image_uploaded_at"))
            )
        
        # ==================== PARSE FILE INFO ====================
        files = FileInfoResponse(
            file_id=order.get("file_id"),
            preview_id=order.get("preview_id"),
            product_file_id=order.get("product_file_id")
        )
        
        # ==================== PARSE TIMING TABLE ====================
        timing_table_response = OrderTimingTableResponse(
            order_received=parse_timing_entry(timing_table.get("order_received")),
            assigned_to_manufacturer=parse_timing_entry(timing_table.get("assigned_to_manufacturer")),
            started_manufacturing=parse_timing_entry(timing_table.get("started_manufacturing")),
            produced=parse_timing_entry(timing_table.get("produced")),
            ready_to_take=parse_timing_entry(timing_table.get("ready_to_take"))
        )
        
        # ==================== BUILD STEPS ====================
        steps = build_steps(timing_table, is_cancelled)
        
        # ==================== PARSE TIMESTAMPS ====================
        created_at = None
        order_received = timing_table.get("order_received")
        if order_received:
            created_at = parse_datetime(order_received.get("timestamp"))
        
        last_updated = parse_datetime(order.get("last_updated"))
        
        # ==================== BUILD RESPONSE ====================
        return OrderDetailResponse(
            # Basic Info
            order_id=order["order_id"],
            order_number="#" + order["order_id"][:8].upper(),
            order_type=order.get("order_type", "FDM"),
            notes=order.get("notes"),
            
            # Status
            current_step=current_step,
            total_steps=5,
            status_label=get_status_label(timing_table, is_cancelled),
            is_cancelled=is_cancelled,
            is_completed=is_completed,
            
            # Data
            estimations=estimations,
            specs=specs,
            manufacturer=manufacturer,
            finalization=finalization,
            files=files,
            
            # Timing
            order_timing_table=timing_table_response,
            steps=steps,
            
            # Timestamps
            created_at=created_at,
            last_updated=last_updated
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching order detail: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch order detail: {str(e)}")


@app.post("/order/cancel/{order_id}", response_model=CancelOrderResponse)
async def cancel_order(
    order_id: str,
    user: User = Depends(get_session)
):
    """Cancel an order - set is_cancelled to True"""
    
    try:
        # Find order
        order = orders.find_one({"order_id": order_id, "user_id": str(user.id)})
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Check if already cancelled
        if order.get("is_cancelled", False):
            return CancelOrderResponse(
                success=False,
                message="Order is already cancelled",
                order_id=order_id
            )
        
        # Check if order can be cancelled (e.g., not if ready to take)
        timing_table = order.get("order_timing_table", {})
        if timing_table.get("ready_to_take"):
            raise HTTPException(
                status_code=400, 
                detail="Cannot cancel order that is already ready to take"
            )
        
        # Update order to cancelled
        result = orders.update_one(
            {"order_id": order_id, "user_id": str(user.id)},
            {"$set": {"is_cancelled": True}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to cancel order")
        
        logging.info(f"Order {order_id} cancelled by user {user.id}")
        
        return CancelOrderResponse(
            success=True,
            message="Order cancelled successfully",
            order_id=order_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error cancelling order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel order: {str(e)}")
    
    
@app.get("/order/product-image/{order_id}")
async def get_product_image(
    order_id: str,
    user: User = Depends(get_session)
):
    """
    Get the product image for a completed order.
    This image is uploaded by the manufacturer after production.
    """
    
    try:
        # Find the order
        order = orders.find_one({
            "order_id": order_id,
            "user_id": str(user.id)
        })
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Get product_file_id
        product_file_id = order.get("product_file_id")
        
        if not product_file_id:
            raise HTTPException(status_code=404, detail="Product image not found")
        
        # Try to find the file
        file_data = None
        content_type = "image/jpeg"
        
        # Method 1: Try as ObjectId
        try:
            file_data = fs.get(ObjectId(product_file_id))
            if file_data.content_type:
                content_type = file_data.content_type
        except Exception:
            pass
        
        # Method 2: Try finding by filename
        if not file_data:
            try:
                file_data = fs.find_one({"filename": product_file_id})
                if file_data and file_data.content_type:
                    content_type = file_data.content_type
            except Exception:
                pass
        
        # Method 3: Try finding by metadata
        if not file_data:
            try:
                file_data = fs.find_one({"metadata.file_id": product_file_id})
                if file_data and file_data.content_type:
                    content_type = file_data.content_type
            except Exception:
                pass
        
        if not file_data:
            raise HTTPException(status_code=404, detail="Product image file not found")
        
        # Read file content
        file_content = file_data.read()
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=product_{order_id}.jpg",
                "Cache-Control": "public, max-age=3600"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching product image for order {order_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch product image")