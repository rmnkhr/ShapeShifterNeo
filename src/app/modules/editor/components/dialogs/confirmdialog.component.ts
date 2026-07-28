import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  standalone: false,
  selector: 'app-confirmdialog',
  template: `
  <span matDialogTitle>{{ this.data.title }}</span>
  <mat-dialog-content>
    <p>{{ this.data.message }}</p>
  </mat-dialog-content>
  <mat-dialog-actions fxLayout="row">
    <!-- The ordering here matters (it ensures that 'OK' gets focus first). -->
    <span fxFlex></span>
    <button fxFlexOrder="2" mat-flat-button class="ss-confirm-ok" (click)="dialogRef.close(true)">{{ data.ok || 'OK' }}</button>
    <button fxFlexOrder="1" mat-button class="ss-confirm-cancel" matDialogClose>{{ data.cancel || 'Cancel' }}</button>
  </mat-dialog-actions>`,
  styleUrls: ['./confirmdialog.component.scss'],
})
export class ConfirmDialogComponent {
  constructor(
    readonly dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    readonly data: { title: string; message: string; ok?: string; cancel?: string },
  ) {}
}
