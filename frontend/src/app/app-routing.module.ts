import { ManifacturerProcessComponent } from './dashboard/manifacturer-process/manifacturer-process.component';
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { HomeComponent } from "./home/home.component";
import { AuthGuard, ReverseAuthGuard } from "./auth/auth-guard";
import { RegisterComponent } from "./auth/register/register.component";
import { ResetPasswordComponent } from "./auth/reset-password/reset-password.component";
import { UserSettingsComponent } from "src/app/user/user-settings/user-settings.component";
import { AdminComponent } from "./admin/user-dashboard/admin.component";
import { ContentComponent } from "./content/content.component";
import { ForgetPasswordComponent } from "./auth/forget-password/forget-password.component";
import { OrderComponent } from "./dashboard/order/order.component";
import { ManifacturerPoolComponent } from './dashboard/manifacturer-pool/manifacturer-pool.component';
import { OrderListComponent } from './dashboard/order-list/order-list.component';

const routes: Routes = [
  { 
    path: "", 
    component: HomeComponent, 
    canActivate: [ReverseAuthGuard] 
  },
  {
    path: "forget_password",
    component: ForgetPasswordComponent,
    canActivate: [ReverseAuthGuard],
  },
  {
    path: "reset_password",
    component: ResetPasswordComponent,
    canActivate: [ReverseAuthGuard],
  },
  {
    path: "register",
    component: RegisterComponent,
    canActivate: [ReverseAuthGuard],
  },
  
  // USER ROUTES
  {
    path: "order/new",
    component: OrderComponent,
    canActivate: [AuthGuard],
    data: { roles: ['user','admin'] }
  },
  {
    path: "order/list",
    component: OrderListComponent,
    canActivate: [AuthGuard],
    data: { roles: ['user', 'admin'] }
  },
  
  // MANUFACTURER ROUTES
  {
    path: "manufacturer/order/pool",
    component: ManifacturerPoolComponent,
    canActivate: [AuthGuard],
    data: { roles: ['manufacturer'] }
  },
  {
    path: 'manufacturer/process/:order_id',
    component: ManifacturerProcessComponent,
    canActivate: [AuthGuard],
    data: { roles: ['manufacturer'] }
  },
  
  // SHARED ROUTES (accessible by both user and manufacturer)
  {
    path: "profile/settings",
    component: UserSettingsComponent,
    canActivate: [AuthGuard],
    data: { roles: ['user', 'manufacturer', 'admin'] }
  },
  
  // ADMIN ROUTES
  {
    path: "admin/users",
    component: AdminComponent,
    canActivate: [AuthGuard],
    data: { roles: ['admin'] }
  },

  // FALLBACK - Redirect unknown routes
  {
    path: "**",
    redirectTo: "",
    pathMatch: "full"
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}