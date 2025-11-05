import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthGuard } from 'src/app/guards/auth-guard';
import { IGroup } from '../ecommerce.interface';

@Injectable({
  providedIn: 'root',
})
export class GroupsService {
  private readonly baseUrl = environment.apiUrl.cdService;
  private readonly http = inject(HttpClient);
  private readonly authGuard = inject(AuthGuard);

  private getHeaders(contentType: string = 'application/json'): HttpHeaders {
    const token = this.authGuard.getToken();
    const headers: { [key: string]: string } = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };

    // Only add Content-Type if it is not multipart/form-data
    // as the browser automatically sets it to the correct limit
    if (contentType && contentType !== 'multipart/form-data') {
      headers['Content-Type'] = contentType;
    }

    return new HttpHeaders(headers);
  }

  getGroups(): Observable<IGroup[]> {
    const headers = this.getHeaders();

    return this.http
      .get<any>(`${this.baseUrl}groups`, { headers })
      .pipe(
        map((response) => {
          // Handle different response formats
          let groups: any[] = [];

          if (Array.isArray(response)) {
            // If the response is already an array
            groups = response;
          } else if (response && typeof response === 'object') {
            // If the response is an object with a $values property (common in .NET Core)
            if (response.hasOwnProperty('$values')) {
              groups = response.$values || [];
            } else if (response.hasOwnProperty('data')) {
              // If the response has a data property (common in some APIs)
              groups = response.data || [];
            } else {
              // If it's an object but not in the expected format, try to convert it to an array
              groups = Object.values(response);
            }
          }

          return groups as IGroup[];
        }),
        catchError((error: any) => {
          console.error('Error in getGroups:', error);
          return of([]); // Return empty array on error to prevent breaking the subscription
        })
      );
  }

  addGroup(group: IGroup): Observable<IGroup> {
    // Create a clean object with only the necessary properties
    const groupToSend = {
      nameGroup: group.nameGroup,
      imageUrl: group.imageGroup || '', 
      musicGenreId: group.musicGenreId
    };

    // Force the Content-Type header to application/json
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authGuard.getToken()}`,
      'Accept': 'application/json'
    });
    
    // Application Options
    const httpOptions = {
      headers: headers,
      reportProgress: true,
      withCredentials: false // Disable withCredentials to avoid CORS issues
    };
    
    // Make the request with JSON.stringify para asegurar que los datos se envíen correctamente
    return this.http.post<IGroup>(
      `${this.baseUrl}Groups`,
      JSON.stringify(groupToSend),
      httpOptions
    ).pipe(
      map((response) => {
        
        // If the server returns null in imageGroup, maintain the original value
        if (response && response.imageGroup === null && groupToSend.imageUrl) {
          return {
            ...response,
            imageGroup: groupToSend.imageUrl
          };
        }
        return response;
      }),
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Error al crear el grupo';
        
        // Extract error message from server if available
        if (error.error?.errors) {
          // Handling ModelState validation errors
          const validationErrors = Object.entries(error.error.errors)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : String(errors)}`)
            .join('; ');
          errorMessage = `Error de validación: ${validationErrors}`;
        } else if (error.error) {
          // Handling other types of server errors
          const serverError = error.error;
          if (typeof serverError === 'object') {
            errorMessage = serverError.title || serverError.message || 
                         (serverError.error ? String(serverError.error) : 'Unknown server error');
          } else if (typeof serverError === 'string') {
            errorMessage = serverError;
          }
        }

        console.error('[GroupsService] Error creating group:', {
          status: error.status,
          error: error.error,
          message: error.message,
          url: error.url,
          errorDetails: errorMessage
        });
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  updateGroup(group: IGroup): Observable<IGroup> {
    // Create a clean object with only the necessary properties
    const groupToSend = {
      idGroup: group.idGroup,
      nameGroup: group.nameGroup,
      imageUrl: group.imageGroup || '', // Cambiar a imageUrl para que coincida con el backend
      musicGenreId: group.musicGenreId
    };

    // Force the Content-Type header to application/json
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authGuard.getToken()}`,
      'Accept': 'application/json'
    });
    
    // Application Options
    const httpOptions = {
      headers: headers,
      reportProgress: true,
      withCredentials: false // Disable withCredentials to avoid CORS issues
    };
    
    const url = `${this.baseUrl}Groups/${group.idGroup}`;
    
    // Make the request with JSON.stringify para asegurar que los datos se envíen correctamente
    return this.http.put<IGroup>(
      url,  
      JSON.stringify(groupToSend),
      httpOptions
    ).pipe(
      map((response) => {
        // If the server returns null in imageGroup, maintain the original value
        if (response && response.imageGroup === null && groupToSend.imageUrl) {
          return {
            ...response,
            imageGroup: groupToSend.imageUrl
          };
        }
        return response;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('[GroupsService] Error in updateGroup - Full error:', error);
        let errorMessage = 'Error updating group';
        
        // Extract error message from server if available
        if (error.error?.errors) {
          // Handling ModelState validation errors
          const validationErrors = Object.entries(error.error.errors)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : String(errors)}`)
            .join('; ');
          errorMessage = `Error de validación: ${validationErrors}`;
        } else if (error.error) {
          // Handling other types of server errors
          const serverError = error.error;
          if (typeof serverError === 'object') {
            errorMessage = serverError.title || serverError.message || 
                         (serverError.error ? String(serverError.error) : 'Error desconocido del servidor');
          } else if (typeof serverError === 'string') {
            errorMessage = serverError;
          }
        }

        console.error('[GroupsService] Error updating group:', {
          status: error.status,
          error: error.error,
          message: error.message,
          url: error.url,
          errorDetails: errorMessage
        });
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }


  deleteGroup(id: number): Observable<IGroup> {
    const headers = this.getHeaders();
    return this.http.delete<IGroup>(`${this.baseUrl}groups/${id}`, {
      headers,
    });
  }

  getGroupName(idGroup: string | number): Observable<string> {
    const headers = this.getHeaders();
    return this.http
      .get<any>(`${this.baseUrl}groups/${idGroup}`, { headers })
      .pipe(
        map((response) => {

          // Handle direct group object
          if (
            response &&
            typeof response === 'object' &&
            'nameGroup' in response
          ) {
            return response.nameGroup;
          }

          // Handle $values wrapper
          if (
            response &&
            response.$values &&
            typeof response.$values === 'object'
          ) {
            if (
              Array.isArray(response.$values) &&
              response.$values.length > 0
            ) {
              return response.$values[0].nameGroup || '';
            }
            if ('nameGroup' in response.$values) {
              return response.$values.nameGroup;
            }
          }

          return '';
        })
      );
  }
}
