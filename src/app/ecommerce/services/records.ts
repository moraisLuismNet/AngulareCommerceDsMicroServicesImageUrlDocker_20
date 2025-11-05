import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { Observable, tap, map, catchError, throwError, of, switchMap } from "rxjs";
import { environment } from "src/environments/environment";
import { AuthGuard } from "src/app/guards/auth-guard";
import { IRecord } from "../ecommerce.interface";
import { StockService } from "./stock";

@Injectable({
  providedIn: "root",
})
export class RecordsService {
  private readonly baseUrl = environment.apiUrl.cdService;
  private readonly http = inject(HttpClient);
  private readonly authGuard = inject(AuthGuard);
  private readonly stockService = inject(StockService);


  getRecords(): Observable<IRecord[]> {
    const headers = this.getHeaders();
    return this.http.get<any>(`${this.baseUrl}records`, { headers }).pipe(
      map((response) => {
        // Handle different response formats
        if (Array.isArray(response)) {
          return response;
        } else if (response && response.$values) {
          return response.$values;
        } else if (response && response.records) {
          return response.records;
        }
        return [];
      }),
      tap((records) => {
        if (records && records.length > 0) {
          records.forEach((record: IRecord) => {
            const stock = typeof record.stock === 'number' ? record.stock : 0;
            this.stockService.updateStock(record.idRecord, stock);
          });
        }
      }),
      catchError((error) => {
        console.error('[RecordsService] Error getting records:', error);
        return of([]);
      })
    );
  }

