import {registerRoot} from 'remotion';
import React from 'react';
import {clipViews} from '../clips/Views';
import {T6_DEF} from '../clips/T6';
registerRoot(() => <>{clipViews(T6_DEF)}</>);
