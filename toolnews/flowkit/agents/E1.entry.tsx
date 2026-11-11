import {registerRoot} from 'remotion';
import React from 'react';
import {clipViews} from '../clips/Views';
import {E1_DEF} from '../clips/E1';
registerRoot(() => <>{clipViews(E1_DEF)}</>);
