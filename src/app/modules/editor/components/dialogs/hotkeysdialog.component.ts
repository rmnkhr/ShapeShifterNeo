import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

interface Hotkey {
  readonly keys: ReadonlyArray<string>;
  readonly label: string;
}

interface HotkeyGroup {
  readonly title: string;
  readonly hotkeys: ReadonlyArray<Hotkey>;
}

@Component({
  standalone: false,
  selector: 'app-hotkeysdialog',
  templateUrl: './hotkeysdialog.component.html',
  styleUrls: ['./hotkeysdialog.component.scss'],
})
export class HotkeysDialogComponent {
  readonly groups: ReadonlyArray<HotkeyGroup>;

  constructor(readonly dialogRef: MatDialogRef<HotkeysDialogComponent>) {
    const isMac = navigator.appVersion.includes('Mac');
    const mod = isMac ? '⌘' : 'Ctrl';
    const shift = isMac ? '⇧' : 'Shift';
    this.groups = [
      {
        title: 'Playback',
        hotkeys: [
          { keys: ['Space'], label: 'Play / pause' },
          { keys: ['←'], label: 'Rewind' },
          { keys: ['→'], label: 'Fast forward' },
          { keys: ['R'], label: 'Toggle repeat' },
          { keys: ['S'], label: 'Toggle slow motion' },
        ],
      },
      {
        title: 'Edit',
        hotkeys: [
          { keys: [mod, 'Z'], label: 'Undo' },
          { keys: [mod, shift, 'Z'], label: 'Redo' },
          { keys: [mod, 'G'], label: 'Group layers' },
          { keys: [mod, shift, 'G'], label: 'Ungroup layers' },
          { keys: ['Delete'], label: 'Delete selection' },
          { keys: [mod, 'O'], label: 'Zoom to fit' },
          { keys: ['Esc'], label: 'Exit edit mode' },
        ],
      },
      {
        title: 'Path editing',
        hotkeys: [
          { keys: ['A'], label: 'Add points' },
          { keys: ['S'], label: 'Split subpaths' },
          { keys: ['D'], label: 'Pair subpaths' },
          { keys: ['R'], label: 'Reverse points' },
          { keys: ['B'], label: 'Shift back' },
          { keys: ['F'], label: 'Shift forward' },
        ],
      },
    ];
  }
}
