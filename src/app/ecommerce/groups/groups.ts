import { Component, ViewChild, ElementRef, ChangeDetectorRef, inject, afterNextRender, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgForm, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { IGroup } from '../ecommerce.interface';
import { GroupsService } from '../services/groups';
import { GenresService } from '../services/genres';

@Component({
    selector: 'app-groups',
    templateUrl: './groups.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        ConfirmDialogModule,
        DialogModule,
        InputTextModule,
        DropdownModule
    ],
    providers: [ConfirmationService]
})
export class GroupsComponent {
  @ViewChild('form') form!: NgForm;
  visibleError = false;
  errorMessage = '';
  groups: IGroup[] = [];
  filteredGroups: IGroup[] = [];
  visibleConfirm = false;
  visiblePhoto = false;
  photo = '';
  searchText: string = '';

  group: IGroup = {
    idGroup: 0,
    nameGroup: '',
    imageGroup: '',
    musicGenreId: null,
    musicGenreName: '',
    musicGenre: '',
  };

  genres: any[] = [];
  isLoadingGenres = false;
  private readonly groupsService = inject(GroupsService);
  private readonly genresService = inject(GenresService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);


  // Function to compare values in the select
  compareFn(option1: any, option2: any): boolean {
    // Compare the numerical values of the options
    return option1 && option2 ? option1 === option2 : option1 === option2;
  }

