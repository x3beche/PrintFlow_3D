from fastapi import Depends, UploadFile, File, HTTPException
from models.user import User
from routes.authentication.auth_modules import get_session
from app import app
from stl import mesh
from routes.order.models import *  
from crud.databases import orders, fs
import uuid
import io
from bson import ObjectId
from datetime import datetime

def calculate_volume_from_stl(file_content: bytes) -> dict:
    """Calculate volume from STL file"""
    try:
        stl_mesh = mesh.Mesh.from_file('temp', fh=io.BytesIO(file_content))
        volume, cog, inertia = stl_mesh.get_mass_properties()
        volume_cm3 = volume / 1000
        
        return {
            "volume_mm3": round(volume, 2),
            "volume_cm3": round(volume_cm3, 2)
        }
    except Exception as e:
        print(f"Volume calculation error: {e}")
        return {
            "volume_mm3": 0,
            "volume_cm3": 0
        }

@app.post("/order/upload-file")
async def upload_file_route(
    file: UploadFile = File(...),
    user: User = Depends(get_session)
):
    """Upload 3D model file to GridFS"""
    
    allowed_extensions = ['.stl', '.obj', '.3mf']
    file_extension = '.' + file.filename.split('.')[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    try:
        file_content = await file.read()
        
        file_metadata = {}
        if file_extension == '.stl':
            file_metadata = calculate_volume_from_stl(file_content)
        
        file_id = fs.put(
            file_content,
            filename=file.filename,
            content_type=file.content_type,
            user_id=str(user.id),
            upload_date=datetime.utcnow(),
            metadata=file_metadata
        )
        
        return {
            "success": True,
            "file_id": str(file_id),
            "filename": file.filename,
            "message": "File uploaded successfully",
            "file_info": file_metadata
        }
        
    except Exception as e:
        print(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@app.post("/order/calculate-estimation")
async def calculate_estimation_route(
    request: EstimationRequest,
    user: User = Depends(get_session)
):
    """Calculate price estimation based on file and parameters"""
    
    try:
        # Get file from GridFS
        file_obj_id = ObjectId(request.file_id)
        file_data = fs.get(file_obj_id)
        
        if not hasattr(file_data, 'metadata') or not file_data.metadata:
            raise HTTPException(status_code=400, detail="File metadata not found. Please upload an STL file.")
        
        volume_cm3 = file_data.metadata.get('volume_cm3', 0)
        
        if volume_cm3 == 0:
            raise HTTPException(status_code=400, detail="Volume calculation failed")
        
        # Use PricingConfig to calculate price
        result = PricingConfig.calculate_price(
            volume_cm3=volume_cm3,
            material=request.material,
            brand=request.brand,
            order_type=request.order_type,
            infill=request.infill,
            layer_height=request.layer_height,
            quantity=request.quantity
        )
        
        return {
            "success": True,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Estimation calculation error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Estimation failed: {str(e)}")

@app.post("/order/new")
async def new_order_route(
    order_data: OrderData,
    user: User = Depends(get_session)
):
    """Create new order with uploaded file"""
    
    try:
        file_obj_id = ObjectId(order_data.file_id)
        file_exists = fs.exists({"_id": file_obj_id})
        if not file_exists:
            raise HTTPException(status_code=404, detail="File not found in database")
        
        order_form = OrderForm(
            user_id=str(user.id),
            data=order_data,
            order_id=str(uuid.uuid4())
        )

        result = orders.insert_one(order_form.model_dump())
        
        print(f"Order created successfully: {order_form.order_id}")
            
        return {
            "success": True,
            "message": "Order received successfully",
            "order_id": order_form.order_id,
            "order_data": order_data.model_dump(),
            "user_id": str(user.id),
            "db_id": str(result.inserted_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Order creation error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Order creation failed: {str(e)}")

@app.get("/order/file/{file_id}")
async def get_file_info(
    file_id: str,
    user: User = Depends(get_session)
):
    """Get file information from GridFS"""
    try:
        file_obj_id = ObjectId(file_id)
        file_data = fs.get(file_obj_id)
        
        return {
            "success": True,
            "file_id": str(file_data._id),
            "filename": file_data.filename,
            "content_type": file_data.content_type,
            "upload_date": file_data.upload_date,
            "length": file_data.length,
            "metadata": file_data.metadata if hasattr(file_data, 'metadata') else {}
        }
    except Exception as e:
        print(f"File info error: {e}")
        raise HTTPException(status_code=404, detail="File not found")

@app.get("/order/list")
async def list_orders(
    user: User = Depends(get_session)
):
    """List all orders for current user"""
    try:
        user_orders = list(orders.find({"user_id": str(user.id)}))
        
        for order in user_orders:
            order['_id'] = str(order['_id'])
        
        return {
            "success": True,
            "orders": user_orders,
            "count": len(user_orders)
        }
    except Exception as e:
        print(f"List orders error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve orders")