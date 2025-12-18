from fastapi import HTTPException, Depends
from typing import List
import logging
from models.user import User
from routes.authentication.auth_modules import get_session
from app import app
from datetime import datetime
from crud.databases import orders
from pydantic import BaseModel
from typing import Union, Dict, Optional

# Simplified response model - only necessary fields
class OrderListResponse(BaseModel):
    order_id: str
    order_number: str
    preview_id: str
    status: str
    current_step: int
    manufacturer: str
    is_cancelled: bool

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
                current_step = 1
                if timing_table.get("ready_to_take"):
                    current_step = 5
                elif timing_table.get("produced"):
                    current_step = 4
                elif timing_table.get("started_manufacturing"):
                    current_step = 3
                elif timing_table.get("assigned_to_manufacturer"):
                    current_step = 2
                elif timing_table.get("order_received"):
                    current_step = 1
                
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
                
                # Create simplified response
                order_response = OrderListResponse(
                    order_id=order["order_id"],
                    order_number="#" + order["order_id"][:8],
                    preview_id=order.get("preview_id", ""),
                    status=status_map.get(current_step, "Order Received"),
                    current_step=current_step,
                    manufacturer="TTO Office",
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

class OrderDetailResponse(BaseModel):
    order_id: str
    order_number: str
    order_timing_table: OrderTimingTableResponse
    current_step: int
    is_cancelled: bool

@app.get("/order/detail/{order_id}", response_model=OrderDetailResponse)
async def get_order_detail(
    order_id: str,
    user: User = Depends(get_session)
):
    """Get detailed order tracking information"""
    
    try:
        # Find order
        order = orders.find_one({"order_id": order_id, "user_id": str(user.id)})
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Get timing table
        timing_table = order.get("order_timing_table", {})
        
        # Parse timing entries
        def parse_entry(entry_data):
            if not entry_data:
                return None
            return OrderTimingEntryResponse(
                user_id=entry_data.get("user_id", ""),
                timestamp=entry_data.get("timestamp", datetime.utcnow()),
                status=entry_data.get("status", "")
            )
        
        timing_table_response = OrderTimingTableResponse(
            order_received=parse_entry(timing_table.get("order_received")),
            assigned_to_manufacturer=parse_entry(timing_table.get("assigned_to_manufacturer")),
            started_manufacturing=parse_entry(timing_table.get("started_manufacturing")),
            produced=parse_entry(timing_table.get("produced")),
            ready_to_take=parse_entry(timing_table.get("ready_to_take"))
        )
        
        # Determine current step
        current_step = 1
        if timing_table.get("ready_to_take"):
            current_step = 5
        elif timing_table.get("produced"):
            current_step = 4
        elif timing_table.get("started_manufacturing"):
            current_step = 3
        elif timing_table.get("assigned_to_manufacturer"):
            current_step = 2
        
        return OrderDetailResponse(
            order_id=order["order_id"],
            order_number="#" + order["order_id"][:8],
            order_timing_table=timing_table_response,
            current_step=current_step,
            is_cancelled=order.get("is_cancelled", False)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching order detail: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch order detail: {str(e)}")
    

class CancelOrderResponse(BaseModel):
    success: bool
    message: str
    order_id: str

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