import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OrderService, FileUploadResponse, EstimationRequest } from './order.service';
import { 
  BottomTexture, 
  Brand, 
  FDMConfig, 
  FDMMaterial, 
  SLAMaterial,
  OrderData, 
  OrderType,
  OrderEstimations 
} from './models';

@Component({
  selector: 'app-order',
  templateUrl: './order.component.html',
})
export class OrderComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  private subscription?: Subscription;
  private formSubscription?: Subscription;
  
  orderForm!: FormGroup;
  uploadedFile: File | null = null;
  uploadedFileName: string = '';
  uploadedFileId: string = '';
  isUploading: boolean = false;
  isCalculating: boolean = false;
  estimations: OrderEstimations | null = null;

  // Enums for template
  orderTypes = Object.values(OrderType);
  fdmMaterials = Object.values(FDMMaterial);
  slaMaterials = Object.values(SLAMaterial);
  bottomTextures = Object.values(BottomTexture);
  brands = Object.values(Brand);

  colors = ['Red', 'Blue', 'Yellow', 'Black', 'White', 'Green', 'Orange', 'Purple', 'Gray'];
  infillOptions = [10, 15, 20, 25, 30, 50, 75, 100];
  layerHeights = [0.1, 0.15, 0.2, 0.25, 0.3];
  nozzleSizes = [0.2, 0.4, 0.6, 0.8];
  quantities = [1, 5, 10, 20, 50, 100];

  constructor(
    private sidebarService: SidebarStateService,
    private orderService: OrderService,
    private fb: FormBuilder
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );

    this.initializeForm();
    this.setupAutoCalculation();
  }

  initializeForm(): void {
    this.orderForm = this.fb.group({
      orderType: [OrderType.FDM, Validators.required],
      material: [FDMMaterial.PLA, Validators.required],
      brand: [Brand.BAMBU_LAB, Validators.required],
      color: ['Red', Validators.required],
      layerHeight: [0.2, Validators.required],
      infill: [20, Validators.required],
      bottomTexture: [BottomTexture.PEI, Validators.required],
      nozzleSizes: [0.4, Validators.required],
      quantity: [10, Validators.required],
      notes: ['']
    });

    // Handle order type changes separately
    this.orderForm.get('orderType')?.valueChanges.subscribe(type => {
      this.onOrderTypeChange(type);
    });
  }

  setupAutoCalculation(): void {
    // Watch entire form for changes (excluding notes)
    this.formSubscription = this.orderForm.valueChanges.pipe(
      debounceTime(500), // Wait 500ms after user stops typing/selecting
      distinctUntilChanged((prev, curr) => {
        // Only trigger if relevant fields changed
        return prev.orderType === curr.orderType &&
               prev.material === curr.material &&
               prev.brand === curr.brand &&
               prev.layerHeight === curr.layerHeight &&
               prev.infill === curr.infill &&
               prev.quantity === curr.quantity;
      })
    ).subscribe(() => {
      if (this.uploadedFileId) {
        console.log('Form changed, recalculating estimation...');
        this.calculateEstimation();
      }
    });
  }

  onOrderTypeChange(type: OrderType): void {
    if (type === OrderType.FDM) {
      this.orderForm.patchValue({
        material: FDMMaterial.PLA,
        bottomTexture: BottomTexture.PEI
      }, { emitEvent: false }); // Don't trigger valueChanges
    } else if (type === OrderType.SLA) {
      this.orderForm.patchValue({
        material: SLAMaterial.STANDARD_RESIN
      }, { emitEvent: false }); // Don't trigger valueChanges
    }
    
    // Manually trigger calculation after order type change
    if (this.uploadedFileId) {
      setTimeout(() => this.calculateEstimation(), 100);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileUpload(input.files[0],);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFileUpload(event.dataTransfer.files[0],);
    }
  }

  handleFileUpload(file: File): void {
    const validExtensions = ['stl', 'obj', '3mf'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      alert('Invalid file type. Please upload .stl, .obj, or .3mf files.');
      return;
    }

    this.uploadedFile = file;
    this.uploadedFileName = file.name;
    this.isUploading = true;
    this.estimations = null;

    this.orderService.uploadFile(file).subscribe({
      next: (response: FileUploadResponse) => {
        this.isUploading = false;
        this.uploadedFileId = response.file_id;
        console.log('File uploaded successfully:', response);
        
        // Auto-calculate estimation after upload
        this.calculateEstimation();
      },
      error: (error) => {
        this.isUploading = false;
        this.uploadedFile = null;
        this.uploadedFileName = '';
        console.error('File upload failed:', error);
        alert('File upload failed. Please try again.');
      }
    });
  }

  get isFDM(): boolean {
    return this.orderForm.get('orderType')?.value === OrderType.FDM;
  }

  get isSLA(): boolean {
    return this.orderForm.get('orderType')?.value === OrderType.SLA;
  }

  calculateEstimation(): void {
    if (!this.uploadedFileId) {
      console.warn('No file uploaded yet');
      return;
    }

    if (this.isCalculating) {
      console.log('Already calculating, skipping...');
      return;
    }

    const formValue = this.orderForm.value;
    
    const estimationRequest: EstimationRequest = {
      file_id: this.uploadedFileId,
      material: formValue.material,
      brand: formValue.brand,
      order_type: formValue.orderType,
      infill: formValue.infill,
      layer_height: formValue.layerHeight,
      quantity: formValue.quantity
    };

    console.log('Calculating estimation with:', estimationRequest);

    this.isCalculating = true;

    this.orderService.calculateEstimation(estimationRequest).subscribe({
      next: (response) => {
        this.isCalculating = false;
        this.estimations = {
          estimated_weight: response.estimated_weight,
          estimated_cost: response.estimated_cost
        };
        console.log('Estimation calculated:', response);
      },
      error: (error) => {
        this.isCalculating = false;
        console.error('Estimation calculation failed:', error);
        
        // Show user-friendly error message
        const errorMsg = error.error?.detail || 'Failed to calculate estimation. Please try again.';
        alert(errorMsg);
      }
    });
  }

  onSubmit(): void {
    if (this.orderForm.invalid) {
      console.error('Form is invalid');
      alert('Please fill all required fields.');
      return;
    }

    if (!this.uploadedFileId) {
      console.error('No file uploaded');
      alert('Please upload a 3D model file first.');
      return;
    }

    const formValue = this.orderForm.value;
    
    const orderData: OrderData = {
      file_id: this.uploadedFileId,
      notes: formValue.notes || '',
      order_type: formValue.orderType,
      order_detail: this.isFDM ? {
        material: formValue.material,
        brand: formValue.brand,
        color: formValue.color,
        layer_height: formValue.layerHeight,
        infill: formValue.infill,
        bottom_texture: formValue.bottomTexture,
        nozzle_size: formValue.nozzleSizes
      } as FDMConfig : {
        material: formValue.material,
        brand: formValue.brand,
        color: formValue.color,
        layer_height: formValue.layerHeight,
        infill: formValue.infill,
        resin_type: formValue.material,
        uv_curing: "Standard"
      } as any
    };

    console.log('Submitting order:', orderData);

    this.orderService.createNewOrder(orderData).subscribe({
      next: (response) => {
        console.log('Order created successfully:', response);
        alert(`Order submitted successfully! Order ID: ${response.order_id}`);
        this.resetForm();
      },
      error: (error) => {
        console.error('Error creating order:', error);
        const errorMsg = error.error?.detail || 'Failed to submit order. Please try again.';
        alert(errorMsg);
      }
    });
  }

  resetForm(): void {
    this.orderForm.reset({
      orderType: OrderType.FDM,
      material: FDMMaterial.PLA,
      brand: Brand.BAMBU_LAB,
      color: 'Red',
      layerHeight: 0.2,
      infill: 20,
      bottomTexture: BottomTexture.PEI,
      nozzleSizes: 0.4,
      quantity: 10,
      notes: ''
    });
    this.uploadedFile = null;
    this.uploadedFileName = '';
    this.uploadedFileId = '';
    this.estimations = null;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.formSubscription?.unsubscribe();
  }
}