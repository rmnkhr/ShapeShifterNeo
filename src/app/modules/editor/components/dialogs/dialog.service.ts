import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { ConfirmDialogComponent } from 'app/modules/editor/components/dialogs/confirmdialog.component';
import { DemoDialogComponent } from 'app/modules/editor/components/dialogs/demodialog.component';
import {
  DropFilesAction,
  DropFilesDialogComponent,
} from 'app/modules/editor/components/dialogs/dropfilesdialog.component';
import { HotkeysDialogComponent } from 'app/modules/editor/components/dialogs/hotkeysdialog.component';
import { DemoInfo } from 'app/modules/editor/scripts/demos';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DialogService {
  constructor(private readonly dialog: MatDialog) {}

  confirm(title: string, message: string): Observable<boolean> {
    const config = new MatDialogConfig();
    config.data = { title, message };
    return this.dialog.open(ConfirmDialogComponent, config).afterClosed();
  }

  pickDemo(): Observable<DemoInfo> {
    const config = new MatDialogConfig();
    config.panelClass = 'ss-glass-dialog';
    return this.dialog.open(DemoDialogComponent, config).afterClosed();
  }

  dropFiles(): Observable<DropFilesAction> {
    return this.dialog.open(DropFilesDialogComponent, new MatDialogConfig()).afterClosed();
  }

  showHotkeys(): Observable<void> {
    const config = new MatDialogConfig();
    config.panelClass = 'ss-glass-dialog';
    return this.dialog.open(HotkeysDialogComponent, config).afterClosed();
  }
}
