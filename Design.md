---
name: Kinetic Editor System
colors:
  surface: '#111417'
  surface-dim: '#111417'
  surface-bright: '#36393e'
  surface-container-lowest: '#0b0e12'
  surface-container-low: '#191c20'
  surface-container: '#1d2024'
  surface-container-high: '#272a2e'
  surface-container-highest: '#323539'
  on-surface: '#e1e2e8'
  on-surface-variant: '#c3c6d5'
  inverse-surface: '#e1e2e8'
  inverse-on-surface: '#2e3135'
  outline: '#8c909e'
  outline-variant: '#424753'
  surface-tint: '#afc6ff'
  primary: '#afc6ff'
  on-primary: '#002d6c'
  primary-container: '#2662c5'
  on-primary-container: '#dbe4ff'
  inverse-primary: '#1a5abd'
  secondary: '#c4c6d0'
  on-secondary: '#2d3038'
  secondary-container: '#43474f'
  on-secondary-container: '#b2b5be'
  tertiary: '#c4c6cf'
  on-tertiary: '#2d3037'
  tertiary-container: '#63666d'
  on-tertiary-container: '#e3e4ed'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#afc6ff'
  on-primary-fixed: '#001a43'
  on-primary-fixed-variant: '#004397'
  secondary-fixed: '#e0e2ec'
  secondary-fixed-dim: '#c4c6d0'
  on-secondary-fixed: '#181c23'
  on-secondary-fixed-variant: '#43474f'
  tertiary-fixed: '#e0e2eb'
  tertiary-fixed-dim: '#c4c6cf'
  on-tertiary-fixed: '#181c22'
  on-tertiary-fixed-variant: '#44474e'
  background: '#111417'
  on-background: '#e1e2e8'
  surface-variant: '#323539'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
  mono-label:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  panel-padding: 12px
  control-gap: 8px
  sidebar-width: 280px
  toolbar-height: 48px
  gutter: 16px
---

## Brand & Style
The brand personality is precise, functional, and developer-centric. This design system is engineered for creative productivity, specifically targeting technical users who require a high-density, low-friction interface for motion design and vector editing.

The design style is **Corporate / Modern** with a focus on **Systematic Minimalism**. It prioritizes utilitarian efficiency through clear visual hierarchies, a disciplined color application, and a structured grid. The UI evokes a sense of reliability and expert-grade capability, using dark surfaces to reduce eye strain during long creative sessions and a vibrant primary blue to highlight key actions and states.

## Colors
This design system utilizes a sophisticated dark-mode palette. The primary color is a vibrant, high-contrast blue used exclusively for interactive states, primary actions, and active selection indicators. 

The neutral palette is built on deep grays: `#191C20` serves as the base surface for tool panels and sidebars, while a slightly darker `#0E1113` is reserved for the infinite canvas or viewport area to maximize content focus. The secondary and tertiary tones are utilized for typography and iconography, ensuring high legibility against dark backgrounds. Borders use `#44474E` to define structural boundaries without creating excessive visual noise.

## Typography
The system relies entirely on **Inter** to maintain a neutral, systematic, and utilitarian aesthetic. The type scale is optimized for high-density information display, favoring smaller font sizes with generous line heights to preserve legibility in complex toolbars.

Labels and UI controls often use `label-sm` in uppercase or with tracking adjustments to distinguish functional metadata from content. For numeric inputs and coordinate systems common in vector editors, a consistent tabular-width setting for the font should be applied to prevent layout shifting during value changes.

## Layout & Spacing
The layout follows a **Fixed Grid** model for the editor shell with a **Fluid Workspace** (the canvas). The application is divided into functional zones: a persistent top navigation bar, collapsible side panels for properties and layers, and a central viewport.

The spacing rhythm is based on a 4px increment system. This allows for the high-density arrangement of controls required by an editing interface. Panels use a standard 12px internal padding, while individual input groups and buttons within a toolbar are separated by 8px. Alignment is strictly geometric; all panels must snap to the outer viewport edges to maximize the central workspace.

## Elevation & Depth
In this system, hierarchy is communicated through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows. 

The canvas is the lowest layer (z-index: 0). Panels and toolbars sit on top (z-index: 10) with `#191C20` backgrounds and a 1px border of `#44474E` to separate them from the workspace. Popovers, dropdowns, and modals use a slightly elevated tone or a very subtle, diffused shadow (15% opacity black) to indicate they are floating above the interface. This "flat-depth" approach keeps the interface feeling lightweight and modern.

## Shapes
The shape language is **Rounded** and approachable yet disciplined. A base corner radius of 8px (`0.5rem`) is applied to buttons, input fields, and tool panels. This increased roundedness provides a modern, ergonomic feel while maintaining the system's professional capability.

Larger containers like modals or property cards use 16px (`rounded-lg`) to differentiate them from small UI controls. Interactive states for icons (ghost buttons) should use a circular radius to create a distinct hit area that contrasts with the rounded-rectangular property inputs.

## Components

### Buttons & Inputs
Primary buttons use the vibrant blue (`#2662C5`) with white text. Secondary buttons and tool toggles use a ghost style: no fill or a subtle gray fill on hover, with the primary blue used only for the "active" or "selected" state. Input fields are dark-filled with a subtle border and 8px radius, turning blue on focus.

### Chips & Tags
Used for layer labels or status indicators, chips are compact with `label-sm` typography and an 8px radius. They should use low-saturation background tints to avoid competing with the primary action buttons.

### Layers & Lists
The layer list is a high-density vertical stack. Active layers are highlighted with a subtle blue tint across the entire row. Indentation is used strictly to indicate hierarchy.

### Property Panels
Property inputs (X/Y coordinates, scale, rotation) should be arranged in tight grids. Labels are positioned to the left of the input or above it in a diminutive, high-contrast weight to ensure the value remains the focal point.

### Timeline/Sequencer
Specific to a motion kit, the timeline should use a dark background with vertical 1px lines for frames. Keyframes are represented by geometric diamonds in the primary blue color when selected.
