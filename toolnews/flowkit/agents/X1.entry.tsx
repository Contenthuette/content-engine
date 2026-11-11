import {registerRoot} from 'remotion';
import React from 'react';
import {clipViews} from '../clips/Views';
import {X1_DEF} from '../clips/X1';
registerRoot(() => <>{clipViews(X1_DEF)}</>);
