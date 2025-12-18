import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../environment";
import {
  UserRegister,
  UserSettingsPasswordCredentials,
  UserSettingsProfileCredentials,
} from "../models/user";

export interface ManufacturerDetails {
  company: string;
  name: string;
  phone: string;
}

@Injectable({
  providedIn: "root",
})
export class UserService {
  private getUserApiUrl = `${environment.api}/user/`;
  private updateUserApiUrl = `${environment.api}/update_profile/`;
  private updateUserPasswordApiUrl = `${environment.api}/update_password/`;
  private updateProfilePictureApiUrl = `${environment.api}/update_profile_picture/`;
  private manufacturerDetailsApiUrl = `${environment.api}/manufacturer_details/`;

  constructor(private http: HttpClient) {}

  getUser(): Observable<UserRegister> {
    return this.http.get<UserRegister>(this.getUserApiUrl);
  }

  updateUserCredentials(
    credentials: UserSettingsProfileCredentials
  ): Observable<string> {
    return this.http.post<string>(this.updateUserApiUrl, credentials);
  }

  updateUserPassword(
    credentials: UserSettingsPasswordCredentials
  ): Observable<string> {
    return this.http.post<string>(this.updateUserPasswordApiUrl, credentials);
  }

  uploadFile(file: File): Observable<any> {
    const formData: FormData = new FormData();
    formData.append("profile_picture", file, file.name);

    return this.http.post(this.updateProfilePictureApiUrl, formData, {
      reportProgress: true,
      observe: "events",
    });
  }

  // Manufacturer Details Methods
  getManufacturerDetails(): Observable<ManufacturerDetails> {
    return this.http.get<ManufacturerDetails>(this.manufacturerDetailsApiUrl);
  }

  updateManufacturerDetails(details: ManufacturerDetails): Observable<any> {
    return this.http.post<any>(this.manufacturerDetailsApiUrl, details);
  }
}