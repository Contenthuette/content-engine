import {registerRoot} from 'remotion';
import React from 'react';
import {CameraMovePreviews} from '../CameraMovePreviews';
import {clipViews} from '../clips/Views';
import {K1_DEF} from '../clips/K1';
registerRoot(() => <><CameraMovePreviews />{clipViews(K1_DEF)}</>);
