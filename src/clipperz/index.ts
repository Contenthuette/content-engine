// Own entry point for the CLIPPERZ worker: bundles only the editor and the Editing Library,
// not the whole reel workshop (some of its folders are local-only and not in git).
import {registerRoot} from 'remotion';
import {ClipperzRoot} from './Root';

registerRoot(ClipperzRoot);
