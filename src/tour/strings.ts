// Central place for the user-facing strings of the onboarding tour.

export const TOUR_STRINGS = {
  welcomeTitle: 'Welcome to Concerto Playground',
  welcomeBody:
    'This short walkthrough will introduce you to the main features of the playground so you can start building Concerto models right away.',
  ctoTitle: 'Concerto schema editor',
  ctoBody:
    'Write your Concerto model here. It is validated as you type and stays in sync with the graph.',
  examplesTitle: 'Example models',
  examplesBody:
    'Load a ready-made model to explore. Your own work stays open in its tabs.',
  viewToggleTitle: 'Graph, Form and Code views',
  viewToggleBody:
    'Switch between the visual graph, a form-based editor and generated code output.',
  canvasTitle: 'Graph canvas',
  canvasBody:
    'Every declaration is a node. Drag to pan, scroll to zoom, click a node to edit it.',
  graphToolbarTitle: 'Graph toolbar',
  graphToolbarBody:
    'Import and export files, add declarations, undo and redo, and search nodes.',
  shareTitle: 'Share your work',
  shareBody:
    'Copies a link that encodes the whole workspace so others can open it instantly.',
  docsTitle: 'Concerto documentation',
  docsBody:
    'Everything about the Concerto language lives here: guides, the full syntax reference and plenty of examples.',
  restartTitle: 'Take the tour again',
  restartBody:
    'That is it! You can restart this walkthrough from here whenever you need a refresher.',
  nextLabel: 'Next',
  prevLabel: 'Back',
  doneLabel: 'Done',
  progressText: '{{current}} of {{total}}',
  restartTour: 'Take the tour again',
  tourButton: 'Tour',
} as const;
