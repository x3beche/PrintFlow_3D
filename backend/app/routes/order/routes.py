from fastapi import Depends, UploadFile, File, HTTPException
from models.user import User
from routes.authentication.auth_modules import get_session
from app import app
from stl import mesh
from routes.order.models import *
from routes.order.modules import stl_to_png_bytes  
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
    """Upload 3D model file to GridFS and generate preview"""
    
    allowed_extensions = ['.stl', '.obj', '.3mf']
    file_extension = '.' + file.filename.split('.')[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    try:
        file_content = await file.read()
        
        # Calculate volume for STL files
        file_metadata = {}
        if file_extension == '.stl':
            file_metadata = calculate_volume_from_stl(file_content)
        
        # Upload original file to GridFS
        file_id = fs.put(
            file_content,
            filename=file.filename,
            content_type=file.content_type,
            user_id=str(user.id),
            upload_date=datetime.utcnow(),
            metadata=file_metadata
        )
        
        # Generate preview image from STL file
        preview_id = None
        if file_extension == '.stl':
            try:
                # Generate PNG preview
                png_bytes = stl_to_png_bytes(file_content)
                
                if png_bytes:
                    # Upload preview to GridFS with original_file_id reference
                    preview_id = fs.put(
                        png_bytes,
                        filename=f"preview_{file_id}.png",
                        content_type="image/png",
                        user_id=str(user.id),
                        upload_date=datetime.utcnow(),
                        metadata={
                            "type": "preview",
                            "original_file_id": str(file_id)  # ✅ File ID kaydediliyor
                        }
                    )
                    preview_id = str(preview_id)
                    print(f"Preview generated successfully: {preview_id}")
                    
            except Exception as preview_error:
                print(f"Preview generation error: {preview_error}")
                import traceback
                traceback.print_exc()
        
        return {
            "success": True,
            "file_id": str(file_id),
            "preview_id": preview_id,
            "filename": file.filename,
            "message": "File uploaded successfully",
            "file_info": file_metadata
        }
        
    except Exception as e:
        print(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")


@app.post("/order/new")
async def new_order_route(

    order_data: OrderData,
    user: User = Depends(get_session)
):
    """Create new order with uploaded file"""
    
    try:
        # Verify file exists
        try:
            file_obj_id = ObjectId(order_data.file_id)
            file_data = fs.get(file_obj_id)
        except Exception as file_error:
            print(f"File retrieval error: {file_error}")
            raise HTTPException(status_code=404, detail="File not found in database")
        
        # Get volume from file metadata
        if not hasattr(file_data, 'metadata') or not file_data.metadata:
            raise HTTPException(status_code=400, detail="File metadata not found")
        
        volume_cm3 = file_data.metadata.get('volume_cm3', 0)
        
        if volume_cm3 == 0:
            raise HTTPException(status_code=400, detail="File volume data not found. Please upload a valid STL file.")
        
        # ✅ Find preview_id from GridFS using file_id
        preview_id = None
        try:
            # GridFS'te original_file_id metadata'sı ile preview'i ara
            preview_file = fs.find_one({
                "metadata.original_file_id": order_data.file_id,
                "metadata.type": "preview"
            })
            
            if preview_file:
                preview_id = str(preview_file._id)
                print(f"Preview found for file_id {order_data.file_id}: {preview_id}")
            else:
                print(f"No preview found for file_id {order_data.file_id}")
                
        except Exception as preview_error:
            print(f"Preview lookup error: {preview_error}")
            # Preview bulunamazsa devam et, zorunlu değil
        
        # Calculate estimations from order_detail
        pricing_result = PricingConfig.calculate_price(
            volume_cm3=volume_cm3,
            material=order_data.order_detail.material.value if isinstance(order_data.order_detail.material, Enum) else order_data.order_detail.material,
            brand=order_data.order_detail.brand.value if isinstance(order_data.order_detail.brand, Enum) else order_data.order_detail.brand,
            order_type=order_data.order_type.value if isinstance(order_data.order_type, Enum) else order_data.order_type,
            infill=order_data.order_detail.infill,
            layer_height=order_data.order_detail.layer_height,
            quantity=1
        )
        
        estimations = OrderEstimations(
            estimated_weight=pricing_result['estimated_weight'],
            estimated_cost=pricing_result['estimated_cost']
        )
        
        # Generate unique order ID
        order_id = str(uuid.uuid4())
        
        # Create initial timing entry for ORDER_RECEIVED status
        initial_timing_entry = OrderTimingEntry(
            user_id=str(user.id),
            timestamp=datetime.utcnow(),
            status=OrderStatus.ORDER_RECEIVED
        )
        
        # Create timing table with initial entry
        timing_table = OrderTimingTable(
            order_received=initial_timing_entry
        )
        
        # Create OrderFormMain with preview_id
        order_form_main = OrderFormMain(
            order_id=order_id,
            user_id=str(user.id),
            estimations=estimations,
            file_id=order_data.file_id,
            notes=order_data.notes,
            order_type=order_data.order_type,
            order_detail=order_data.order_detail,
            order_timing_table=timing_table,
            preview_id=preview_id  # ✅ Otomatik bulunan preview_id
        )

        # Convert to dict and handle enum serialization
        order_dict = order_form_main.model_dump(mode='json')
        
        # Insert into database
        result = orders.insert_one(order_dict)
        
        print(f"Order created successfully: {order_form_main.order_id}")
            
        return {
            "success": True,
            "message": "Order received successfully",
            "order_id": order_form_main.order_id,
            "user_id": str(user.id),
            "db_id": str(result.inserted_id),
            "status": OrderStatus.ORDER_RECEIVED.value,
            "timestamp": initial_timing_entry.timestamp.isoformat(),
            "preview_id": preview_id,
            "estimations": {
                "estimated_weight": estimations.estimated_weight,
                "estimated_cost": estimations.estimated_cost
            },
            "order_data": order_data.model_dump(mode='json')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Order creation error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Order creation failed: {str(e)}")

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

@app.get("/order/preview/{preview_id}")
async def get_preview_image(
    preview_id: str,
    user: User = Depends(get_session)
):
    """Get preview image from GridFS (authenticated)"""
    try:
        from fastapi.responses import StreamingResponse
        
        preview_obj_id = ObjectId(preview_id)
        preview_data = fs.get(preview_obj_id)
        
        # Verify user has access to this preview
        if hasattr(preview_data, 'user_id') and preview_data.user_id != str(user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return StreamingResponse(
            io.BytesIO(preview_data.read()),
            media_type="image/png"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Preview retrieval error: {e}")
        raise HTTPException(status_code=404, detail="Preview not found")
     
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


@app.get("/order/{order_id}/timeline")
async def get_order_timeline(
    order_id: str,
    user: User = Depends(get_session)
):
    """Get complete timeline/history of an order"""
    try:
        order = orders.find_one({"order_id": order_id})
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Verify user has access to this order
        if order.get('user_id') != str(user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        timeline = []
        if 'order_timing_table' in order and 'entries' in order['order_timing_table']:
            for entry in order['order_timing_table']['entries']:
                timeline.append({
                    "status": entry['status'],
                    "status_text": OrderStatus(entry['status']).get_status_text(),
                    "timestamp": entry['timestamp'],
                    "user_id": entry['user_id']
                })
        
        # Sort by timestamp
        timeline.sort(key=lambda x: x['timestamp'])
        
        return {
            "success": True,
            "order_id": order_id,
            "timeline": timeline
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Timeline retrieval error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve order timeline")