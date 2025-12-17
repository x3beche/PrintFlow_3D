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

const routes: Routes = [
  { path: "", component: HomeComponent, canActivate: [ReverseAuthGuard] },
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
  {
    path: "order",
    component: OrderComponent,
    canActivate: [AuthGuard],
  },
  {
    path: "profile/settings",
    component: UserSettingsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: "admin/users",
    component: AdminComponent,
    canActivate: [AuthGuard],
  },
  {
    path: "manufacturer/process",
    component: ManifacturerProcessComponent,
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
