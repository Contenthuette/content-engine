// EDITZ templates (Leif 30.10.2026): every template registers its own Remotion composition here.
// Each entry: {id, component, calculateMetadata}. The worker picks it via preset.composition (src/clipperz/templates/<id>/preset.json).
import type React from 'react';
import type {CalculateMetadataFunction} from 'remotion';
import type {Plan} from '../types';
import {calcClipperz} from '../ClipperzEdit';
import {Editorial} from './editorial/Editorial';
import {calcWarmDoc, EditzWarmDoc} from './warmdoc/WarmDoc';
import {LimeEditorial} from './limeeditorial/LimeEditorial';
import {LimeMagazin} from './limemagazin/LimeMagazin';
import {BlueGlass} from './blueglass/BlueGlass';
import {NoirNews} from './noirnews/NoirNews';
import {EditzDirector, calcDirector} from '../director/EditzDirector';

export type TemplateComp = {
  id: string;
  component: React.FC<Plan>;
  calculateMetadata: CalculateMetadataFunction<Plan>;
};

export const TEMPLATES: TemplateComp[] = [
  // one line per template
  {id: 'EditzEditorial', component: Editorial, calculateMetadata: calcClipperz},
  {id: 'EditzWarmDoc', component: EditzWarmDoc, calculateMetadata: calcWarmDoc},
  {id: 'EditzLimeEditorial', component: LimeEditorial, calculateMetadata: calcClipperz},
  {id: 'EditzLimeMagazin', component: LimeMagazin, calculateMetadata: calcClipperz},
  {id: 'EditzBlueGlass', component: BlueGlass, calculateMetadata: calcClipperz},
  {id: 'EditzNoirNews', component: NoirNews, calculateMetadata: calcClipperz},
  {id: 'EditzDirector', component: EditzDirector as unknown as React.FC<Plan>, calculateMetadata: calcDirector as unknown as CalculateMetadataFunction<Plan>},
];
