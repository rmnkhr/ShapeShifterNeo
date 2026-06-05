import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DEMO_INFOS } from 'app/modules/editor/scripts/demos';

@Component({
  standalone: false,
  selector: 'app-demodialog',
  template: `
  <h2 matDialogTitle
    class="demo-title">Choose a demo</h2>
  <mat-dialog-content class="demo-list">
    <button *ngFor="let demoInfo of this.demoInfos"
      class="demo-item"
      (click)="this.dialogRef.close(demoInfo)">
      {{ demoInfo.title }}
    </button>
  </mat-dialog-content>
  <mat-dialog-actions align="end">
    <button mat-button
      matDialogClose>Cancel</button>
  </mat-dialog-actions>`,
  styleUrls: ['./demodialog.component.scss'],
})
export class DemoDialogComponent {
  readonly demoInfos = DEMO_INFOS;

  constructor(readonly dialogRef: MatDialogRef<DemoDialogComponent>) {}
}
