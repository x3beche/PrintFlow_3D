import { Component, OnInit, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { UserService } from "src/app/user/user.service";
import {
  UserRegister,
  UserSettingsPasswordCredentials,
  UserSettingsProfileCredentials,
} from "src/app/models/user";
import { Message } from "src/app/models/utils";
import { HttpEventType, HttpResponse } from "@angular/common/http";
import { Dismiss } from "flowbite";
import type { DismissOptions, DismissInterface } from "flowbite";
import type { InstanceOptions } from "flowbite";
import { SidebarStateService } from "src/app/services/sidebar-state.service";
import { AuthService } from "src/app/auth/auth-service.service";

export interface ManufacturerDetails {
  company: string;
  name: string;
  phone: string;
}

@Component({
  selector: "app-user-settings",
  templateUrl: "./user-settings.component.html",
})
export class UserSettingsComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  // Kullanıcı rolü kontrolü için
  isManufacturer: boolean = false;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private sidebarService: SidebarStateService
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  user!: UserRegister;

  user_profile_credentials: UserSettingsProfileCredentials = {
    email: "",
    username: "",
    first_name: "",
    last_name: "",
    process: false,
  };

  user_password_credentials: UserSettingsPasswordCredentials = {
    current_password: "",
    password: "",
    re_password: "",
    process: false,
  };

  // Manufacturer details için model
  manufacturer_details: ManufacturerDetails & { process: boolean } = {
    company: '',
    name: '',
    phone: '',
    process: false
  };

  // Her kart için ayrı mesaj dizileri
  profileMessages: Message[] = [];
  passwordMessages: Message[] = [];
  photoMessages: Message[] = [];
  manufacturerMessages: Message[] = [];

  alertdismis!: DismissInterface;

  selectedFile?: File;
  uploadProgress: number = 0;
  uploadMessage: string = "";
  profilePictureUploadStatus = false;

  initAlertArea(): void {
    const $targetEl: HTMLElement | null = document.getElementById("toast-interactive");
    const $triggerEl: HTMLElement | null = document.getElementById("1231231231231");

    const options: DismissOptions = {
      transition: "transition-opacity",
      duration: 1000,
      timing: "ease-out",
      onHide: (context, targetEl) => {
        console.log("element has been dismissed");
        console.log(targetEl);
      },
    };

    const instanceOptions: InstanceOptions = {
      id: "targetElement",
      override: true,
    };

    const dismiss: DismissInterface = new Dismiss(
      $targetEl,
      $triggerEl,
      options,
      instanceOptions
    );

    this.alertdismis = dismiss;
  }

  hideNotification() {
    this.alertdismis?.hide();
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      (collapsed) => (this.sidebarCollapsed = collapsed)
    );

    // Kullanıcı rolünü kontrol et
    this.isManufacturer = this.authService.hasRole('manufacturer');
    
    console.log('Is Manufacturer:', this.isManufacturer);

    // Mevcut kullanıcı bilgilerini yükle
    this.userService.getUser().subscribe({
      next: (user: UserRegister) => {
        this.user_profile_credentials = {
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          process: false,
        };
        
        console.log('User loaded:', user);
      },
      error: (error) => {
        console.error('Failed to load user:', error);
        this.profileMessages = [{ 
          status: false, 
          text: 'Failed to load user data.' 
        }];
      }
    });

    // Eğer manufacturer ise, mevcut manufacturer bilgilerini yükle
    if (this.isManufacturer) {
      console.log('Loading manufacturer details...');
      this.loadManufacturerDetails();
    }

    // Flowbite alert init ve kapatma
    this.initAlertArea();
    this.hideNotification();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  updateProfile(): void {
    // Mesajları temizle
    this.profileMessages = [];
    
    this.user_profile_credentials.process = true;
    this.userService.updateUserCredentials(this.user_profile_credentials).subscribe({
      next: () => {
        this.profileMessages = [{ 
          status: true, 
          text: 'Profile updated successfully!' 
        }];
      },
      error: (error) => {
        this.profileMessages = [{ 
          status: false, 
          text: 'Failed to update profile.' 
        }];
        console.error('Profile update error:', error);
      },
      complete: () => {
        this.user_profile_credentials.process = false;
      },
    });
  }

  updatePassword(): void {
    // Mesajları temizle
    this.passwordMessages = [];
    
    if (
      this.user_password_credentials.password !=
      this.user_password_credentials.re_password
    ) {
      this.passwordMessages = [{ 
        status: false, 
        text: "Passwords do not match each other." 
      }];
    } else {
      this.user_password_credentials.process = true;
      this.userService.updateUserPassword(this.user_password_credentials).subscribe({
        next: (response) => {
          this.passwordMessages = [{ 
            status: true, 
            text: response || 'Password updated successfully!' 
          }];
          // Formu temizle
          this.user_password_credentials.current_password = '';
          this.user_password_credentials.password = '';
          this.user_password_credentials.re_password = '';
        },
        error: (response) => {
          this.passwordMessages = [{ 
            status: false, 
            text: response.error?.detail || 'Failed to update password.' 
          }];
          this.user_password_credentials.process = false;
        },
        complete: () => {
          this.user_password_credentials.process = false;
        },
      });
    }
  }

  onFileChange(event: any): void {
    this.selectedFile = event.target.files[0];
    // Mesajları temizle
    this.photoMessages = [];
  }

  upload(): void {
    // Mesajları temizle
    this.photoMessages = [];
    
    if (!this.selectedFile) {
      this.photoMessages = [{ 
        status: false, 
        text: 'Please select a file first.' 
      }];
      return;
    }

    this.profilePictureUploadStatus = true;
    this.userService.uploadFile(this.selectedFile).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = Math.round((100 * event.loaded) / event.total);
        } else if (event instanceof HttpResponse) {
          this.photoMessages = [{ 
            status: true, 
            text: 'File uploaded successfully!' 
          }];
        }
      },
      error: (_err: any) => {
        this.uploadProgress = 0;
        this.photoMessages = [{ 
          status: false, 
          text: 'File upload failed!' 
        }];
        this.profilePictureUploadStatus = false;
      },
      complete: () => {
        this.profilePictureUploadStatus = false;
        // Başarılı upload sonrası 2 saniye bekle ve sayfayı yenile
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      },
    });
  }

  // Manufacturer bilgilerini yükle
  loadManufacturerDetails(): void {
    console.log('Fetching manufacturer details from API...');
    
    this.userService.getManufacturerDetails().subscribe({
      next: (data: ManufacturerDetails) => {
        console.log('Manufacturer details received:', data);
        
        this.manufacturer_details = {
          company: data.company || '',
          name: data.name || '',
          phone: data.phone || '',
          process: false
        };
        
        console.log('Manufacturer details loaded successfully:', this.manufacturer_details);
      },
      error: (error) => {
        console.error('Failed to load manufacturer details:', error);
        
        // Eğer 403 hatası alırsak (yetkisiz erişim)
        if (error.status === 403) {
          this.manufacturerMessages = [{ 
            status: false, 
            text: 'You do not have permission to access manufacturer details.' 
          }];
        } else {
          this.manufacturerMessages = [{ 
            status: false, 
            text: 'Failed to load manufacturer details. Please try again.' 
          }];
        }
      }
    });
  }

  // Manufacturer bilgilerini güncelle
  updateManufacturerDetails(): void {
    console.log('Updating manufacturer details:', this.manufacturer_details);
    
    // Mesajları temizle
    this.manufacturerMessages = [];
    
    // Validasyon
    if (!this.manufacturer_details.company || !this.manufacturer_details.name || !this.manufacturer_details.phone) {
      this.manufacturerMessages = [{ 
        status: false, 
        text: 'Please fill all fields.' 
      }];
      return;
    }
    
    this.manufacturer_details.process = true;
    
    const details: ManufacturerDetails = {
      company: this.manufacturer_details.company,
      name: this.manufacturer_details.name,
      phone: this.manufacturer_details.phone
    };

    this.userService.updateManufacturerDetails(details).subscribe({
      next: (response) => {
        console.log('Update response:', response);
        
        this.manufacturerMessages = [{ 
          status: true, 
          text: response.text || 'Manufacturer details updated successfully!' 
        }];
      },
      error: (error) => {
        console.error('Update error:', error);
        
        this.manufacturerMessages = [{ 
          status: false, 
          text: error.error?.detail || 'Failed to update manufacturer details.' 
        }];
        this.manufacturer_details.process = false;
      },
      complete: () => {
        this.manufacturer_details.process = false;
      }
    });
  }
}