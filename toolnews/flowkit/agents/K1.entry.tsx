import {registerRoot} from 'remotion';
import React from 'react';
import {clipViews} from '../clips/Views';
import {K1_DEF} from '../clips/K1';
registerRoot(() => <>{clipViews(K1_DEF)}</>);
