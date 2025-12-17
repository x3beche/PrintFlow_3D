import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';

export interface ManufacturingState {
  
  specs: {
    materialLabel: string;   
    brand: string;           
    colorName: string;       
    colorHex: string;        
    layerHeight: string;     
    infill: string;          
    buildPlate: string;      
  };

  file: {
    name: string;            
    size: string;            
    downloadUrl: string;     
  };

  customer: {
    fullName: string;        
    initials: string;        
    userId: string;          
    notes: string;           
    orderHistory: string;    
  };

  order: {
    id: string;             
    date: string;            
  };
}

@Component({
  selector: 'app-manifacturer-process',
  templateUrl: './manifacturer-process.component.html',
  styleUrl: './manifacturer-process.component.css'
})
export class ManifacturerProcessComponent {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  manufacturingState: ManufacturingState | null = null;

  isLoading = true;

  activeTabName: string = 'Finalization';

  steps = [
    { id: 1, label: 'Order Received', date: 'November 1, 2025, 09:00', completed: true },
    { id: 2, label: 'Assigned to Manufacturer', date: 'November 1, 2025, 10:00', completed: true },
    { id: 3, label: 'Started Manufacturing', date: 'November 2, 2025, 08:00', completed: false },
    { id: 4, label: 'Produced', date: 'November 3, 2025, 15:00', completed: false },
    { id: 5, label: 'Ready to Take', date: '-', completed: false }, 
  ];

  tabs = [
    { name: 'Manufacturing', active: false },
    { name: 'Finalization', active: true },
  ];

  constructor(
    private sidebarService: SidebarStateService,
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );
  
    this.loadState();
  }

  loadState() {
    
    setTimeout(() => {
      this.manufacturingState = {
        specs: {
          materialLabel: "PLA (FDM)",
          brand: "Bambu Lab",
          colorName: "Matte Red",
          colorHex: "#DC2626", // Kırmızı renk kodu
          layerHeight: "0.2 mm",
          infill: "20%",
          buildPlate: "Textured PEI"
        },
        file: {
          name: "project_files_v2.zip",
          size: "24.5 MB",
          downloadUrl: "/api/files/download/xyz-123"
        },
        customer: {
          fullName: "John Doe",
          initials: "JD",
          userId: "#8829102",
          orderHistory: "12 Completed",
          notes: "Please make sure the bottom layer is perfectly smooth as it will be visible. Also, I need this delivered before the weekend if possible."
        },
        order: {
          id: "ORD-992-11",
          date: "Nov 1, 2025"
        }
      };

      this.isLoading = false;
    }, 500);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  selectTab(selectedTab: any) {
    this.tabs.forEach(tab => tab.active = false);
    
    selectedTab.active = true;
    
    this.activeTabName = selectedTab.name;
  }
}
