import {registerRoot} from 'remotion';
import React from 'react';
import {clipViews} from '../clips/Views';
import {R1_DEF} from '../clips/R1';
registerRoot(() => <>{clipViews(R1_DEF)}</>);
