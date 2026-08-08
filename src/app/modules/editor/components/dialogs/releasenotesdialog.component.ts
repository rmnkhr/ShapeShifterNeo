import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

interface ReleaseEntry {
  readonly title: string;
  readonly added?: ReadonlyArray<string>;
  readonly fixed?: ReadonlyArray<string>;
}

@Component({
  standalone: false,
  selector: 'app-releasenotesdialog',
  templateUrl: './releasenotesdialog.component.html',
  styleUrls: ['./releasenotesdialog.component.scss'],
})
export class ReleaseNotesDialogComponent {
  readonly entries: ReadonlyArray<ReleaseEntry> = [
    {
      title: 'August 8, 2026',
      fixed: [
        'SVG import was failing for every file with "Couldn\'t import layers from file"',
        'Icons with holes (multiple subpaths) could not be clicked or moved on the canvas',
        'Box-selecting an icon with holes broke the properties panel until reload',
        'Clicking overlapping shapes now selects the top-most one instead of the bottom-most',
        'Fill and stroke colors set on an SVG group now apply to the paths inside it on import',
      ],
    },
    {
      title: 'August 7, 2026',
      added: [
        'Grid magnet for the Vector tool — new and dragged points snap to grid cells',
        'Pen-close cursor when hovering the point that finishes an open shape',
        'Redesigned "Add animation" menu with categories, friendly names, and icons',
        'Animated properties can be toggled off again right from the "Add animation" menu',
        'Social link previews when sharing the app URL',
      ],
      fixed: [
        'Color picker slider thumbs are now draggable from the circle itself',
        'Removing a color closes the picker popover',
      ],
    },
    {
      title: 'August 5, 2026',
      added: [
        'Transform section in the property inspector (rotation, scale, pivot, move) with drag-to-change icon scrubbers',
        'New popover color picker with hue and alpha sliders, hex field, and a "Remove color" action',
        'Eyedropper icon on color swatches; crossed-out swatch when no color is set',
        'Unified sizing and borders for all property fields',
      ],
    },
    {
      title: 'Earlier',
      added: [
        'Keyboard shortcuts dialog',
        'Offer to resize oversized icon canvases to 24×24 on SVG import',
        'Kinetic Editor redesign: floating panels, frosted-glass menus, light & dark themes',
      ],
      fixed: [
        'Correct rendering of paths with multiple subpaths',
        'Playback toggle behavior',
      ],
    },
  ];

  constructor(readonly dialogRef: MatDialogRef<ReleaseNotesDialogComponent>) {}
}