  getRecordById(id: number): Observable<IRecord> {
    const headers = this.getHeaders();
    const url = `${this.baseUrl}records/${id}`;
    
    return this.http.get<IRecord>(url, { headers }).pipe(
      switchMap((record: IRecord) => {
        if (record.groupName || record.nameGroup) {
          console.log(`[RecordsService] Record ${id} already has group name:`, {
            groupId: record.groupId,
            groupName: record.groupName,
            nameGroup: record.nameGroup
          });
          return of(record);
        }
        
        // If it doesn't have a group name but it does have a groupId, we search for the group
        if (record.groupId) {
          const groupUrl = `${this.baseUrl}groups/${record.groupId}`;
          return this.http.get<{nameGroup?: string; groupName?: string}>(groupUrl, { headers }).pipe(
            map(groupResponse => {
              const groupName = groupResponse?.nameGroup || groupResponse?.groupName || 'Sin grupo';
              return {
                ...record,
                groupName: groupName,
                nameGroup: groupName
              } as IRecord;
            }),
            catchError(groupError => {
              console.error(`[RecordsService] Error getting group for record ${id}:`, groupError);
              return of({
                ...record,
                groupName: 'Error cargando grupo',
                nameGroup: 'Error cargando grupo'
              } as IRecord);
            })
          );
        }
        
        return of(record);
      }),
      catchError((error: any) => {
        console.error(`[RecordsService] Error getting record with id ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  addRecord(record: IRecord): Observable<IRecord> {
    const headers = this.getHeaders();
    
    // Create the complete record object to send
    // Map imageRecord to ImageUrl to match backend DTO
    const recordToSend = {
      idRecord: record.idRecord,
      titleRecord: record.titleRecord,
      yearOfPublication: record.yearOfPublication,
      ImageUrl: record.imageRecord || null,  // Map to ImageUrl for backend
      price: record.price,
      stock: record.stock,
      discontinued: record.discontinued,
      groupId: record.groupId,
      groupName: record.groupName || '',
      nameGroup: record.nameGroup || ''
    };
    
    return this.http.post<IRecord>(
      `${this.baseUrl}Records`,
      recordToSend,
      { 
        headers,
        reportProgress: true,
        observe: 'response' as const  // Get the full response including headers and status
      }
    ).pipe(
      map(response => {
        if (!response.body) {
          throw new Error('Empty response from server');
        }
        return response.body;
      }),
      tap((newRecord: IRecord) => {
        if (newRecord && newRecord.idRecord !== undefined) {
          this.stockService.notifyStockUpdate(
            newRecord.idRecord,
            newRecord.stock || 0
          );
        }
      }),
      catchError((error: any) => {
        console.error('[RecordsService] Error creating record:', {
          error,
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          message: error.message,
          errorDetails: error.error
        });
        return throwError(() => error);
      })
    );
  }

  updateRecord(record: IRecord): Observable<IRecord> {
    const headers = this.getHeaders();
    
    // Create the complete record object to send
    // Map imageRecord to ImageUrl to match backend DTO
    const recordToUpdate = {
      idRecord: record.idRecord,
      titleRecord: record.titleRecord,
      yearOfPublication: record.yearOfPublication,
      ImageUrl: record.imageRecord || null,  // Map to ImageUrl for backend
      price: record.price,
      stock: record.stock,
      discontinued: record.discontinued,
      groupId: record.groupId,
      groupName: record.groupName || '',
      nameGroup: record.nameGroup || ''
    };

    return this.http.put<IRecord>(
      `${this.baseUrl}records/${record.idRecord}`,
      recordToUpdate,
      { 
        headers,
        observe: 'response' as const
      }
    ).pipe(
      map(response => {
        if (!response.body) {
          throw new Error('Empty response from server');
        }
        return response.body;
      }),
      tap((updatedRecord: IRecord) => {
        this.stockService.notifyStockUpdate(
          updatedRecord.idRecord,
          updatedRecord.stock || 0
        );
      }),
      catchError((error: any) => {
        console.error('[RecordsService] Error updating record:', {
          error,
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          message: error.message,
          errorDetails: error.error
        });
        return throwError(() => error);
      })
    );
  }

  deleteRecord(id: number): Observable<IRecord> {
    const headers = this.getHeaders();
    return this.http
      .delete<IRecord>(`${this.baseUrl}records/${id}`, {
        headers
      })
      .pipe(
        tap((deletedRecord: IRecord) => {
          this.stockService.notifyStockUpdate(deletedRecord.idRecord, 0);
        })
      );
  }

  getRecordsByGroup(idGroup: string | number): Observable<IRecord[]> {
    const headers = this.getHeaders();
    return this.http
      .get<any>(`${this.baseUrl}groups/recordsByGroup/${idGroup}`, { headers })
      .pipe(
        map((response) => {
          let records: IRecord[];
          let groupName = "";
          // Handle direct record array response
          if (Array.isArray(response)) {
            records = response;
          }
          // Handle $values wrapper
          else if (response && response.$values) {
            records = response.$values;
          }
          // Handle records nested in group response
          else if (
            response &&
            typeof response === "object" &&
            response.records
          ) {
            if (Array.isArray(response.records)) {
              records = response.records;
            } else if (response.records.$values) {
              records = response.records.$values;
            } else if (typeof response.records === "object") {
              records = Object.values(response.records).filter(
                (val): val is IRecord => {
                  if (!val || typeof val !== "object") return false;
                  const v = val as any;
                  return (
                    typeof v.idRecord === "number" &&
                    typeof v.titleRecord === "string" &&
                    typeof v.stock === "number"
                  );
                }
              );
            } else {
              records = [];
            }
          }
          // Handle single record response
          else if (
            response &&
            typeof response === "object" &&
            "idRecord" in response
          ) {
            records = [response];
          }
          // Handle other object responses
          else if (response && typeof response === "object") {
            const values = Object.values(response);
            records = values.filter((val): val is IRecord => {
              if (!val || typeof val !== "object") return false;
              const v = val as any;
              return (
                typeof v.idRecord === "number" &&
                typeof v.titleRecord === "string" &&
                typeof v.stock === "number"
              );
            });
          }
          // Default to empty array
          else {
            records = [];
          }

          // If the answer has the group name, save it.
          if (response && response.nameGroup) {
            groupName = response.nameGroup;
          } else if (
            response &&
            typeof response === "object" &&
            response.group &&
            response.group.nameGroup
          ) {
            groupName = response.group.nameGroup;
          }

          // Assign the group name to each record
          records.forEach((record) => {
            record.groupName = groupName || "";
          });

          return records;
        }),
        tap((records) => {
          records.forEach((record) => {
            if (record && record.idRecord && record.stock !== undefined) {
              this.stockService.notifyStockUpdate(
                record.idRecord,
                record.stock
              );
            }
          });
        }),
        catchError((error) => {
          console.error('[RecordsService] Error getting records by group:', error);
          return of([]);
        })
      );
  }

  decrementStock(idRecord: number): Observable<any> {
    console.log(`[RecordsService] Decrementing stock for record ${idRecord}`);
    const headers = this.getHeaders();
    const amount = -1;
    return this.http
      .put(
        `${this.baseUrl}records/${idRecord}/updateStock/${amount}`,
        {},
        { headers }
      )
      .pipe(
        tap(() => {
          console.log(`[RecordsService] Stock decremented for record ${idRecord}`);
          this.stockService.notifyStockUpdate(idRecord, amount);
        }),
        catchError((error) => {
          console.error(`[RecordsService] Error decrementing stock for record ${idRecord}:`, error);
          return throwError(() => error);
        })
      );
  }

  incrementStock(idRecord: number): Observable<any> {
    console.log(`[RecordsService] Incrementing stock for record ${idRecord}`);
    const headers = this.getHeaders();
    const amount = 1;
    return this.http
      .put(
        `${this.baseUrl}records/${idRecord}/updateStock/${amount}`,
        {},
        { headers }
      )
      .pipe(
        tap(() => {
          console.log(`[RecordsService] Stock incremented for record ${idRecord}`);
          this.stockService.notifyStockUpdate(idRecord, amount);
        }),
        catchError((error) => {
          console.error(`[RecordsService] Error incrementing stock for record ${idRecord}:`, error);
          return throwError(() => error);
        })
      );
  }

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
}
