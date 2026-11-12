// Eigener Einstieg für den Baustein „Pille wird Fenster“: Stelle T1 (Nachbau/Vergleich) + Vorschauen des Bausteins.
import {registerRoot} from 'remotion';
import React from 'react';
import {clipViews} from '../clips/Views';
import {T1Clip, T1_FRAMES, T1_START} from '../clips/T1';
import {PillToWindowPreviews} from '../PillToWindowPreviews';
registerRoot(() => <>{clipViews({id: 'T1', src: 'ref_local/showreel.mp4', start: T1_START, frames: T1_FRAMES, w: 1280, h: 720, comp: T1Clip})}<PillToWindowPreviews /></>);