  constructor() {
    // Load initial data
    this.getGroups();
    this.getGenres();

    // afterNextRender runs once after the component is initially rendered
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });

  }

  getGroups() {
    this.groupsService.getGroups().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data: any) => {

        // Directly assign the response array (without using .$values)
        this.groups = Array.isArray(data) ? data : [];
        this.filteredGroups = [...this.groups];
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching groups:', err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }

  getGenres(): Promise<void> {
    this.isLoadingGenres = true;
    return new Promise((resolve, reject) => {
      this.genresService.getGenres().pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (data: any) => {
          try {
            // Extract the array of genres, handling different response formats
            let genresArray = [];
            
            if (Array.isArray(data)) {
              genresArray = data;
            } else if (data && typeof data === 'object' && data.$values) {
              genresArray = data.$values;
            } else if (data && typeof data === 'object') {
              // If it is an object, convert it to an array
              genresArray = Object.values(data);
            }
            
            this.genres = Array.isArray(genresArray) ? genresArray : [];
            resolve();
          } catch (error) {
            console.error('Error processing genres:', error);
            this.visibleError = true;
            this.errorMessage = 'Error loading music genres';
            reject(error);
          }
        },
        error: (err) => {
          console.error('Error getting genres:', err);
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck();
          reject(err);
        },
        complete: () => {
          this.isLoadingGenres = false;
        }
      });
    });
  }

  filterGroups() {
    this.filteredGroups = this.groups.filter((group) =>
      group.nameGroup.toLowerCase().includes(this.searchText.toLowerCase())
    );
    this.cdr.markForCheck();
  }

  onSearchChange() {
    this.filterGroups();
  }

  // Method to track changes in the image URL
  onImageUrlChange(value: string) {
    console.log('onImageUrlChange - Valor actual:', value);
    console.log('onImageUrlChange - group.imageGroup antes:', this.group.imageGroup);
    this.group.imageGroup = value;
    console.log('onImageUrlChange - group.imageGroup después:', this.group.imageGroup);
    this.cdr.markForCheck();
  }

  save() {
    
    // Validate that an image URL has been provided
    if (!this.group.imageGroup || this.group.imageGroup.trim() === '') {
      console.log('save() - Error: URL de imagen requerida');
      this.visibleError = true;
      this.errorMessage = 'Image URL is required';
      this.cdr.markForCheck();
      return;
    }
    
    // Validate that a music genre has been selected
    if (!this.group.musicGenreId) {
      console.log('save() - Error: Género musical requerido');
      this.visibleError = true;
      this.errorMessage = 'Please select a music genre';
      this.cdr.markForCheck();
      return;
    }

    // Clean the image URL value
    const imageValue = this.group.imageGroup ? this.group.imageGroup.trim() : null;
    
    const groupToSave: IGroup = {
      idGroup: this.group.idGroup,
      nameGroup: this.group.nameGroup,
      imageGroup: imageValue,
      musicGenreId: this.group.musicGenreId,
      musicGenreName: this.group.musicGenreName || '',
      musicGenre: this.group.musicGenre || ''
    };

    if (this.group.idGroup === 0) {
      this.groupsService.addGroup(groupToSave).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (data) => {
          this.visibleError = false;
          
          // If the server returns null in imageGroup, maintain the original value
          if (data && data.imageGroup === null && groupToSave.imageGroup) {
            console.log('El servidor devolvió imageGroup como null, usando el valor original');
            data.imageGroup = groupToSave.imageGroup;
          }
          
          // Reset the form
          this.group = {
            idGroup: 0,
            nameGroup: '',
            imageGroup: '',
            musicGenreId: null,
            musicGenreName: '',
            musicGenre: ''
          };
          
          if (this.form) {
            this.form.resetForm();
          }
          
          // Force the update of the group list
          this.getGroups();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[GroupsComponent] Error creating group:', {
            error: err,
            status: err.status,
            statusText: err.statusText,
            errorDetails: err.error,
            headers: err.headers,
            url: err.url
          });
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck();
        },
      });
    } else {
      this.groupsService.updateGroup(groupToSave).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (data) => {
          this.visibleError = false;
          
          // Cancel the edition
          this.cancelEdition();
          
          if (this.form) {
            this.form.resetForm();
          }
          
          this.getGroups();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[GroupsComponent] Error updating group:', {
            error: err,
            status: err.status,
            statusText: err.statusText,
            errorDetails: err.error,
            headers: err.headers,
            url: err.url,
            groupData: groupToSave
          });
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck();
        },
      });
    }
  }

  async edit(group: IGroup) {
    // Make sure the genres are loaded
    if (this.genres.length === 0) {
      try {
        await this.getGenres();
      } catch (error) {
        console.error('Error loading genres:', error);
        this.visibleError = true;
        this.errorMessage = 'The music genres could not be loaded';
        return;
      }
    }
    
    // Create a new object with all the necessary fields
    const editedGroup: IGroup = {
      idGroup: group.idGroup,
      nameGroup: group.nameGroup,
      imageGroup: group.imageGroup || '',
      musicGenreId: group.musicGenreId || 0,
      musicGenreName: group.musicGenreName || group.musicGenre || '',
      musicGenre: group.musicGenre || group.musicGenreName || ''
    };
    
    this.group = editedGroup;
    this.cdr.markForCheck();
    
    // Force change detection after a short delay
    setTimeout(() => {
      // Check if the current genre is in the genre list
      const selectedGenre = this.genres.find(g => g.idMusicGenre === this.group.musicGenreId);
      
      if (selectedGenre) {
        // Update the genre name to display in the interface
        this.group.musicGenreName = selectedGenre.nameMusicGenre;
        this.group.musicGenre = selectedGenre.nameMusicGenre;
      } else {
        console.warn('The genre was not found in the list of available genres');
      }
      
      // Force view refresh
      this.cdr.detectChanges();
    }, 100);
  }

  extractNameImage(url: string | null): string {
    if (!url) return '';
    return url.split('/').pop() || '';
  }

  cancelEdition() {
    this.group = {
      idGroup: 0,
      nameGroup: '',
      imageGroup: null, 
      musicGenreId: null,
      musicGenreName: '',
      musicGenre: '',
    };
    this.form.resetForm(); // Ensure the form resets correctly
    this.cdr.markForCheck();
  }

  confirmDelete(group: IGroup) {
    this.confirmationService.confirm({
      message: `Delete the group ${group.nameGroup}?`,
      header: 'Are you sure?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteGroup(group.idGroup!),
    });
  }

  async deleteGroup(id: number) {
    this.groupsService.deleteGroup(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.visibleError = false;
        this.form.reset({
          nameMusicGenre: '',
        });
        this.getGroups();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  controlError(err: any) {
    console.log('[GroupsComponent] Processing error in controlError:', {
      status: err.status,
      error: err.error,
      message: err.message
    });

    // If it is an authentication error (401)
    if (err.status === 401) {
      this.errorMessage = "Your session has expired or you don't have permission. Please log in again.";
      return;
    }

    // If it is a validation error (400) with details
    if (err.status === 400) {
      if (err.error && typeof err.error === 'object') {
        // If there are server validation errors
        if (err.error.errors) {
          const validationErrors: string[] = [];
          Object.keys(err.error.errors).forEach((key: string) => {
            if (Array.isArray(err.error.errors[key])) {
              validationErrors.push(...err.error.errors[key].map((e: any) => e.toString()));
            } else {
              validationErrors.push(err.error.errors[key].toString());
            }
          });
          this.errorMessage = `Validation errors: ${validationErrors.join(' ')}`;
          return;
        }
        
        if (err.error.message) {
          this.errorMessage = err.error.message;
          return;
        }
        
        if (err.error.title) {
          this.errorMessage = err.error.title;
          return;
        }
      }
      
      if (typeof err.error === 'string') {
        this.errorMessage = err.error;
        return;
      }
    }

    // If it is a network error
    if (err.status === 0) {
      this.errorMessage = 'Could not connect to the server. Please check your internet connection.';
      return;
    }

    // If it is a 500 server error
    if (err.status >= 500) {
      this.errorMessage = 'Internal server error. Please try again later.';
      return;
    }

    if (err.message) {
      this.errorMessage = err.message;
      return;
    }

    // Default message
    this.errorMessage = 'An unexpected error has occurred. Please try again.';
  }

  // onChange method removed since we now use a text field for the URL

  showImage(group: IGroup): void {
    if (this.visiblePhoto && this.group?.idGroup === group.idGroup) {
      this.visiblePhoto = false;
    } else {
      this.group = { ...group };
      this.visiblePhoto = true;
    }
    this.cdr.markForCheck();
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://i.imgur.com/neXme88.png'; // Fallback to Imgur image
    img.alt = 'Image not available';
  }

}
