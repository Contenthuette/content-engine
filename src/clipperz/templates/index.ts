// EDITZ templates (Leif 30.10.2026): every template registers its own Remotion composition here.
// Each entry: {id, component, calculateMetadata}. The worker picks it via preset.composition (src/clipperz/templates/<id>/preset.json).
import type React from 'react';
import type {CalculateMetadataFunction} from 'remotion';
import type {Plan} from '../types';

export type TemplateComp = {
  id: string;
  component: React.FC<Plan>;
  calculateMetadata: CalculateMetadataFunction<Plan>;
};

export const TEMPLATES: TemplateComp[] = [
  // one line per template, e.g. {id: 'EditzEditorial', component: Editorial, calculateMetadata: calcClipperz},
];
